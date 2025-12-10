import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ServiceTypeRepository } from "./service-type.repository";
import { ServiceTypeService } from "./services/service-type.service";

/**
 * Service Type Module [服务类型模块]
 * Provides service type related services and repositories
 * [提供服务类型相关的服务和仓库]
 */
@Module({
  imports: [DatabaseModule],
  providers: [ServiceTypeRepository, ServiceTypeService],
  exports: [ServiceTypeRepository, ServiceTypeService],
})
export class ServiceTypeModule {}
