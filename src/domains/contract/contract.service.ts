import { Injectable } from '@nestjs/common';

/**
 * Domain Layer - Contract Service
 * 职责：管理合同和服务权益
 *
 * 功能：
 * - 查询合同服务余额
 * - 检查服务可用性
 * - 创建服务预占（Service Hold）
 * - 释放服务预占
 * - 记录服务消费
 */
@Injectable()
export class ContractService {
  /**
   * 获取合同中指定服务的余额
   * @param contractId 合同ID
   * @param serviceId 服务ID
   * @returns 余额信息
   */
  async getServiceBalance(contractId: string, serviceId: string): Promise<{
    allocated: number;      // 分配的总量
    consumed: number;       // 已消费
    held: number;          // 已预占
    available: number;     // 可用余额
  }> {
    // TODO: 实现余额查询逻辑
    // 1. 查询 contract_entitlements 表获取 allocated
    // 2. 聚合 service_ledgers 表获取 consumed
    // 3. 聚合 service_holds 表（status='active'）获取 held
    // 4. 计算 available = allocated - consumed - held

    console.log(`[ContractService] getServiceBalance: contractId=${contractId}, serviceId=${serviceId}`);

    // 临时返回模拟数据
    return {
      allocated: 10,
      consumed: 0,
      held: 0,
      available: 10,
    };
  }

  /**
   * 创建服务预占（用于预约）
   * @param data 预占数据
   * @returns 预占记录
   */
  async createServiceHold(data: {
    contractId: string;
    serviceId: string;
    quantity: number;
    holdUntil: Date;
    sessionId?: string;
  }): Promise<{
    id: string;
    contractId: string;
    serviceId: string;
    quantity: number;
    holdUntil: Date;
  }> {
    // TODO: 实现服务预占逻辑
    // 1. 验证余额是否充足
    // 2. 插入 service_holds 表
    // 3. 返回预占记录

    console.log('[ContractService] createServiceHold:', data);

    // 临时返回模拟数据
    return {
      id: 'hold_' + Date.now(),
      ...data,
    };
  }

  /**
   * 释放服务预占
   * @param holdId 预占ID
   */
  async releaseServiceHold(holdId: string): Promise<void> {
    // TODO: 实现释放预占逻辑
    // 更新 service_holds 表，设置 status='released'

    console.log(`[ContractService] releaseServiceHold: holdId=${holdId}`);
  }

  /**
   * 消费服务预占（完成课程时调用）
   * @param holdId 预占ID
   * @param actualQuantity 实际消费量
   */
  async consumeServiceHold(holdId: string, actualQuantity: number): Promise<void> {
    // TODO: 实现消费预占逻辑
    // 1. 更新 service_holds 表，设置 status='consumed'
    // 2. 插入 service_ledgers 表记录消费

    console.log(`[ContractService] consumeServiceHold: holdId=${holdId}, actualQuantity=${actualQuantity}`);
  }
}
