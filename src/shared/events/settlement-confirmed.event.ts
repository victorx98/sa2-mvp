import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { SETTLEMENT_CONFIRMED_EVENT } from "./event-constants";

export { SETTLEMENT_CONFIRMED_EVENT };

/**
 * Payload for settlement confirmed event
 * 结算确认事件载荷
 */
export const SettlementConfirmedPayloadSchema = z.object({
  settlementId: z.string().min(1),
  mentorId: z.string().min(1),
  settlementMonth: z.string().min(1),
  originalAmount: z.number(),
  targetAmount: z.number(),
  originalCurrency: z.string().min(1),
  targetCurrency: z.string().min(1),
  exchangeRate: z.number(),
  deductionRate: z.number(),
  settlementMethod: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.date(),
  payableLedgerIds: z.array(z.string().min(1)),
});

export type ISettlementConfirmedPayload = z.infer<typeof SettlementConfirmedPayloadSchema>;

@IntegrationEvent({
  type: SETTLEMENT_CONFIRMED_EVENT,
  version: "1.0",
  producers: ["FinancialModule"],
  description: "Emitted when a settlement record is created and confirmed",
})
export class SettlementConfirmedEvent implements IEvent<ISettlementConfirmedPayload> {
  static readonly eventType = SETTLEMENT_CONFIRMED_EVENT;
  static readonly schema = SettlementConfirmedPayloadSchema;

  readonly type = SettlementConfirmedEvent.eventType;

  constructor(
    public readonly payload: ISettlementConfirmedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type ISettlementConfirmedEvent = SettlementConfirmedEvent;
