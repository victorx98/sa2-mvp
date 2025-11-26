import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { SessionTypesModule } from './session-types/session-types.module';
import { ServiceRegistryModule } from './service-registry/service-registry.module';

/**
 * Services Domain Module
 * 
 * Top-level module for all service-related domains
 */
@Module({
  imports: [
    SessionsModule,
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  exports: [
    SessionsModule,
    SessionTypesModule,
    ServiceRegistryModule,
  ],
})
export class ServicesModule {}

