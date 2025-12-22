/**
 * Contract Entity (合同实体)
 * Aggregate root for the Contract aggregate (Contract聚合的聚合根)
 * Manages contract lifecycle, service quantities, and business rules (管理合同生命周期、服务数量和业务规则)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ContractStatus,
  InvalidContractStatusTransitionException,
  InvalidContractStatusException,
} from '../value-objects/contract-status.vo';
import { ProductSnapshot, InvalidProductSnapshotException } from '../value-objects/product-snapshot.vo';
import { Money, Currency } from '../value-objects/money.vo';
import { ServiceQuantity } from '../value-objects/service-quantity.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// Contract status history entry (合同状态历史记录)
interface ContractStatusHistory {
  status: string;
  changedAt: Date;
  changedBy: string;
  reason?: string;
}

// Contract properties interface (合同属性接口)
interface ContractProps {
  id: string;
  contractNumber: string;
  title?: string;
  studentId: string;
  productSnapshot: ProductSnapshot;
  status: ContractStatus;
  statusHistory: ContractStatusHistory[];
  serviceQuantities: ServiceQuantity[];
  totalAmount: Money;
  currency: Currency;
  notes?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  signedAt?: Date;
  signedBy?: string;
  activatedAt?: Date;
  suspendedAt?: Date;
  completedAt?: Date;
  terminatedAt?: Date;
  terminatedReason?: string;
}

export class Contract {
  private constructor(private readonly props: ContractProps) {}

  /**
   * Create a new draft contract (创建新的草稿合同)
   *
   * @param studentId - Student ID (学生ID)
   * @param productSnapshot - Product snapshot from Catalog domain (来自目录域的产品快照)
   * @param createdBy - Creator user ID (创建人ID)
   * @param contractNumber - Optional contract number (optional contract number)
   * @param title - Optional contract title (可选合同标题)
   * @param notes - Optional notes (可选备注)
   * @returns Contract instance (Contract实例)
   * @throws InvalidProductSnapshotException if product snapshot is invalid (产品快照无效时抛出InvalidProductSnapshotException)
   */
  static createDraft(
    studentId: string,
    productSnapshot: ProductSnapshot,
    createdBy: string,
    contractNumber?: string,
    title?: string,
    notes?: string,
  ): Contract {
    // Validate product snapshot (验证产品快照)
    productSnapshot.validate();

    // Generate contract number if not provided (如未提供，生成合同编号)
    const finalContractNumber = contractNumber || `CONTRACT-${new Date().getFullYear()}-${uuidv4().substring(0, 8)}`;

    // Convert snapshot items to service quantities (将快照items转换为服务数量)
    const serviceQuantities = productSnapshot.getItems().map((item) =>
      ServiceQuantity.create(item.serviceTypeCode, item.quantity),
    );

    // Calculate total amount from product snapshot (从产品快照计算总金额)
    const currencyCode = productSnapshot.getCurrency() as unknown as Currency;
    const totalAmount = Money.create(productSnapshot.getNumericPrice(), currencyCode);

    const contract = new Contract({
      id: uuidv4(),
      contractNumber: finalContractNumber,
      title,
      studentId,
      productSnapshot,
      status: ContractStatus.DRAFT,
      statusHistory: [
        {
          status: ContractStatus.DRAFT.getValue(),
          changedAt: new Date(),
          changedBy: createdBy,
        },
      ],
      serviceQuantities,
      totalAmount,
      currency: productSnapshot.getCurrency() as Currency,
      notes,
      createdAt: new Date(),
      createdBy,
    });

    return contract;
  }

  /**
   * Reconstruct a Contract from persistence data (从持久化数据重建Contract)
   *
   * @param props - Contract properties (合同属性)
   * @returns Contract instance (Contract实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: ContractProps): Contract {
    return new Contract(props);
  }

  /**
   * Sign the contract (签署合同)
   * Valid transition: DRAFT → SIGNED (有效转换：DRAFT → SIGNED)
   *
   * @param signedBy - User ID who signed the contract (签署合同的用户ID)
   * @throws ContractNotDraftException if contract is not in DRAFT status (合同不处于DRAFT状态时抛出ContractNotDraftException)
   */
  sign(signedBy: string): void {
    if (!this.props.status.isDraft()) {
      throw new ContractNotDraftException(this.props.id);
    }

    (this.props as any).status = this.props.status.transitionToSigned();
    (this.props as any).signedAt = new Date();
    (this.props as any).signedBy = signedBy;

    this.addStatusHistory(ContractStatus.SIGNED, signedBy, 'Contract signed');
  }

  /**
   * Activate the contract (激活合同)
   * Valid transition: SIGNED → ACTIVE (有效转换：SIGNED → ACTIVE)
   *
   * @param activatedBy - User ID who activated the contract (激活合同的用户ID)
   * @throws ContractNotSignedException if contract is not in SIGNED status (合同不处于SIGNED状态时抛出ContractNotSignedException)
   */
  activate(activatedBy: string): void {
    if (!this.props.status.isSigned()) {
      throw new ContractNotSignedException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToActive();
    (this.props as any).activatedAt = new Date();

    this.addStatusHistory(ContractStatus.ACTIVE, activatedBy, 'Contract activated');
  }

  /**
   * Suspend the contract (挂起合同)
   * Valid transition: ACTIVE → SUSPENDED (有效转换：ACTIVE → SUSPENDED)
   *
   * @param suspendedBy - User ID who suspended the contract (挂起合同的用户ID)
   * @param reason - Reason for suspension (挂起原因)
   * @throws ContractNotActiveException if contract is not in ACTIVE status (合同不处于ACTIVE状态时抛出ContractNotActiveException)
   */
  suspend(suspendedBy: string, reason: string): void {
    if (!this.props.status.isActive()) {
      throw new ContractNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToSuspended();
    (this.props as any).suspendedAt = new Date();

    this.addStatusHistory(ContractStatus.SUSPENDED, suspendedBy, reason);
  }

  /**
   * Reactivate a suspended contract (重新激活挂起的合同)
   * Valid transition: SUSPENDED → ACTIVE (有效转换：SUSPENDED → ACTIVE)
   *
   * @param reactivatedBy - User ID who reactivated the contract (重新激活合同的用户ID)
   * @param reason - Reason for reactivation (重新激活原因)
   * @throws InvalidContractStatusTransitionException if contract is not in SUSPENDED status (合同不处于SUSPENDED状态时抛出InvalidContractStatusTransitionException)
   */
  reactivate(reactivatedBy: string, reason: string = 'Contract reactivated'): void {
    if (!this.props.status.isSuspended()) {
      throw new InvalidContractStatusTransitionException(
        this.props.status.getValue(),
        ContractStatus.ACTIVE.getValue(),
      );
    }

    (this.props as any).status = this.props.status.transitionToActive();
    (this.props as any).suspendedAt = undefined;

    this.addStatusHistory(ContractStatus.ACTIVE, reactivatedBy, reason);
  }

  /**
   * Mark contract as completed (标记合同为已完成)
   * Valid transition: ACTIVE → COMPLETED (有效转换：ACTIVE → COMPLETED)
   *
   * @param completedBy - User ID who completed the contract (完成合同的用户ID)
   * @throws ContractNotActiveException if contract is not in ACTIVE status (合同不处于ACTIVE状态时抛出ContractNotActiveException)
   */
  complete(completedBy: string): void {
    if (!this.props.status.isActive()) {
      throw new ContractNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToCompleted();
    (this.props as any).completedAt = new Date();

    this.addStatusHistory(ContractStatus.COMPLETED, completedBy, 'Contract completed');
  }

  /**
   * Terminate the contract (终止合同)
   * Valid transition: ACTIVE → TERMINATED (有效转换：ACTIVE → TERMINATED)
   *
   * @param terminatedBy - User ID who terminated the contract (终止合同的用户ID)
   * @param reason - Reason for termination (终止原因)
   * @throws ContractNotActiveException if contract is not in ACTIVE status (合同不处于ACTIVE状态时抛出ContractNotActiveException)
   */
  terminate(terminatedBy: string, reason: string): void {
    if (!this.props.status.isActive()) {
      throw new ContractNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToTerminated();
    (this.props as any).terminatedAt = new Date();
    (this.props as any).terminatedReason = reason;

    this.addStatusHistory(ContractStatus.TERMINATED, terminatedBy, `Contract terminated: ${reason}`);
  }

  /**
   * Update contract information (更新合同信息)
   * Only DRAFT contracts can be modified (只有DRAFT合同可以修改)
   *
   * @param updatedBy - User ID who updated the contract (更新合同的用户ID)
   * @param title - Optional new title (可选新标题)
   * @param notes - Optional new notes (可选新备注)
   * @throws ContractNotDraftException if contract is not in DRAFT status (合同不处于DRAFT状态时抛出ContractNotDraftException)
   */
  update(updatedBy: string, title?: string, notes?: string): void {
    if (!this.props.status.canBeModified()) {
      throw new ContractNotDraftException(this.props.id);
    }

    if (title !== undefined) {
      (this.props as any).title = title;
    }

    if (notes !== undefined) {
      (this.props as any).notes = notes;
    }

    (this.props as any).updatedAt = new Date();
    (this.props as any).updatedBy = updatedBy;
  }

  /**
   * Get service quantity for a specific service type (获取特定服务类型的服务数量)
   *
   * @param serviceTypeCode - Service type code (服务类型编码)
   * @returns ServiceQuantity or null if not found (ServiceQuantity，未找到时返回null)
   */
  getServiceQuantity(serviceTypeCode: string): ServiceQuantity | null {
    return (
      this.props.serviceQuantities.find((sq) => sq.isForServiceType(serviceTypeCode)) || null
    );
  }

  /**
   * Check if contract has sufficient service quantity (检查合同是否有足够的服务数量)
   *
   * @param serviceTypeCode - Service type code to check (要检查的服务类型编码)
   * @param requiredQuantity - Required quantity (所需数量)
   * @returns true if sufficient (数量充足时返回true)
   */
  hasSufficientQuantity(serviceTypeCode: string, requiredQuantity: number): boolean {
    const serviceQuantity = this.getServiceQuantity(serviceTypeCode);
    if (!serviceQuantity) {
      return false;
    }
    return serviceQuantity.isSufficient(requiredQuantity);
  }

  /**
   * Check if contract includes a specific service type (检查合同是否包含特定服务类型)
   *
   * @param serviceTypeCode - Service type code to check (要检查的服务类型编码)
   * @returns true if service type is included (包含服务类型时返回true)
   */
  hasServiceType(serviceTypeCode: string): boolean {
    return this.props.serviceQuantities.some((sq) => sq.isForServiceType(serviceTypeCode));
  }

  /**
   * Add status history entry (添加状态历史记录)
   *
   * @param status - New status (新状态)
   * @param changedBy - User ID who changed the status (更改状态的用户ID)
   * @param reason - Optional reason (可选原因)
   */
  private addStatusHistory(status: ContractStatus, changedBy: string, reason?: string): void {
    (this.props as any).statusHistory = [
      ...this.props.statusHistory,
      {
        status: status.getValue(),
        changedAt: new Date(),
        changedBy,
        reason,
      },
    ];
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getContractNumber(): string {
    return this.props.contractNumber;
  }

  getTitle(): string | undefined {
    return this.props.title;
  }

  getStudentId(): string {
    return this.props.studentId;
  }

  getProductSnapshot(): ProductSnapshot {
    return this.props.productSnapshot;
  }

  getStatus(): ContractStatus {
    return this.props.status;
  }

  getStatusHistory(): ContractStatusHistory[] {
    return this.props.statusHistory;
  }

  getServiceQuantities(): ServiceQuantity[] {
    return this.props.serviceQuantities;
  }

  getTotalAmount(): Money {
    return this.props.totalAmount;
  }

  getCurrency(): Currency {
    return this.props.currency;
  }

  getNotes(): string | undefined {
    return this.props.notes;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getCreatedBy(): string {
    return this.props.createdBy;
  }

  getUpdatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  getUpdatedBy(): string | undefined {
    return this.props.updatedBy;
  }

  getSignedAt(): Date | undefined {
    return this.props.signedAt;
  }

  getSignedBy(): string | undefined {
    return this.props.signedBy;
  }

  getActivatedAt(): Date | undefined {
    return this.props.activatedAt;
  }

  getSuspendedAt(): Date | undefined {
    return this.props.suspendedAt;
  }

  getCompletedAt(): Date | undefined {
    return this.props.completedAt;
  }

  getTerminatedAt(): Date | undefined {
    return this.props.terminatedAt;
  }

  getTerminatedReason(): string | undefined {
    return this.props.terminatedReason;
  }

  /**
   * Check if contract is active and can consume services (检查合同是否激活且可以消费服务)
   *
   * @returns true if active (激活时返回true)
   */
  isActive(): boolean {
    return this.props.status.isActive();
  }

  /**
   * Check if contract is in DRAFT status (检查合同是否处于DRAFT状态)
   *
   * @returns true if draft (草稿状态时返回true)
   */
  isDraft(): boolean {
    return this.props.status.isDraft();
  }

  /**
   * Check if contract is signed (检查合同是否已签署)
   *
   * @returns true if signed (已签署时返回true)
   */
  isSigned(): boolean {
    return this.props.status.isSigned();
  }
}

/**
 * ContractNotDraftException (合同不是草稿异常)
 * Thrown when attempting to modify a non-draft contract (尝试修改非草稿合同时抛出)
 */
export class ContractNotDraftException extends DomainException {
  constructor(contractId: string) {
    super(
      'CONTRACT_NOT_DRAFT',
      `Contract ${contractId} is not in DRAFT status and cannot be modified`,
      { contractId },
    );
  }
}

/**
 * ContractNotActiveException (合同不是激活状态异常)
 * Thrown when attempting operation on non-active contract (尝试在非激活合同上执行操作时抛出)
 */
export class ContractNotActiveException extends DomainException {
  constructor(contractId: string, status: string) {
    super(
      'CONTRACT_NOT_ACTIVE',
      `Contract ${contractId} is in ${status} status and cannot perform this operation`,
      { contractId, status },
    );
  }
}

/**
 * ContractNotSignedException (合同未签署异常)
 * Thrown when attempting to activate an unsigned contract (尝试激活未签署合同时抛出)
 */
export class ContractNotSignedException extends DomainException {
  constructor(contractId: string, status: string) {
    super(
      'CONTRACT_NOT_SIGNED',
      `Contract ${contractId} is in ${status} status and cannot be activated`,
      { contractId, status },
    );
  }
}

/**
 * ServiceTypeNotFoundException (服务类型未找到异常)
 * Thrown when trying to access a service type not included in contract (尝试访问合同中未包含的服务类型时抛出)
 */
export class ServiceTypeNotFoundException extends DomainException {
  constructor(contractId: string, serviceTypeCode: string) {
    super(
      'SERVICE_TYPE_NOT_FOUND',
      `Service type ${serviceTypeCode} not found in contract ${contractId}`,
      { contractId, serviceTypeCode },
    );
  }
}
