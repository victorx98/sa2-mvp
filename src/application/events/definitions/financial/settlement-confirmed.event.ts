import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const SettlementConfirmedPayloadSchema = z
  .object({
    settlementId: UuidSchema,
    mentorId: UuidSchema,
    settlementMonth: z.string(),
    originalAmount: z.number(),
    targetAmount: z.number(),
    originalCurrency: z.string(),
    targetCurrency: z.string(),
    exchangeRate: z.number(),
    deductionRate: z.number(),
    settlementMethod: z.string(),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    payableLedgerIds: z.array(z.string()),
  })
  .passthrough();

export type SettlementConfirmedPayload = z.infer<
  typeof SettlementConfirmedPayloadSchema
>;

@IntegrationEvent({
  type: "financial.settlement.confirmed",
  version: "1.0",
  producers: ["GenerateSettlementCommand", "SettlementService"],
  description: "Emitted when a settlement is confirmed.",
})
export class SettlementConfirmedEvent extends BaseIntegrationEvent<SettlementConfirmedPayload> {
  static readonly eventType = "financial.settlement.confirmed";
  static readonly schema = SettlementConfirmedPayloadSchema;
}
