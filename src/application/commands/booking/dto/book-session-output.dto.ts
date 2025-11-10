/**
 * Application Layer - Book Session Output DTO
 * BookSessionCommand 的返回结果
 */
import { SessionBookedEvent } from "@shared/events/session-booked.event";

export type BookSessionOutput = Omit<SessionBookedEvent, "counselorId"> & {
  status: string;
};
