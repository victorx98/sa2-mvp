import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ContractService } from "./contract.service";
import { CreateContractDto } from "../dto/create-contract.dto";
import { FindOneContractDto } from "../dto/find-one-contract.dto";
import { ContractException, ContractNotFoundException } from "../common/exceptions/contract.exception";
import { ConsumeServiceDto } from "../dto/consume-service.dto";
import { AddAmendmentLedgerDto } from "../dto/add-amendment-ledger.dto";
import { Currency } from "@shared/types/catalog-enums";
import { ContractStatus, AmendmentLedgerType } from "@shared/types/contract-enums";
import { IProductSnapshot } from "../common/types/snapshot.types";
import { randomUUID } from "crypto";
import type { ServiceType } from "@infrastructure/database/schema";

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
  let eventEmitter: EventEmitter2;
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
          where: jest.fn(() => ({
            limit: jest.fn(),
            for: jest.fn(() => []),
          })),
          limit: jest.fn(() => []),
          offset: jest.fn(() => []),
          orderBy: jest.fn(() => []),
          forUpdate: jest.fn(() => []),
        })),
        limit: jest.fn(() => []),
        where: jest.fn(() => ({
          forUpdate: jest.fn(() => []),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(),
          onConflictDoUpdate: jest.fn(),
        })),
        onConflictDoUpdate: jest.fn(),
      })),
      delete: jest.fn(),
      transaction: jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
        };
        return await callback(mockTx);
      }),
    };

    // Setup default mocks
    (mockDb.execute as jest.Mock).mockResolvedValue({
      rows: [{ contract_number: "TEST-2025-0001" }],
    });

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ".env",
      }), EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: ".",
        verboseMemoryLeak: false,
      })],
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        ContractService,
      ],
    }).compile();

    contractService = moduleRef.get<ContractService>(ContractService);
    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create() [创建合约]", () => {
    it("should create contract successfully [应该成功创建合约]", async () => {
      // Arrange
      const productSnapshot: IProductSnapshot = {
        productId: testProductId,
        productName: "Test Product",
        productCode: "TEST-PRODUCT",
        price: "1000.00",
        currency: Currency.USD,
        items: [],
        snapshotAt: new Date(),
      };
      const createDto: CreateContractDto = {
        productSnapshot,
        studentId: testStudentId,
        productId: testProductId,
        createdBy: testCreatedBy,
        signedAt: new Date(),
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
        signedAt: new Date(),
        expiresAt: new Date(),
        createdBy: testCreatedBy,
      };

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([mockContract]);

      mockDb.insert = jest.fn().mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.create(createDto);

      // Assert
      expect(result).toEqual(mockContract);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("contract.signed", expect.objectContaining({
        contractId: mockContract.id,
        contractNumber: "TEST-2025-0001",
        studentId: testStudentId,
        productId: testProductId,
      }));
    });

    it("should reject negative price [应该拒绝负价格]", async () => {
      // Arrange
      const createDto: CreateContractDto = {
        productSnapshot: {
          productId: testProductId,
          productName: "Test Product",
          productCode: "TEST-PRODUCT",
          price: "-100",
          currency: Currency.USD,
          items: [],
          snapshotAt: new Date(),
        } as IProductSnapshot,
        studentId: testStudentId,
        productId: testProductId,
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(contractService.create(createDto)).rejects.toThrow(ContractException);
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
      const result = await contractService.findOne({ contractId: testContractId });

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
      const result = await contractService.findOne({ contractNumber: "TEST-2025-0001" });

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
        contractService.findOne({ status: ContractStatus.SIGNED } as FindOneContractDto),
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
          items: [
            { productItemId: randomUUID(), serviceTypeId: testServiceTypeId1, quantity: 5, sortOrder: 1 },
            { productItemId: randomUUID(), serviceTypeId: testServiceTypeId2, quantity: 10, sortOrder: 2 },
          ],
        } as IProductSnapshot,
        createdBy: testCreatedBy,
      };

      // Mock findOne - use spy instead of overriding mockDb.select
      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

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
        from: jest.fn()
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
                returning: jest.fn().mockResolvedValue([{
                  ...mockContract,
                  status: ContractStatus.ACTIVE,
                  activatedAt: new Date(),
                }]),
              }),
            }),
          }),
        };
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.activate(testContractId);

      // Assert
      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error if contract not found [如果合约未找到应该抛出错误]", async () => {
      // Arrange
      jest.spyOn(contractService, "findOne").mockResolvedValue(null);

      // Act & Assert
      await expect(contractService.activate(testContractId)).rejects.toThrow(ContractNotFoundException);
    });

    it("should throw error if contract already active [如果合约已激活应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(contractService.activate(testContractId)).rejects.toThrow(ContractException);
    });

    it("should throw error if contract not in signed status [如果合约不在已签署状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(contractService.activate(testContractId)).rejects.toThrow(ContractException);
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
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        { studentId: testStudentId, serviceType: "CONSULTATION", availableQuantity: 5, consumedQuantity: 0 },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue(mockEntitlements),
          }),
        }),
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

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
      await contractService.consumeService(consumeDto);

      // Assert
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("service.consumed", expect.objectContaining({
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 1,
      }));
    });

    it("should throw error if insufficient balance [如果余额不足应该抛出错误]", async () => {
      // Arrange
      const consumeDto: ConsumeServiceDto = {
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 10,
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        { studentId: testStudentId, serviceType: "CONSULTATION", availableQuantity: 5, consumedQuantity: 0 },
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
      await expect(contractService.consumeService(consumeDto)).rejects.toThrow(ContractException);
    });

    it("should throw error if no entitlements found [如果未找到权益应该抛出错误]", async () => {
      // Arrange
      const consumeDto: ConsumeServiceDto = {
        studentId: testStudentId,
        serviceType: "CONSULTATION",
        quantity: 1,
        createdBy: testCreatedBy,
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
      await expect(contractService.consumeService(consumeDto)).rejects.toThrow(ContractNotFoundException);
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

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

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

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.terminate(testContractId, "User requested termination", testCreatedBy);

      // Assert
      expect(result.status).toBe(ContractStatus.TERMINATED);
      expect(result.terminatedAt).toBeDefined();
      expect(emitSpy).toHaveBeenCalledWith("contract.terminated", expect.objectContaining({
        contractId: testContractId,
        contractNumber: "TEST-2025-0001",
        reason: "User requested termination",
        terminatedBy: testCreatedBy,
      }));
    });

    it("should throw error if contract not active or suspended [如果合约不是激活或暂停状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.terminate(testContractId, "Test reason", testCreatedBy),
      ).rejects.toThrow(ContractException);
    });

    it("should throw error if reason is empty [如果原因为空应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.terminate(testContractId, "", testCreatedBy),
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

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.SUSPENDED,
        suspendedAt: new Date(),
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.suspend(testContractId, "Payment overdue", testCreatedBy);

      // Assert
      expect(result.status).toBe(ContractStatus.SUSPENDED);
      expect(result.suspendedAt).toBeDefined();
      expect(emitSpy).toHaveBeenCalledWith("contract.suspended", expect.objectContaining({
        contractId: testContractId,
        contractNumber: "TEST-2025-0001",
        reason: "Payment overdue",
        suspendedBy: testCreatedBy,
      }));
    });

    it("should throw error if contract not active [如果合约不是激活状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(
        contractService.suspend(testContractId, "Test reason", testCreatedBy),
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
        suspendedAt: new Date(),
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.ACTIVE,
        suspendedAt: null,
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.resume(testContractId, testCreatedBy);

      // Assert
      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(result.suspendedAt).toBeNull();
      expect(emitSpy).toHaveBeenCalledWith("contract.resumed", expect.objectContaining({
        contractId: testContractId,
        contractNumber: "TEST-2025-0001",
        resumedBy: testCreatedBy,
      }));
    });

    it("should throw error if contract not suspended [如果合约不是暂停状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(contractService.resume(testContractId, testCreatedBy)).rejects.toThrow(ContractException);
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

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.COMPLETED,
        completedAt: new Date(),
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.complete(testContractId, testCreatedBy);

      // Assert
      expect(result.status).toBe(ContractStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(emitSpy).toHaveBeenCalledWith("contract.completed", expect.objectContaining({
        contractId: testContractId,
        contractNumber: "TEST-2025-0001",
        completedBy: testCreatedBy,
        isAutoCompleted: false,
      }));
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

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      const mockUpdatedContract = {
        ...mockContract,
        status: ContractStatus.SIGNED,
        signedAt: new Date(),
      };

      const mockReturning = jest.fn().mockResolvedValue([mockUpdatedContract]);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.sign(testContractId, testCreatedBy);

      // Assert
      expect(result.status).toBe(ContractStatus.SIGNED);
      expect(result.signedAt).toBeDefined();
      expect(emitSpy).toHaveBeenCalledWith("contract.signed", expect.objectContaining({
        contractId: testContractId,
        contractNumber: "TEST-2025-0001",
        signedBy: testCreatedBy,
      }));
    });

    it("should throw error if contract not draft [如果合约不是草稿状态应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.SIGNED,
      };

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

      // Act & Assert
      await expect(contractService.sign(testContractId, testCreatedBy)).rejects.toThrow(ContractException);
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

      jest.spyOn(contractService, "findOne").mockResolvedValue(mockContract as any);

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

      const mockValues = jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockEntitlement]),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: mockValues,
      });

      const emitSpy = jest.spyOn(eventEmitter, "emit");

      // Act
      const result = await contractService.addAmendmentLedger(addAmendmentDto);

      // Assert
      expect(result.serviceType).toBe("CONSULTATION");
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("entitlement.added", expect.objectContaining({
        contractId: testContractId,
        serviceType: mockServiceType,
        quantity: 5,
        status: "active",
      }));
    });
  });
});
