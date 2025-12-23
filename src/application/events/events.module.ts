import { Global, Module } from "@nestjs/common";
import { IntegrationEventPublisher } from "./publisher";
import "./definitions";

@Global()
@Module({
  providers: [IntegrationEventPublisher],
  exports: [IntegrationEventPublisher],
})
export class EventsModule {}
