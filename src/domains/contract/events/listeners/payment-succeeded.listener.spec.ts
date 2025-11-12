import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { PaymentSucceededListener } from "./payment-succeeded.listener";
import { ContractService } from "../../services/contract.service";
import { IEventPublisher } from "../../services/event-publisher.service";

// Suppress Logger for tests
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

describe("PaymentSucceededListener", () => {
  let listener: PaymentSucceededListener;
  let mockContractService: any;
  let mockEventPublisher: any;

  beforeEach(async () => {
    mockContractService = {
      findOne: jest.fn(),
      activate: jest.fn(),
    };

    mockEventPublisher = {
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentSucceededListener,
        {
          provide: ContractService,
          useValue: mockContractService,
        },
        {
          provide: "EVENT_PUBLISHER",
          useValue: mockEventPublisher,
        },
      ],
    }).compile();

    listener = module.get<PaymentSucceededListener>(PaymentSucceededListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should subscribe to payment.succeeded events", () => {
      // Act
      listener.onModuleInit();

      // Assert
      expect(mockEventPublisher.subscribe).toHaveBeenCalledWith(
        "payment.succeeded",
        expect.any(Function),
      );
    });
  });

  describe("handlePaymentSucceeded", () => {
    it("should activate contract successfully when payment succeeded", async () => {
      // Arrange
      const event = {
        id: "event-123",
        eventType: "payment.succeeded",
        payload: {
          contractId: "contract-456",
          amount: "1000.00",
          currency: "USD",
          paymentMethod: "stripe",
        },
      };

      const mockContract = {
        id: "contract-456",
        contractNumber: "CONTRACT-2025-01-00001",
        status: "signed",
        studentId: "student-123",
        totalAmount: "1000.00",
      };

      mockContractService.findOne.mockResolvedValue(mockContract);
      mockContractService.activate.mockResolvedValue({
        ...mockContract,
        status: "active",
        activatedAt: new Date(),
      });

      // Act
      await listener["handlePaymentSucceeded"](event);

      // Assert
      expect(mockContractService.findOne).toHaveBeenCalledWith({
        contractId: "contract-456",
      });
      expect(mockContractService.activate).toHaveBeenCalledWith("contract-456");
    });

    it("should not activate contract when status is not signed", async () => {
      // Arrange
      const event = {
        id: "event-123",
        eventType: "payment.succeeded",
        payload: {
          contractId: "contract-456",
          amount: "1000.00",
          currency: "USD",
        },
      };

      const mockContract = {
        id: "contract-456",
        status: "draft", // Not signed
      };

      mockContractService.findOne.mockResolvedValue(mockContract);

      // Act
      await listener["handlePaymentSucceeded"](event);

      // Assert
      expect(mockContractService.findOne).toHaveBeenCalled();
      expect(mockContractService.activate).not.toHaveBeenCalled();
    });

    it("should not activate contract when contract not found", async () => {
      // Arrange
      const event = {
        id: "event-123",
        eventType: "payment.succeeded",
        payload: {
          contractId: "contract-nonexistent",
          amount: "1000.00",
          currency: "USD",
        },
      };

      mockContractService.findOne.mockResolvedValue(null);

      // Act
      await listener["handlePaymentSucceeded"](event);

      // Assert
      expect(mockContractService.findOne).toHaveBeenCalled();
      expect(mockContractService.activate).not.toHaveBeenCalled();
    });

    it("should handle missing contractId", async () => {
      // Arrange
      const event = {
        id: "event-123",
        eventType: "payment.succeeded",
        payload: {
          amount: "1000.00",
          // Missing contractId
        },
      };

      // Act
      await listener["handlePaymentSucceeded"](event);

      // Assert
      expect(mockContractService.findOne).not.toHaveBeenCalled();
      expect(mockContractService.activate).not.toHaveBeenCalled();
    });

    it("should throw error for unexpected failures", async () => {
      // Arrange
      const event = {
        id: "event-123",
        eventType: "payment.succeeded",
        payload: {
          contractId: "contract-456",
          amount: "1000.00",
        },
      };

      mockContractService.findOne.mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(listener["handlePaymentSucceeded"](event)).rejects.toThrow(
        "Database error",
      );
    });
  });
});
