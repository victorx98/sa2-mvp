import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ServiceService } from "./services/service.service";

@Module({
  imports: [DatabaseModule],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
