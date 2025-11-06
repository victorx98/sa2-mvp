import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ServicePackageService } from "./services/service-package.service";
import { ServiceModule } from "../service/service.module";

@Module({
  imports: [DatabaseModule, ServiceModule],
  providers: [ServicePackageService],
  exports: [ServicePackageService],
})
export class ServicePackageModule {}
