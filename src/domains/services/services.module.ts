import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { SessionTypesModule } from './session-types/session-types.module';
import { ServiceRegistryModule } from './service-registry/service-registry.module';
import { ClassSessionsModule } from './class-sessions/class-sessions.module';
import { CommSessionsModule } from './comm-sessions/comm-sessions.module';

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
    ClassSessionsModule,
    CommSessionsModule,
  ],
  exports: [
    SessionsModule,
    SessionTypesModule,
    ServiceRegistryModule,
    ClassSessionsModule,
    CommSessionsModule,
  ],
})
export class ServicesModule {}

