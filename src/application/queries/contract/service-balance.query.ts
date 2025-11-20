import { Injectable } from "@nestjs/common";
import { ContractService } from "@domains/contract/services/contract.service";

/**
 * Service Balance Query (Application Layer)
 * 职责：
 * 1. 编排服务余额查询用例
 * 2. 调用 Contract Domain 的 ContractService
 * 3. 返回业务数据
 */
@Injectable()
export class ServiceBalanceQuery {
  constructor(
    private readonly contractService: ContractService,
  ) {}

  /**
   * 根据学生ID获取服务余额
   * @param studentId 学生ID
   * @param serviceType 服务类型（可选）
   * @returns 服务余额列表
   */
  async getServiceBalance(
    studentId: string,
    serviceType?: string,
  ): Promise<
    Array<{
      studentId: string;
      serviceType: string;
      totalQuantity: number;
      consumedQuantity: number;
      heldQuantity: number;
      availableQuantity: number;
    }>
  > {
    return this.contractService.getServiceBalance({
      studentId,
      serviceType,
    });
  }
}

