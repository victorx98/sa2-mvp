/**
 * Contract Read Models
 * 合同查询输出模型
 */

export interface StudentContractReadModel {
  id: string;
  studentId: string;
  productSnapshotId: string;
  contractNumber: string;
  productName: string;
  productPrice: string;
  productCurrency: string;
  status: string;
  signedAt: Date | null;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  resumedAt: Date | null;
  completedAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceConsumptionReadModel {
  contractId: string;
  contractNumber: string;
  studentId: string;
  studentNameCn: string | null;
  studentNameEn: string | null;
  serviceTypeId: string;
  serviceTypeCode: string;
  serviceTypeName: string;
  totalQuantity: number;
  consumedQuantity: number;
  remainingQuantity: number;
  lastConsumedAt: Date | null;
  contractStatus: string;
  contractSignedAt: Date | null;
}

