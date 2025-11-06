import { Injectable, Logger } from '@nestjs/common';

/**
 * Contract Service (临时实现)
 * 职责：管理合同和服务余额
 *
 * TODO: 完整实现需要：
 * - 数据库表：contracts, service_holds
 * - 余额检查逻辑
 * - 服务预占（Service Hold）机制
 */
@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  /**
   * 获取服务余额（临时实现：返回固定足够权限）
   * @param contractId 合同ID
   * @param serviceId 服务ID
   * @returns 余额信息
   */
  async getServiceBalance(
    contractId: string,
    serviceId: string,
  ): Promise<{
    available: number;
    used: number;
    total: number;
  }> {
    this.logger.debug(
      `获取服务余额: contractId=${contractId}, serviceId=${serviceId}`,
    );

    // 临时实现：返回固定足够的余额
    return {
      available: 999, // 可用次数
      used: 0, // 已使用次数
      total: 999, // 总次数
    };
  }

  /**
   * 创建服务预占（临时实现：返回模拟数据）
   * @param options 预占选项
   * @returns 预占记录
   */
  async createServiceHold(options: {
    contractId: string;
    serviceId: string;
    sessionId: string;
    quantity: number;
  }): Promise<{
    id: string;
    contractId: string;
    serviceId: string;
    sessionId: string;
    quantity: number;
    createdAt: Date;
  }> {
    this.logger.debug(`创建服务预占: sessionId=${options.sessionId}`);

    // 临时实现：返回模拟的预占记录
    return {
      id: `hold_${Date.now()}`,
      contractId: options.contractId,
      serviceId: options.serviceId,
      sessionId: options.sessionId,
      quantity: options.quantity,
      createdAt: new Date(),
    };
  }
}
