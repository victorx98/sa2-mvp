import { Inject, Injectable } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { DrizzleDatabase } from "@shared/types/database.types";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import { CreateContractDto } from "../dto/create-contract.dto";
import { FindOneContractDto } from "../dto/find-one-contract.dto";
import { ConsumeServiceDto } from "../dto/consume-service.dto";
import { calculateExpirationDate } from "../common/utils/date.utils";
import {
  validatePrice,
  validatePriceOverride,
} from "../common/utils/validation.utils";
import { sortByConsumptionPriority } from "../common/constants/contract.constants";
import type { Contract } from "@infrastructure/database/schema";
import type {
  IProductSnapshot,
  IGenerateContractNumberResult,
  IEntitlementAggregation,
} from "../common/types/snapshot.types";
import type {
  ServiceType,
  ContractStatusEnum,
  CurrencyEnum,
} from "../common/types/enum.types";

@Injectable()
export class ContractService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create contract
   * - Generate unique contract number
   * - Create contract record (status = signed)
   * - Derive service entitlements from product snapshot
   * - Publish contract.signed event
   */
  async create(dto: CreateContractDto): Promise<Contract> {
    const {
      productSnapshot,
      studentId,
      overrideAmount,
      overrideReason,
      overrideApprovedBy,
      createdBy,
    } = dto;

    // 1. Validate price
    const originalPrice = parseFloat(productSnapshot.price);
    validatePrice(originalPrice * 100); // Convert to cents

    // 2. Validate price override if provided
    if (overrideAmount) {
      const overridePriceValue = parseFloat(overrideAmount);
      validatePriceOverride(originalPrice * 100, overridePriceValue * 100);

      if (!overrideReason || !overrideApprovedBy) {
        throw new ContractException("PRICE_OVERRIDE_REQUIRES_REASON");
      }
    }

    // 3. Calculate validity period
    const signedAt = dto.signedAt ? new Date(dto.signedAt) : new Date();
    const expiresAt = calculateExpirationDate(
      signedAt,
      productSnapshot.validityDays || null,
    );

    // 4. Generate contract number using database function
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as IGenerateContractNumberResult
    ).contract_number;

    // 5. Create contract in transaction
    return await this.db.transaction(async (tx) => {
      // Insert contract
      const [newContract] = await tx
        .insert(schema.contracts)
        .values({
          contractNumber,
          studentId,
          productId: dto.productId,
          productSnapshot: productSnapshot as never,
          status: "signed",
          totalAmount: productSnapshot.price,
          currency: productSnapshot.currency as CurrencyEnum,
          validityDays: productSnapshot.validityDays,
          signedAt,
          expiresAt,
          overrideAmount,
          overrideReason,
          overrideApprovedBy,
          createdBy,
        })
        .returning();

      // 6. Publish domain event (entitlements will be created on activation)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.signed",
        aggregateId: newContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: newContract.id,
          contractNumber: newContract.contractNumber,
          studentId: newContract.studentId,
          productId: newContract.productId,
          totalAmount: newContract.totalAmount,
          signedAt: newContract.signedAt,
        },
        status: "pending",
      });

      return newContract;
    });
  }

  /**
   * Find one contract
   * Supports multiple query methods with priority:
   * 1. contractId (highest)
   * 2. contractNumber (second)
   * 3. studentId + status combination (lowest)
   */
  async findOne(filter: FindOneContractDto): Promise<Contract | null> {
    const { contractId, contractNumber, studentId, status, productId } = filter;

    // Priority 1: Query by contractId
    if (contractId) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);
      return contract || null;
    }

    // Priority 2: Query by contractNumber
    if (contractNumber) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.contractNumber, contractNumber))
        .limit(1);
      return contract || null;
    }

    // Priority 3: Query by combination (studentId is required)
    if (!studentId) {
      throw new ContractException("INVALID_QUERY");
    }

    const conditions = [eq(schema.contracts.studentId, studentId)];
    if (status) {
      conditions.push(
        eq(schema.contracts.status, status as ContractStatusEnum),
      );
    }
    if (productId) {
      conditions.push(eq(schema.contracts.productId, productId));
    }

    const contracts = await this.db
      .select()
      .from(schema.contracts)
      .where(and(...conditions))
      .limit(2); // Query 2 to detect non-unique results

    if (contracts.length === 0) {
      return null;
    }

    if (contracts.length > 1) {
      throw new ContractException("CONTRACT_MULTIPLE_FOUND");
    }

    return contracts[0];
  }

  /**
   * Activate contract
   * - Triggered by payment.succeeded event
   * - Update status to active
   * - Set activatedAt timestamp
   * - Create service entitlements from product snapshot
   * - Publish contract.activated event
   */
  async activate(id: string): Promise<Contract> {
    // 1. Find contract
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status
    if (contract.status !== "signed") {
      throw new ContractException("CONTRACT_NOT_DRAFT");
    }

    // 3. Update status and create entitlements
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "active",
          activatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Create service entitlements from product snapshot
      const productSnapshot =
        contract.productSnapshot as unknown as IProductSnapshot;
      const entitlementMap = new Map<string, IEntitlementAggregation>();

      // Parse product items and aggregate by service type
      for (const item of productSnapshot.items || []) {
        if (item.productItemType === "service" && item.service) {
          const serviceType = item.service.serviceType;
          const existing = entitlementMap.get(serviceType);

          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.originItems.push({
              productItemType: "service",
              productItemId: item.productItemId,
              quantity: item.quantity,
            });
          } else {
            entitlementMap.set(serviceType, {
              serviceType,
              totalQuantity: item.quantity,
              serviceSnapshot: item.service,
              originItems: [
                {
                  productItemType: "service",
                  productItemId: item.productItemId,
                  quantity: item.quantity,
                },
              ],
            });
          }
        } else if (
          item.productItemType === "service_package" &&
          item.servicePackage
        ) {
          // Expand service package items
          for (const pkgItem of item.servicePackage.items || []) {
            const serviceType = pkgItem.service.serviceType;
            const quantity = item.quantity * pkgItem.quantity; // Product quantity * package item quantity
            const existing = entitlementMap.get(serviceType);

            if (existing) {
              existing.totalQuantity += quantity;
              existing.originItems.push({
                productItemType: "service_package",
                productItemId: item.productItemId,
                quantity,
                servicePackageName: item.servicePackage.servicePackageName,
              });
            } else {
              entitlementMap.set(serviceType, {
                serviceType,
                totalQuantity: quantity,
                serviceSnapshot: pkgItem.service,
                originItems: [
                  {
                    productItemType: "service_package",
                    productItemId: item.productItemId,
                    quantity,
                    servicePackageName: item.servicePackage.servicePackageName,
                  },
                ],
              });
            }
          }
        }
      }

      // Insert entitlements
      const entitlements = Array.from(entitlementMap.values()).map(
        (entitlement) => ({
          contractId: updatedContract.id,
          serviceType: entitlement.serviceType as ServiceType,
          source: "product" as const,
          totalQuantity: entitlement.totalQuantity,
          availableQuantity: entitlement.totalQuantity,
          serviceSnapshot: entitlement.serviceSnapshot as never,
          originItems: entitlement.originItems as never,
          expiresAt: updatedContract.expiresAt,
        }),
      );

      if (entitlements.length > 0) {
        await tx
          .insert(schema.contractServiceEntitlements)
          .values(entitlements);
      }

      // 5. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.activated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          activatedAt: updatedContract.activatedAt,
          entitlementsCreated: entitlements.length,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Consume service
   * - Deduct service entitlement balance by priority
   * - Priority: product > addon > promotion > compensation
   * - Create service ledger record
   * - Release associated hold if provided
   */
  async consumeService(dto: ConsumeServiceDto): Promise<void> {
    const { contractId, serviceType, quantity, sessionId, holdId, createdBy } =
      dto;

    await this.db.transaction(async (tx) => {
      // 1. Find contract
      const [contract] = await tx
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      if (contract.status !== "active") {
        throw new ContractException("CONTRACT_NOT_ACTIVE");
      }

      // 2. Find entitlements for this service type, sorted by priority
      const entitlements = await tx
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.contractId, contractId),
            eq(
              schema.contractServiceEntitlements.serviceType,
              serviceType as ServiceType,
            ),
          ),
        )
        .for("update"); // Pessimistic lock

      if (entitlements.length === 0) {
        throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
      }

      // Sort by consumption priority
      const sortedEntitlements = sortByConsumptionPriority(entitlements);

      // 3. Deduct quantity by priority
      let remainingQuantity = quantity;
      for (const entitlement of sortedEntitlements) {
        if (remainingQuantity <= 0) break;
        if (entitlement.availableQuantity <= 0) continue;

        const deductAmount = Math.min(
          remainingQuantity,
          entitlement.availableQuantity,
        );

        // Update entitlement (consumed_quantity will be synced by trigger)
        // Just record the ledger, trigger handles balance update
        await tx.insert(schema.serviceLedgers).values({
          contractId,
          studentId: contract.studentId,
          serviceType: serviceType as ServiceType,
          quantity: -deductAmount,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: entitlement.availableQuantity - deductAmount,
          relatedHoldId: holdId,
          relatedBookingId: sessionId,
          createdBy,
        });

        remainingQuantity -= deductAmount;
      }

      // 4. Check if sufficient balance
      if (remainingQuantity > 0) {
        throw new ContractException("INSUFFICIENT_BALANCE");
      }

      // 5. Release hold if provided
      if (holdId) {
        await tx
          .update(schema.serviceHolds)
          .set({
            status: "released",
            releaseReason: "completed",
            releasedAt: new Date(),
          })
          .where(eq(schema.serviceHolds.id, holdId));
      }

      // 6. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "service.consumed",
        aggregateId: contractId,
        aggregateType: "Contract",
        payload: {
          contractId,
          serviceType,
          quantity,
          sessionId,
        },
        status: "pending",
      });
    });
  }

  /**
   * Terminate contract
   * - Update status to terminated
   * - Set terminatedAt timestamp
   * - Publish contract.terminated event
   * - Allowed from: active, suspended
   */
  async terminate(
    id: string,
    reason: string,
    terminatedBy: string,
  ): Promise<Contract> {
    // 1. Find contract
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status
    if (contract.status !== "active" && contract.status !== "suspended") {
      throw new ContractException("CONTRACT_NOT_TERMINATABLE");
    }

    // 3. Validate reason
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("TERMINATION_REQUIRES_REASON");
    }

    // 4. Update status
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "terminated",
          terminatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 5. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.terminated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          reason,
          terminatedBy,
          terminatedAt: updatedContract.terminatedAt,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Suspend contract
   * - Update status to suspended
   * - Set suspendedAt timestamp
   * - Publish contract.suspended event
   * - Admin operation only
   * - Allowed from: active
   */
  async suspend(
    id: string,
    reason: string,
    suspendedBy: string,
  ): Promise<Contract> {
    // 1. Find contract
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status
    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 3. Validate reason
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("SUSPENSION_REQUIRES_REASON");
    }

    // 4. Update status
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "suspended",
          suspendedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 5. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.suspended",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          reason,
          suspendedBy,
          suspendedAt: updatedContract.suspendedAt,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Resume contract
   * - Update status to active
   * - Set resumedAt timestamp
   * - Publish contract.resumed event
   * - Admin operation only
   * - Allowed from: suspended
   */
  async resume(id: string, resumedBy: string): Promise<Contract> {
    // 1. Find contract
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status
    if (contract.status !== "suspended") {
      throw new ContractException("CONTRACT_NOT_SUSPENDED");
    }

    // 3. Update status
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "active",
          suspendedAt: null, // Clear suspension timestamp
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.resumed",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          resumedBy,
          resumedAt: new Date(),
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Complete contract
   * - Update status to completed
   * - Set completedAt timestamp
   * - Publish contract.completed event
   * - Triggered by: expiration (auto) or admin action (manual)
   * - Allowed from: active
   */
  async complete(id: string, completedBy?: string): Promise<Contract> {
    // 1. Find contract
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status
    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 3. Update status
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.completed",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          completedBy: completedBy || "system",
          completedAt: updatedContract.completedAt,
          isAutoCompleted: !completedBy,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }
}
