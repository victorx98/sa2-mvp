import { Injectable } from "@nestjs/common";
import { ContractService } from "@domains/contract/services/contract.service";
import type { StudentContractResponseDto } from "@domains/contract/dto/student-contracts-query.dto";

/**
 * Student Contracts Query (Application Layer)
 * 职责：
 * 1. 编排学生合同查询用例
 * 2. 调用 Contract Domain 的 ContractService
 * 3. 返回格式化的合同和产品信息
 */
@Injectable()
export class StudentContractsQuery {
  constructor(
    private readonly contractService: ContractService,
  ) {}

  /**
   * Get contracts purchased by a specific student (获取指定学生购买的合同)
   * @param studentId Student ID (学生ID)
   * @returns List of contracts with product information (包含产品信息的合同列表)
   */
  async getStudentContracts(
    studentId: string,
  ): Promise<StudentContractResponseDto[]> {
    const result = await this.contractService.search(
      { studentId },
      undefined,
      { field: "createdAt", order: "desc" },
    );

    return result.data.map((contract) => ({
      id: contract.id,
      contract_number: contract.contractNumber,
      product: {
        id: contract.productSnapshot.productId,
        name: contract.productSnapshot.productName,
      },
      status: contract.status,
    }));
  }
}

