import { Module } from '@nestjs/common';
import { ServiceReferenceRepository } from './service-reference.repository';
import { ServiceRegistryService } from './services/service-registry.service';

@Module({
  providers: [ServiceReferenceRepository, ServiceRegistryService],
  exports: [ServiceRegistryService],
})
export class ServiceRegistryModule {}

