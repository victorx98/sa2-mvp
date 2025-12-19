/**
 * Contract Domain Test Utilities [Contract Domain 测试工具]
 *
 * 提供标准的数据库 mock 和测试模块创建工具
 * Provides standard database mocks and test module creation utilities
 */

import { Test, TestingModule } from "@nestjs/testing";

/**
 * 创建标准的数据库 mock
 *
 * @returns Standard database mock object [标准数据库 mock 对象]
 */
export function createMockDatabase(): any {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([]),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([]),
      })),
    })),
    transaction: jest.fn((callback: any) => callback({})),
  };
}

/**
 * 创建支持链式调用的数据库 mock
 *
 * @returns Database mock with chainable methods [支持链式调用的数据库 mock]
 */
export function createChainableMockDatabase(): any {
  const mockDb: any = {
    select: jest.fn(),
    insert: jest.fn(),
    transaction: jest.fn(),
  };

  // 创建链式调用的 mock 结构
  mockDb.select = jest.fn(() => mockDb.select);
  mockDb.select.from = jest.fn(() => mockDb.select.from);
  mockDb.select.from.where = jest.fn().mockResolvedValue([]);

  mockDb.insert = jest.fn(() => mockDb.insert);
  mockDb.insert.values = jest.fn(() => mockDb.insert.values);
  mockDb.insert.values.returning = jest.fn().mockResolvedValue([]);

  // 创建事务 executor mock，支持 select/insert 操作
  const mockTx = {
    select: jest.fn(() => mockTx.select),
    insert: jest.fn(() => mockTx.insert),
  };
  mockTx.select.from = jest.fn(() => mockTx.select.from);
  mockTx.select.from.where = jest.fn().mockResolvedValue([]);
  mockTx.insert.values = jest.fn(() => mockTx.insert.values);
  mockTx.insert.values.returning = jest.fn().mockResolvedValue([]);

  mockDb.transaction = jest.fn((callback: any) => callback(mockTx));

  return mockDb;
}

/**
 * 创建包含事务支持的数据库 mock
 *
 * @returns Database mock with transaction support [包含事务支持的数据库 mock]
 */
export function createTransactionalMockDatabase(): any {
  const mockDb = createMockDatabase();

  // 模拟事务方法
  mockDb.transaction = jest.fn(async (callback: any) => {
    const mockTx = createMockDatabase();
    return callback(mockTx);
  });

  return mockDb;
}

/**
 * 创建标准的事件监听器测试模块
 *
 * @param listenerClass 监听器类 [Listener class]
 * @param mockService Mock 服务 [Mocked service]
 * @param token 服务 token (可以是字符串或类) [Service token (can be string or class)]
 * @returns TestingModule 实例 [TestingModule instance]
 */
export async function createEventListenerTestingModule(
  listenerClass: any,
  mockService: any,
  token: any,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      listenerClass,
      {
        provide: token,
        useValue: mockService,
      },
    ],
  }).compile();
}

/**
 * 创建标准的服务测试模块
 *
 * @param serviceClass 服务类 [Service class]
 * @param dependencies 依赖项数组 [Dependencies array]
 * @returns TestingModule 实例 [TestingModule instance]
 */
export async function createServiceTestingModule(
  serviceClass: any,
  dependencies: Array<{ token: string; value: any }>,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      serviceClass,
      ...dependencies.map((dep) => ({
        provide: dep.token,
        useValue: dep.value,
      })),
    ],
  }).compile();
}

/**
 * 创建 ServiceLedgerService 的标准 mock
 *
 * @returns ServiceLedgerService mock [ServiceLedgerService mock]
 */
export function createMockServiceLedgerService(): any {
  return {
    recordConsumption: jest.fn().mockResolvedValue({}),
    recordAdjustment: jest.fn().mockResolvedValue({}),
    recordRefund: jest.fn().mockResolvedValue({}),
    queryLedgers: jest.fn().mockResolvedValue([]),
    calculateAvailableBalance: jest.fn().mockResolvedValue({}),
    reconcileBalance: jest.fn().mockResolvedValue(true),
  };
}

/**
 * 创建 ServiceHoldService 的标准 mock
 *
 * @returns ServiceHoldService mock [ServiceHoldService mock]
 */
export function createMockServiceHoldService(): any {
  return {
    createHold: jest.fn().mockResolvedValue({}),
    releaseHold: jest.fn().mockResolvedValue({}),
    queryHolds: jest.fn().mockResolvedValue([]),
  };
}

/**
 * 创建 ContractService 的标准 mock
 *
 * @returns ContractService mock [ContractService mock]
 */
export function createMockContractService(): any {
  return {
    createContract: jest.fn().mockResolvedValue({}),
    updateContract: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    findByFilters: jest.fn().mockResolvedValue([]),
    findStudentContracts: jest.fn().mockResolvedValue([]),
    signContract: jest.fn().mockResolvedValue({}),
    terminateContract: jest.fn().mockResolvedValue({}),
    calculateServiceBalance: jest.fn().mockResolvedValue({}),
    batchCalculateServiceBalance: jest.fn().mockResolvedValue([]),
  };
}

/**
 * 生成测试用的 UUID
 *
 * @returns 随机 UUID 字符串 [Random UUID string]
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * 创建模拟的权益数据
 *
 * @param overrides 覆盖默认值的对象 [Object to override defaults]
 * @returns 模拟的权益数据 [Mocked entitlement data]
 */
export function createMockEntitlement(overrides: Partial<any> = {}): any {
  return {
    id: generateTestId(),
    studentId: generateTestId(),
    serviceType: "test_service",
    totalQuantity: 10,
    consumedQuantity: 2,
    heldQuantity: 1,
    availableQuantity: 7,
    ...overrides,
  };
}

/**
 * 创建模拟的台账记录
 *
 * @param overrides 覆盖默认值的对象 [Object to override defaults]
 * @returns 模拟的台账记录 [Mocked ledger entry]
 */
export function createMockLedger(overrides: Partial<any> = {}): any {
  return {
    id: generateTestId(),
    studentId: generateTestId(),
    serviceType: "test_service",
    quantity: -1,
    type: "consumption",
    source: "booking_completed",
    balanceAfter: 9,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * 等待异步操作完成（用于测试中的延迟）
 *
 * @param ms 毫秒数 [Milliseconds]
 * @returns Promise [Promise]
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
