import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { SessionTypesModule } from './session-types/session-types.module';
import { ServiceRegistryModule } from './service-registry/service-registry.module';
import { ClassModule } from './class/class.module';
import { CommSessionsModule } from './comm-sessions/comm-sessions.module';
import { ResumeModule } from './resume/resume.module';

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
    ClassModule,
    CommSessionsModule,
    ResumeModule,
  ],
  exports: [
    SessionsModule,
    SessionTypesModule,
    ServiceRegistryModule,
    ClassModule,
    CommSessionsModule,
    ResumeModule,
  ],
})
export class ServicesModule {}

