import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { SessionTypesModule } from './session-types/session-types.module';
import { ServiceRegistryModule } from './service-registry/service-registry.module';
import { ClassModule } from './class/class.module';
import { CommSessionsModule } from './comm-sessions/comm-sessions.module';
import { ResumeModule } from './resume/resume.module';
import { RecommLetterTypesModule } from './recomm-letter-types/recomm-letter-types.module';
import { RecommLetterModule } from './recomm-letter/recomm-letter.module';

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
    RecommLetterTypesModule,
    RecommLetterModule,
  ],
  exports: [
    SessionsModule,
    SessionTypesModule,
    ServiceRegistryModule,
    ClassModule,
    CommSessionsModule,
    ResumeModule,
    RecommLetterTypesModule,
    RecommLetterModule,
  ],
})
export class ServicesModule {}

