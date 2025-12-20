import { Global, Module } from "@nestjs/common";
import { VerifiedEventBus } from "./verified-event-bus";

@Global()
@Module({
  providers: [VerifiedEventBus],
  exports: [VerifiedEventBus],
})
export class EventingModule {}

