import { IsUUID } from "class-validator";

/**
 * DTO for querying student contracts (查询学生合同的DTO)
 * Used to query contracts purchased by a specific student (用于查询指定学生购买的合同)
 */
export class StudentContractsQueryDto {
  @IsUUID()
  studentId: string; // Student ID (学生ID)
}

/**
 * Response DTO for student contracts query (学生合同查询响应DTO)
 */
export type StudentContractResponseDto = {
  id: string; // Contract ID (合同ID)
  contract_number: string; // Contract number (合同编号)
  product: {
    id: string; // Product ID (产品ID)
    name: string; // Product name (产品名称)
  };
  status: string; // Contract status (合同状态)
};

