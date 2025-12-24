import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ContractService } from "../contract.service";
import {
  ContractException,
  ContractNotFoundException,
} from "../../common/exceptions/contract.exception";
import { ContractStatus } from "@shared/types/contract-enums";
import { Currency } from "@shared/types/catalog-enums";
import { randomUUID } from "crypto";

/**
 * ContractService Update Unit Tests
 * [ContractService 更新单元测试]
 *
 * This file covers tests for the update() method
 * [此文件覆盖update()方法的测试]
 */
describe("ContractService - Update [ContractService - 更新]", () => {
  let moduleRef: TestingModule;
  let contractService: ContractService;
  let mockDb: any;
  const testContractId = randomUUID();

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn(),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      transaction: jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue([]),
          }),
        };
        return await callback(mockTx);
      }),
    };

    (mockDb.execute as jest.Mock).mockResolvedValue({
      rows: [{ contract_number: "TEST-2025-0001" }],
    });

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("update() - Update Contract [更新合约]", () => {
    it("should successfully update contract title [应该成功更新合约标题]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
        title: "Original Title",
      };

      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockContract]),
            }),
          }),
        });

      const updatedContract = {
        ...mockContract,
        title: "Updated Title",
        updatedAt: new Date(),
      };

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([updatedContract]),
              }),
            }),
          }),
          select: jest
            .fn()
            .mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockContract]),
                }),
              }),
            }),
        };
        const result = await callback(mockTx);
        return result;
      });

      // Act
      const result = await contractService.update(testContractId, {
        title: "Updated Title",
      });

      // Assert
      expect(result.title).toBe("Updated Title");
      expect(result.id).toBe(testContractId);
    });

    it("should update contract currency and amount [应该更新合约货币和金额]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
        currency: Currency.USD,
        totalAmount: 1000,
      };

      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockContract]),
            }),
          }),
        });

      const updatedContract = {
        ...mockContract,
        currency: Currency.CNY,
        totalAmount: 7000,
      };

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([updatedContract]),
              }),
            }),
          }),
          select: jest
            .fn()
            .mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockContract]),
                }),
              }),
            }),
        };
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.update(testContractId, {
        currency: Currency.CNY,
        totalAmount: 7000,
      });

      // Assert
      expect(result.currency).toBe(Currency.CNY);
      expect(result.totalAmount).toBe(7000);
    });

    it("should throw error if contract status is not DRAFT [如果合约状态不是草稿应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.ACTIVE, // Not DRAFT
      };

      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockContract]),
            }),
          }),
        });

      // Act & Assert
      await expect(contractService.update(testContractId, { title: "New Title" })).rejects.toThrow(
        ContractException
      );
    });

    it("should throw error if contract not found [如果合约未找到应该抛出错误]", async () => {
      // Arrange
      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act & Assert
      await expect(
        contractService.update(testContractId, { title: "New Title" }),
      ).rejects.toThrow(ContractNotFoundException);
    });

    it("should throw error if update DTO is empty [如果更新DTO为空应该抛出错误]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
      };

      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockContract]),
            }),
          }),
        });

      // Act & Assert
      await expect(contractService.update(testContractId, {})).rejects.toThrow(
        ContractException,
      );
    });

    it("should update with reason field [应该带原因字段更新]", async () => {
      // Arrange
      const mockContract = {
        id: testContractId,
        status: ContractStatus.DRAFT,
        title: "Original Title",
      };

      mockDb.select = jest
        .fn()
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockContract]),
            }),
          }),
        });

      const updatedContract = {
        ...mockContract,
        title: "Updated Title",
      };

      mockDb.transaction = jest.fn(async (callback) => {
        const mockTx = {
          ...mockDb,
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([updatedContract]),
              }),
            }),
          }),
          select: jest
            .fn()
            .mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockContract]),
                }),
              }),
            }),
        };
        return await callback(mockTx);
      });

      // Act
      const result = await contractService.update(testContractId, {
        title: "Updated Title",
        updateReason: "Corrected title spelling",
      });

      // Assert
      expect(result.title).toBe("Updated Title");
    });
  });
});
