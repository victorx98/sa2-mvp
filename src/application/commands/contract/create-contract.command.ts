import { Injectable } from "@nestjs/common";
import { eq, inArray, sql } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CreateContractDto } from "@api/dto/request/contract/contract.request.dto";
import type { Contract } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";
import { validateProductSnapshot, validateProductSnapshotMatch } from "@domains/contract/common/utils/validation.utils";
import type { IProductSnapshot, IGenerateContractNumberResult } from "@domains/contract/common/types/snapshot.types";
import { ContractStatus } from "@shared/types/contract-enums";
import { Currency } from "@shared/types/catalog-enums";

/**
 * Create Contract Command (Application Layer)
 * [创建合同命令]
 *
 * 职责：
 * 1. 编排合同创建用例
 * 2. 验证产品快照和产品信息
 * 3. 生成合约编号
 * 4. 创建合约记录和服务权益
 * 5. 管理事务
 */
@Injectable()
export class CreateContractCommand extends CommandBase {

  /**
   * 执行创建合同用例
   * [Execute create contract use case]
   *
   * @param input 创建合同输入参数
   * @param createdBy 创建人ID（从JWT token获取）
   * @returns 创建的合同
   */
  async execute(
    input: CreateContractDto,
    createdBy: string,
  ): Promise<Contract> {
    this.logger.debug(`Creating contract for student: ${input.studentId}`);

    const { productSnapshot, studentId, title, productId } = input;

    // 1. 验证产品快照
    validateProductSnapshot(productSnapshot);

    // 2. 查询产品信息
    const [productDetails] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!productDetails) {
      throw new ContractException("PRODUCT_NOT_FOUND", "Product not found");
    }

    if (productDetails.status !== "ACTIVE") {
      throw new ContractException(
        "PRODUCT_NOT_ACTIVE",
        `Product must be ACTIVE to create contract. Current status: ${productDetails.status}`,
      );
    }

    // 3. 查询产品项
    const productItems = await this.db
      .select({
        id: schema.productItems.id,
        productId: schema.productItems.productId,
        serviceTypeId: schema.productItems.serviceTypeId,
        quantity: schema.productItems.quantity,
        sortOrder: schema.productItems.sortOrder,
        serviceTypeCode: schema.serviceTypes.code,
      })
      .from(schema.productItems)
      .leftJoin(
        schema.serviceTypes,
        eq(schema.productItems.serviceTypeId, schema.serviceTypes.id),
      )
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder);

    if (productItems.length === 0) {
      throw new ContractException(
        "PRODUCT_MIN_ITEMS",
        "Product must have at least one item to create contract",
      );
    }

    // 4. 验证产品快照与当前产品匹配
    validateProductSnapshotMatch(
      productSnapshot,
      productId,
      productDetails.price,
      productDetails.currency,
    );

    // 5. 验证初始状态
    const initialStatus = input.status || ContractStatus.DRAFT;
    if (
      initialStatus !== ContractStatus.DRAFT &&
      initialStatus !== ContractStatus.SIGNED
    ) {
      throw new ContractException(
        "INVALID_INITIAL_STATUS",
        "Initial contract status must be DRAFT or SIGNED",
      );
    }

    // 6. 生成合约编号
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as unknown as IGenerateContractNumberResult
    ).contract_number;

    // 7. 使用事务创建合约和相关记录
    const newContract = await this.db.transaction(async (tx) => {
      // 7.1 创建合约
      const [contract] = await tx
        .insert(schema.contracts)
        .values({
          contractNumber,
          title: title || productDetails.name,
          studentId,
          productId: productId,
          productSnapshot: {
            productId: productDetails.id,
            productName: productDetails.name,
            productCode: productDetails.code,
            price: productDetails.price.toString(),
            currency: productDetails.currency,
            items: productItems.map((item) => ({
              productItemId: item.id,
              serviceTypeCode: item.serviceTypeCode || "",
              quantity: item.quantity,
              sortOrder: item.sortOrder,
            })),
            snapshotAt: new Date(),
          },
          status: initialStatus,
          totalAmount: productDetails.price.toString(),
          currency: productDetails.currency as Currency,
          createdBy,
        })
        .returning();

      // 7.2 创建服务权益
      await this.createEntitlementsFromSnapshot(contract, tx);

      // 7.3 记录状态历史（如果不是草稿状态）
      if (initialStatus !== ContractStatus.DRAFT) {
        await tx.insert(schema.contractStatusHistory).values({
          contractId: contract.id,
          fromStatus: ContractStatus.DRAFT,
          toStatus: initialStatus,
          changedAt: new Date(),
          changedBy: createdBy,
          reason: null,
          metadata: {},
        });
      }

      return contract;
    });

    this.logger.debug(`Contract created successfully: ${newContract.id}`);
    return newContract;
  }

  /**
   * 从产品快照创建服务权益
   * [Create service entitlements from product snapshot]
   */
  private async createEntitlementsFromSnapshot(
    contract: Contract,
    tx: DrizzleDatabase,
  ): Promise<void> {
    const productSnapshot = contract.productSnapshot as IProductSnapshot;
    const items = productSnapshot.items || [];

    if (items.length > 0) {
      const serviceTypeCodes = items
        .map((item) => item.serviceTypeCode)
        .filter(Boolean);

      const serviceTypesResult = await tx
        .select({
          code: schema.serviceTypes.code,
        })
        .from(schema.serviceTypes)
        .where(
          serviceTypeCodes.length > 0
            ? inArray(schema.serviceTypes.code, serviceTypeCodes)
            : undefined,
        );

      const validServiceTypeCodes = new Set(
        serviceTypesResult.map((st) => st.code),
      );

      const quantitiesByServiceType = new Map<string, number>();
      for (const item of items) {
        const serviceTypeCode = item.serviceTypeCode;
        if (!validServiceTypeCodes.has(serviceTypeCode)) {
          throw new ContractException("SERVICE_TYPE_NOT_FOUND");
        }
        const currentQty = quantitiesByServiceType.get(serviceTypeCode) || 0;
        quantitiesByServiceType.set(
          serviceTypeCode,
          currentQty + (item.quantity || 1),
        );
      }

      const insertValues = [];
      for (const [serviceType, quantity] of quantitiesByServiceType) {
        insertValues.push({
          studentId: contract.studentId,
          serviceType,
          totalQuantity: quantity,
          availableQuantity: quantity,
          createdBy: contract.createdBy,
        });
      }

      if (insertValues.length > 0) {
        await tx
          .insert(schema.contractServiceEntitlements)
          .values(insertValues)
          .onConflictDoUpdate({
            target: [
              schema.contractServiceEntitlements.studentId,
              schema.contractServiceEntitlements.serviceType,
            ],
            set: {
              totalQuantity: sql`${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity`,
              availableQuantity: sql`(${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity) - ${schema.contractServiceEntitlements.consumedQuantity} - ${schema.contractServiceEntitlements.heldQuantity}`,
              updatedAt: new Date(),
            },
          });
      }
    } else {
      throw new ContractException(
        "PRODUCT_SNAPSHOT_NO_ITEMS",
        "Product snapshot has no items. This should have been caught during validation.",
      );
    }
  }
}
