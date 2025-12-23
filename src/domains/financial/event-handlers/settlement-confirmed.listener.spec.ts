import { Test, TestingModule } from "@nestjs/testing";
import { SettlementConfirmedListener } from "@application/events/handlers/financial/settlement-confirmed.listener";
import { IMentorPaymentParamService } from "@domains/financial/interfaces/mentor-payment-param.interface";
import { SettlementConfirmedEvent } from "@application/events";

describe("SettlementConfirmedListener", () => {
  let listener: SettlementConfirmedListener;
  let mockPaymentParamService: jest.Mocked<IMentorPaymentParamService>;

  beforeEach(async () => {
    mockPaymentParamService = {
      updateOrCreateDefaultParams: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementConfirmedListener,
        {
          provide: "IMentorPaymentParamService",
          useValue: mockPaymentParamService,
        },
      ],
    }).compile();

    listener = module.get<SettlementConfirmedListener>(
      SettlementConfirmedListener,
    );
  });

  describe("handleSettlementConfirmed", () => {
    const validEvent = new SettlementConfirmedEvent({
      settlementId: "settlement-123",
      mentorId: "mentor-123",
      settlementMonth: "2024-01",
      originalAmount: 1000,
      targetAmount: 850,
      originalCurrency: "USD",
      targetCurrency: "CNY",
      exchangeRate: 7.0,
      deductionRate: 0.15,
      settlementMethod: "DOMESTIC_TRANSFER",
      createdBy: "user-123",
      createdAt: new Date(),
      payableLedgerIds: ["ledger-1", "ledger-2"],
    });

    it("should process settlement confirmed event successfully", async () => {
      mockPaymentParamService.updateOrCreateDefaultParams.mockResolvedValue();

      await listener.handleSettlementConfirmed(validEvent);

      expect(
        mockPaymentParamService.updateOrCreateDefaultParams,
      ).toHaveBeenCalledWith(
        "CNY",
        "2024-01",
        {
          defaultExchangeRate: 7.0,
          defaultDeductionRate: 0.15,
        },
        "user-123",
      );
    });

    it("should handle errors gracefully", async () => {
      mockPaymentParamService.updateOrCreateDefaultParams.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        listener.handleSettlementConfirmed(validEvent),
      ).resolves.not.toThrow();
    });
  });
});
