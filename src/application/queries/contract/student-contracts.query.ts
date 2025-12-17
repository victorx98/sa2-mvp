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

  /**
   * Get paginated contracts list with filters (获取带筛选的分页合同列表)
   * @param filters Filter conditions (筛选条件)
   * @param pagination Pagination parameters (分页参数)
   * @returns Paginated contracts list (分页合同列表)
   */
  async getContractsWithPagination(filters: {
    studentId?: string;
    status?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  }, pagination: { page: number; pageSize: number }) {
    const { studentId, status, productId, startDate, endDate, keyword } = filters;

    // Build date filters
    const dateFilters: { signedAfter?: Date; signedBefore?: Date } = {};
    if (startDate) {
      dateFilters.signedAfter = new Date(startDate);
    }
    if (endDate) {
      dateFilters.signedBefore = new Date(endDate);
    }

    const result = await this.contractService.search(
      {
        studentId,
        status,
        productId,
        keyword,
        ...dateFilters,
      },
      pagination,
      { field: "createdAt", order: "desc" },
    );

    return {
      data: result.data.map((contract) => ({
        id: contract.id,
        contract_number: contract.contractNumber,
        product: {
          id: contract.productSnapshot.productId,
          name: contract.productSnapshot.productName,
        },
        status: contract.status,
        studentId: contract.studentId,
        totalAmount: contract.totalAmount,
        currency: contract.currency,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }
}

