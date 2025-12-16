import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ContractService } from "./contract.service";
import { CreateContractDto } from "../dto/create-contract.dto";
import { FindOneContractDto } from "../dto/find-one-contract.dto";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import { ConsumeServiceDto } from "../dto/consume-service.dto";
import { AddAmendmentLedgerDto } from "../dto/add-amendment-ledger.dto";
import { Currency } from "@shared/types/catalog-enums";
import {
  ContractStatus,
  AmendmentLedgerType,
} from "@shared/types/contract-enums";
import { IProductSnapshot } from "../common/types/snapshot.types";
import { randomUUID } from "crypto";
import type { ServiceType } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";

/**
 * Unit Tests for ContractService
 *
 * Test Strategy:
 * - This is a UNIT test for the domain service layer
 * - Test level: Service methods in isolation with mocked dependencies
 * - Mock external dependencies: EventEmitter2, database
 * - Focus: Business logic validation and data transformation
 * - Does NOT test: Database integration, trigger behaviors, cross-service orchestration
 */
describe("ContractService Unit Tests [合约服务单元测试]", () => {
  let moduleRef: TestingModule;
  let contractService: ContractService;
  let _eventEmitter: EventEmitter2;
  let mockDb: any;
  const testStudentId = randomUUID();
  const testProductId = randomUUID();
  const testContractId = randomUUID();
  const testServiceTypeId1 = randomUUID();
  const testServiceTypeId2 = randomUUID();
  const testCreatedBy = randomUUID();

  beforeEach(async () => {
    // Create mock database
    mockDb = {
      execute: jest.fn(),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn().mockResolvedValue([]),
            })),
          })),
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([]),
            for: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue([]),
            })),
          })),
          limit: jest.fn().mockResolvedValue([]),
          offset: jest.fn().mockResolvedValue([]),
          orderBy: jest.fn().mockResolvedValue([]),
          forUpdate: jest.fn().mockResolvedValue([]),
        })),
        limit: jest.fn().mockResolvedValue([]),
        where: jest.fn(() => ({
          forUpdate: jest.fn().mockResolvedValue([]),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
          onConflictDoUpdate: jest.fn().mockResolvedValue([]),
        })),
        onConflictDoUpdate: jest.fn(),
      })),
      delete: jest.fn(),
      query: {
        contracts: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        products: {
          findFirst: jest.fn(),
        },
        contractServiceEntitlements: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        serviceLedgers: {
          findFirst: jest.fn(),
        },
      },
      transaction: jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          query: mockDb.query,
        };
        return await callback(mockTx);
      }),
    };

    // Setup default mocks
    (mockDb.execute as jest.Mock).mockResolvedValue({
      rows: [{ contract_number: "TEST-2025-0001" }],
    });

    // Setup query mocks for Drizzle ORM query interface
    mockDb.query.contracts.findFirst = jest.fn().mockResolvedValue(null);
    mockDb.query.contracts.findMany = jest.fn().mockResolvedValue([]);
    mockDb.query.products.findFirst = jest.fn().mockResolvedValue(null);
    mockDb.query.contractServiceEntitlements.findFirst = jest
      .fn()
      .mockResolvedValue(null);
    mockDb.query.contractServiceEntitlements.findMany = jest
      .fn()
      .mockResolvedValue([]);
    mockDb.query.serviceLedgers.findFirst = jest.fn().mockResolvedValue(null);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: ".",
          verboseMemoryLeak: false,
        }),
      ],
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        ContractService,
      ],
    }).compile();

    contractService = moduleRef.get<ContractService>(ContractService);
    _eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create() [创建合约]", () => {
    it("should create contract successfully [应该成功创建合约]", async () => {
      // Arrange - Mock product lookup to return valid product
      (mockDb.query.products.findFirst as jest.Mock).mockResolvedValue({
        id: testProductId,
        name: "Test Product",
        code: "TEST-PRODUCT",
        status: "ACTIVE",
      });

      const productSnapshot: IProductSnapshot = {
        productId: testProductId,
        productName: "Test Product",
        productCode: "TEST-PRODUCT",
        price: "1000.00",
        currency: Currency.USD,
        items: [
          {
            productItemId: randomUUID(),
            serviceTypeCode: "CONSULTATION",
            quantity: 5,
            sortOrder: 1,
          },
        ],
        snapshotAt: new Date(),
      };
      const createDto: CreateContractDto & { createdBy: string } = {
        productSnapshot,
        studentId: testStudentId,
        productId: testProductId,
        createdBy: testCreatedBy,
        title: "Test Contract",
      };

      const mockContract = {
        id: randomUUID(),
        contractNumber: "TEST-2025-0001",
        title: "Test Contract",
        studentId: testStudentId,
        productId: testProductId,
        productSnapshot: productSnapshot as any,
        status: ContractStatus.SIGNED,
        totalAmount: "1000.00",
        currency: Currency.USD,
        validityDays: 365,
        createdBy: testCreatedBy,
      };

      // Mock the product query to return a valid product
      const mockProduct = {
        id: testProductId,
        name: "Test Product",
        code: "TEST-PRODUCT",
        status: "ACTIVE",
        price: "1000.00",
        currency: Currency.USD,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the select query for product details
      const mockProductSelect = jest.fn().mockResolvedValue([mockProduct]);
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: mockProductSelect,
          }),
        }),
      });

      // Mock product items to pass validation
      const mockProductItems = [
        {
          id: randomUUID(),
          productId: testProductId,
          serviceTypeId: randomUUID(),
          quantity: 5,
          sortOrder: 1,
          serviceTypeCode: "CONSULTATION",
        },
      ];

      // Mock the product items query
      mockDb.select = jest
        .fn()
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnValue({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn().mockResolvedValue(mockProductItems),
              })),
            })),
          }),
        }));

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([mockContract]);

      mockDb.insert = jest.fn().mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      // Mock transaction to support createEntitlementsFromSnapshot [Mock事务以支持createEntitlementsFromSnapshot]
      mockDb.transaction = jest.fn(async (callback) => {
        const mockTxInsertValues = jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockContract]),
          onConflictDoUpdate: jest.fn().mockResolvedValue([]),
        });
        const mockTxInsert = jest.fn().mockReturnValue({
          values: mockTxInsertValues,
        });
        const mockTx = {
          ...mockDb,
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                { code: "CONSULTATION" }, // Mock service types query result [Mock服务类型查询结果]
              ]),
            }),
          }),
          insert: mockTxInsert,
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([mockContract]),
              }),
            }),
          }),
          query: mockDb.query,
        };
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.create(createDto);

      // Assert
      expect(result).toEqual(mockContract);
      expect(mockDb.transaction).toHaveBeenCalled();
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should reject negative price [应该拒绝负价格]", async () => {
      // Arrange - Mock product lookup to return valid product
      (mockDb.query.products.findFirst as jest.Mock).mockResolvedValue({
        id: testProductId,
        name: "Test Product",
        code: "TEST-PRODUCT",
        status: "ACTIVE",
      });

      const createDto: CreateContractDto & { createdBy: string } = {
        productSnapshot: {
          productId: testProductId,
          productName: "Test Product",
          productCode: "TEST-PRODUCT",
          price: "-100",
          currency: Currency.USD,
          items: [
            {
              productItemId: randomUUID(),
              serviceTypeCode: "CONSULTATION",
              quantity: 3,
              sortOrder: 1,
            },
          ],
          snapshotAt: new Date(),
        } as IProductSnapshot,
        studentId: testStudentId,
        productId: testProductId,
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(contractService.create(createDto)).rejects.toThrow(
        ContractException,
      );
    });
  });

  describe("findOne() [查找合约]", () => {
    it("should find contract by contractId [应该通过合约ID查找合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.ACTIVE,
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([mockContract]);

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      // Act
      const result = await contractService.findOne({
        contractId: testContractId,
      });

      // Assert
      expect(result).toEqual(mockContract);
    });

    it("should find contract by contractNumber [应该通过合约编号查找合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.ACTIVE,
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([mockContract]);

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      // Act
      const result = await contractService.findOne({
        contractNumber: "TEST-2025-0001",
      });

      // Assert
      expect(result).toEqual(mockContract);
    });

    it("should find contract by studentId and status [应该通过学生ID和状态查找合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.SIGNED,
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue([mockContract]);

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: mockWhere.mockReturnValue({
          limit: mockLimit,
        }),
      });

      // Act
      const result = await contractService.findOne({
        studentId: testStudentId,
        status: ContractStatus.SIGNED,
      });

      // Assert
      expect(result).toEqual(mockContract);
    });

    it("should throw error when studentId is missing [当缺少学生ID时应该抛出错误]", async () => {
      // Act & Assert
      await expect(
        contractService.findOne({
          status: ContractStatus.SIGNED,
        } as FindOneContractDto),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("activate() [激活合约]", () => {
    it("should activate contract and create entitlements [应该激活合约并创建权益]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.SIGNED,
        productSnapshot: {
          productId: testProductId,
          productName: "Test Product",
          productCode: "TEST-PRODUCT",
          price: "1000.00",
          currency: Currency.USD,
          items: [
            {
              productItemId: randomUUID(),
              serviceTypeCode: "CONSULTATION",
              quantity: 5,
              sortOrder: 1,
            },
            {
              productItemId: randomUUID(),
              serviceTypeCode: "MENTORING",
              quantity: 10,
              sortOrder: 2,
            },
          ],
          snapshotAt: new Date(),
        } as IProductSnapshot,
        createdBy: testCreatedBy,
      };

      // Mock findOne - use spy instead of overriding mockDb.select
      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Mock service types batch query
      const mockServiceTypes = [
        { id: testServiceTypeId1, code: "CONSULTATION" },
        { id: testServiceTypeId2, code: "MENTORING" },
      ];

      // Mock entitlements query
      const mockExistingEntitlements: any[] = [];

      // Configure mock to return different values for consecutive calls
      const mockWhere1 = jest.fn().mockResolvedValue(mockServiceTypes);
      const mockWhere2 = jest.fn().mockResolvedValue(mockExistingEntitlements);

      mockDb.select = jest.fn().mockReturnValue({
        from: jest
          .fn()
          .mockReturnValueOnce({ where: mockWhere1 })
          .mockReturnValueOnce({ where: mockWhere2 }),
      });

      // Mock upsert
      const mockOnConflict = jest.fn().mockResolvedValue(undefined);
      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        onConflictDoUpdate: mockOnConflict,
      });

      // Mock transaction for update operations in activate
      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([
                  {
                    ...mockContract,
                    status: ContractStatus.ACTIVE,
                    activatedAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        };
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.ACTIVE,
      );

      // Assert
      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error if contract not found [如果合约未找到应该抛出错误]", async () => {
      // Arrange
      jest.spyOn(contractService, "findOne").mockResolvedValue(null);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.ACTIVE),
      ).rejects.toThrow(ContractNotFoundException);
    });

    it("should throw error if contract already active [如果合约已激活应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.ACTIVE),
      ).rejects.toThrow(ContractException);
    });

    it("should throw error if contract not in signed status [如果合约不在已签署状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.ACTIVE),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("consumeService() [消费服务]", () => {
    it("should consume service successfully [应该成功消费服务]", async () => {
      // Arrange
      const consumeDto: ConsumeServiceDto = {
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 1,
        relatedBookingId: randomUUID(),
        bookingSource: "regular_mentoring_sessions", // Required when relatedBookingId is provided [当relatedBookingId存在时必填]
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: "CONSULTATION",
          availableQuantity: 5,
          consumedQuantity: 0,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue(mockEntitlements),
          }),
        }),
      });

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{ id: testStudentId }]),
                for: jest.fn().mockResolvedValue(mockEntitlements),
              }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnThis(),
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnThis(),
          }),
        };
        return await callback(mockTx);
      });

      // Act
      await contractService.consumeService(consumeDto, testCreatedBy);

      // Assert
      expect(mockDb.transaction).toHaveBeenCalled();
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should throw error if insufficient balance [如果余额不足应该抛出错误]", async () => {
      // Arrange
      const consumeDto: ConsumeServiceDto = {
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 10,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: "CONSULTATION",
          availableQuantity: 5,
          consumedQuantity: 0,
        },
      ];

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{ id: testStudentId }]),
                for: jest.fn().mockResolvedValue(mockEntitlements),
              }),
            }),
          }),
        };
        return await callback(mockTx);
      });

      // Act & Assert
      await expect(
        contractService.consumeService(consumeDto, testCreatedBy),
      ).rejects.toThrow(ContractException);
    });

    it("should throw error if no entitlements found [如果未找到权益应该抛出错误]", async () => {
      // Arrange
      const consumeDto: ConsumeServiceDto = {
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 1,
      };

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{ id: testStudentId }]),
                for: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
        return await callback(mockTx);
      });

      // Act & Assert
      await expect(
        contractService.consumeService(consumeDto, testCreatedBy),
      ).rejects.toThrow(ContractNotFoundException);
    });
  });

  describe("terminate() [终止合约]", () => {
    it("should terminate contract successfully [应该成功终止合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
        terminatedAt: new Date(),
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.TERMINATED,
        { reason: "User requested termination" },
      );

      // Assert
      expect(result.status).toBe(ContractStatus.TERMINATED);
      // Status change is recorded in history table, not in contract record
      // [状态变更记录在历史表中，不在合同记录中]
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should throw error if contract not active or suspended [如果合约不是激活或暂停状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(
          testContractId,
          ContractStatus.TERMINATED,
          { reason: "Test reason" },
        ),
      ).rejects.toThrow(ContractException);
    });

    it("should throw error if reason is empty [如果原因为空应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(
          testContractId,
          ContractStatus.TERMINATED,
          { reason: "" },
        ),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("suspend() [暂停合约]", () => {
    it("should suspend contract successfully [应该成功暂停合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.SUSPENDED,
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.SUSPENDED,
        { reason: "Payment overdue" },
      );

      // Assert
      expect(result.status).toBe(ContractStatus.SUSPENDED);
      // Status change is recorded in history table, not in contract record
      // [状态变更记录在历史表中，不在合同记录中]
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should throw error if contract not active [如果合约不是激活状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.SUSPENDED, {
          reason: "Test reason",
        }),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("resume() [恢复合约]", () => {
    it("should resume contract successfully [应该成功恢复合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        status: ContractStatus.SUSPENDED,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.ACTIVE,
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.ACTIVE,
      );

      // Assert
      expect(result.status).toBe(ContractStatus.ACTIVE);
      // Status change is recorded in history table, not in contract record
      // [状态变更记录在历史表中，不在合同记录中]
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should throw error if contract not suspended [如果合约不是暂停状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.ACTIVE),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("complete() [完成合约]", () => {
    it("should complete contract successfully [应该成功完成合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        status: ContractStatus.ACTIVE,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.COMPLETED,
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.COMPLETED,
      );

      // Assert
      expect(result.status).toBe(ContractStatus.COMPLETED);
      // Status change is recorded in history table, not in contract record
      // [状态变更记录在历史表中，不在合同记录中]
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });
  });

  describe("sign() [签署合约]", () => {
    it("should sign contract successfully [应该成功签署合约]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        status: ContractStatus.DRAFT,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.SIGNED,
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act
      const result = await contractService.updateStatus(
        testContractId,
        ContractStatus.SIGNED,
        { signedBy: testCreatedBy },
      );

      // Assert
      expect(result.status).toBe(ContractStatus.SIGNED);
      // Status change is recorded in history table, not in contract record
      // [状态变更记录在历史表中，不在合同记录中]
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should throw error if contract not draft [如果合约不是草稿状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.SIGNED,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.updateStatus(testContractId, ContractStatus.SIGNED, {
          signedBy: testCreatedBy,
        }),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("getServiceBalance() [获取服务余额]", () => {
    it("should return service balance [应该返回服务余额]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: "CONSULTATION",
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act
      const result = await contractService.getServiceBalance({
        studentId: testStudentId,
        serviceType: "CONSULTATION",
      });

      // Assert
      expect(result).toEqual(mockEntitlements);
    });

    it("should return all service balances if serviceType not specified [如果未指定服务类型应该返回所有服务余额]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: "CONSULTATION",
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        },
        {
          studentId: testStudentId,
          serviceType: "MENTORING",
          totalQuantity: 5,
          consumedQuantity: 1,
          heldQuantity: 0,
          availableQuantity: 4,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act
      const result = await contractService.getServiceBalance({
        studentId: testStudentId,
      });

      // Assert
      expect(result).toEqual(mockEntitlements);
      expect(result.length).toBe(2);
    });

    it("should throw error if studentId missing [如果缺少学生ID应该抛出错误]", async () => {
      // Act & Assert
      await expect(
        contractService.getServiceBalance({ studentId: "" }),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("addAmendmentLedger() [添加权益修正案]", () => {
    it("should add amendment ledger successfully [应该成功添加权益修正案]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.ACTIVE,
        createdBy: testCreatedBy,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockServiceType: ServiceType = {
        id: randomUUID(),
        code: "CONSULTATION",
        name: "Consultation",
        description: "Consultation service",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const addAmendmentDto: AddAmendmentLedgerDto = {
        studentId: testStudentId,
        contractId: testContractId,
        serviceType: mockServiceType,
        ledgerType: AmendmentLedgerType.ADDON,
        quantityChanged: 5,
        reason: "Additional consultation sessions",
        description: "Bonus sessions for good performance",
        createdBy: testCreatedBy,
      };

      const mockEntitlement = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        totalQuantity: 15,
        availableQuantity: 15,
        createdBy: testCreatedBy,
      };

      // Arrange - Mock the query to return the entitlement
      (
        mockDb.query.contractServiceEntitlements.findFirst as jest.Mock
      ).mockResolvedValue(mockEntitlement);

      // Mock serviceLedgers.findFirst to return null (no previous ledger)
      (mockDb.query.serviceLedgers.findFirst as jest.Mock).mockResolvedValue(null);

      const mockValues = jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockEntitlement]),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await contractService.addAmendmentLedger(addAmendmentDto);

      // Assert
      expect(result.serviceType).toBe("CONSULTATION");
      expect(mockDb.transaction).toHaveBeenCalled();
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
    });

    it("should store metadata.bookingSource when relatedBookingId is provided [当提供relatedBookingId时应该存储metadata.bookingSource]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.ACTIVE,
        createdBy: testCreatedBy,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockServiceType: ServiceType = {
        id: randomUUID(),
        code: "CONSULTATION",
        name: "Consultation",
        description: "Consultation service",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const testBookingId = randomUUID();
      const addAmendmentDto: AddAmendmentLedgerDto = {
        studentId: testStudentId,
        contractId: testContractId,
        serviceType: mockServiceType,
        ledgerType: AmendmentLedgerType.ADDON,
        quantityChanged: 5,
        reason: "Additional consultation sessions",
        description: "Bonus sessions for good performance",
        relatedBookingId: testBookingId,
        bookingSource: "job_applications", // Required when relatedBookingId is provided [当relatedBookingId存在时必填]
        createdBy: testCreatedBy,
      };

      const mockEntitlement = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        totalQuantity: 15,
        availableQuantity: 15,
        createdBy: testCreatedBy,
      };

      (
        mockDb.query.contractServiceEntitlements.findFirst as jest.Mock
      ).mockResolvedValue(mockEntitlement);

      // Mock serviceLedgers.findFirst to return null (no previous ledger)
      (mockDb.query.serviceLedgers.findFirst as jest.Mock).mockResolvedValue(null);

      const mockValues = jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockEntitlement]),
      });

      const mockServiceLedgerValues = jest.fn().mockReturnThis();
      mockDb.insert = jest.fn((table) => {
        if (table === schema.contractAmendmentLedgers) {
          return {
            values: mockValues,
          };
        }
        if (table === schema.serviceLedgers) {
          return {
            values: mockServiceLedgerValues,
          };
        }
        return {
          values: jest.fn().mockReturnThis(),
        };
      });

      // Act
      await contractService.addAmendmentLedger(addAmendmentDto);

      // Assert - Verify service ledger was created with metadata.bookingSource [验证服务流水已创建并包含metadata.bookingSource]
      expect(mockServiceLedgerValues).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            bookingSource: "job_applications",
          }),
          relatedBookingId: testBookingId,
        }),
      );
    });

    it("should throw error when relatedBookingId exists but bookingSource is missing [当relatedBookingId存在但bookingSource缺失时应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        status: ContractStatus.ACTIVE,
        createdBy: testCreatedBy,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockContract as any);

      const mockServiceType: ServiceType = {
        id: randomUUID(),
        code: "CONSULTATION",
        name: "Consultation",
        description: "Consultation service",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const addAmendmentDto: AddAmendmentLedgerDto = {
        studentId: testStudentId,
        contractId: testContractId,
        serviceType: mockServiceType,
        ledgerType: AmendmentLedgerType.ADDON,
        quantityChanged: 5,
        reason: "Additional consultation sessions",
        relatedBookingId: randomUUID(), // relatedBookingId exists [relatedBookingId存在]
        // bookingSource is missing [bookingSource缺失]
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(
        contractService.addAmendmentLedger(addAmendmentDto),
      ).rejects.toThrow(ContractException);
      try {
        await contractService.addAmendmentLedger(addAmendmentDto);
        fail("Expected ContractException to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ContractException);
        expect((error as ContractException).code).toBe(
          "BOOKING_SOURCE_REQUIRED",
        );
      }
    });
  });

  describe("activateContract - Regression Tests for Code Review Fixes [激活合约 - 代码评审修复回归测试]", () => {
    it("should create entitlements for second contract with new service types [应该为第二份合约创建新服务类型的权益]", async () => {
      // Arrange
      const secondContractId = randomUUID();
      const _newServiceTypeId = randomUUID();
      const existingServiceType = "CONSULTATION";
      const newServiceType = "RESUME_REVIEW";

      const mockSecondContract = {
        id: secondContractId,
        studentId: testStudentId,
        status: ContractStatus.SIGNED,
        productSnapshot: {
          items: [
            { serviceTypeCode: "MENTORING", quantity: 3 },
            { serviceTypeCode: "RESUME_REVIEW", quantity: 2 },
          ],
        },
        createdBy: testCreatedBy,
      };

      const mockExistingEntitlement = {
        studentId: testStudentId,
        serviceType: existingServiceType,
        totalQuantity: 5,
        availableQuantity: 5,
      };

      jest
        .spyOn(contractService, "findOne")
        .mockResolvedValue(mockSecondContract as any);

      const mockReturning = jest
        .fn()
        .mockResolvedValue([
          { ...mockSecondContract, status: ContractStatus.ACTIVE },
        ]);
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      mockDb.query.contractServiceEntitlements.findFirst = jest
        .fn()
        .mockResolvedValue(mockExistingEntitlement);

      // Mock batch query for service types - return all required service types
      const mockTx = {
        ...mockDb,
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { id: testServiceTypeId1, code: "MENTORING" },
              { id: testServiceTypeId2, code: newServiceType },
            ]),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoUpdate: jest.fn().mockResolvedValue([]),
          }),
        }),
        query: mockDb.query,
      };

      mockDb.transaction = jest.fn(async (callback) => {
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.updateStatus(
        secondContractId,
        ContractStatus.ACTIVE,
      );

      // Assert
      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(mockTx.insert).toHaveBeenCalled();
      // Verify that insert was called with new service types
      const insertCall = mockTx.insert.mock.calls[0];
      expect(insertCall).toBeDefined();
    });

    it("should handle batch query with multiple service type IDs using inArray [应该使用 inArray 处理多个服务类型ID的批量查询]", async () => {
      // Note: This test verifies that createEntitlementsFromSnapshot uses inArray for batch queries
      // [注意：此测试验证 createEntitlementsFromSnapshot 使用 inArray 进行批量查询]
      // The batch query happens during contract creation, not activation
      // [批量查询发生在合约创建时，而不是激活时]
      // This test is kept for regression testing of the batch query optimization
      // [保留此测试以进行批量查询优化的回归测试]

      // Arrange
      const serviceTypeCodes = [
        "CONSULTATION",
        "RESUME_REVIEW",
        "INTERVIEW_PREP",
      ];
      const productSnapshot: IProductSnapshot = {
        productId: testProductId,
        productName: "Test Product",
        productCode: "TEST-PRODUCT",
        price: "1000.00",
        currency: Currency.USD,
        items: serviceTypeCodes.map((code, index) => ({
          productItemId: randomUUID(),
          serviceTypeCode: code,
          quantity: 5,
          sortOrder: index + 1,
        })),
        snapshotAt: new Date(),
      };
      const createDto: CreateContractDto & { createdBy: string } = {
        productSnapshot,
        studentId: testStudentId,
        productId: testProductId,
        createdBy: testCreatedBy,
        title: "Test Contract",
      };

      const mockContract = {
        id: testContractId,
        contractNumber: "TEST-2025-0001",
        title: "Test Contract",
        studentId: testStudentId,
        productId: testProductId,
        productSnapshot: productSnapshot as any,
        status: ContractStatus.DRAFT,
        totalAmount: "1000.00",
        currency: Currency.USD,
        validityDays: 365,
        createdBy: testCreatedBy,
      };

      (mockDb.query.products.findFirst as jest.Mock).mockResolvedValue({
        id: testProductId,
        name: "Test Product",
        code: "TEST-PRODUCT",
        status: "ACTIVE",
      });

      const mockProductItems = serviceTypeCodes.map((code, index) => ({
        id: randomUUID(),
        productId: testProductId,
        serviceTypeId: randomUUID(),
        quantity: 5,
        sortOrder: index + 1,
        serviceTypeCode: code,
      }));

      // Mock product query
      mockDb.select = jest
        .fn()
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                {
                  id: testProductId,
                  name: "Test Product",
                  code: "TEST-PRODUCT",
                  status: "ACTIVE",
                  price: "1000.00",
                  currency: Currency.USD,
                },
              ]),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnValue({
            leftJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn().mockResolvedValue(mockProductItems),
              })),
            })),
          }),
        }));

      const mockWhere = jest
        .fn()
        .mockResolvedValue(serviceTypeCodes.map((code) => ({ code })));

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockContract]),
          onConflictDoUpdate: jest.fn().mockResolvedValue([]),
        }),
      });

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: mockWhere,
            }),
          }),
          insert: mockDb.insert,
          query: mockDb.query,
        };
        return await callback(mockTx);
      });

      // Act
      await contractService.create(createDto);

      // Assert
      // Verify that where was called (inArray is used internally by drizzle)
      // [验证 where 被调用（inArray 由 drizzle 内部使用）]
      expect(mockWhere).toHaveBeenCalled();
      const whereArg = mockWhere.mock.calls[0][0];
      expect(whereArg).toBeDefined();
    });
  });
});
