import { Module } from '@nestjs/common';
import { ServiceReferenceRepository } from './service-reference.repository';
import { ServiceRegistryService } from './services/service-registry.service';
import { PlacementApplicationSubmittedListener } from './listeners/placement-application-submitted.listener';

@Module({
  providers: [
    ServiceReferenceRepository,
    ServiceRegistryService,
    PlacementApplicationSubmittedListener,
  ],
  exports: [ServiceRegistryService],
})
export class ServiceRegistryModule {}
