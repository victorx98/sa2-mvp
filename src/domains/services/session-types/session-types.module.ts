import { Module } from '@nestjs/common';
import { SessionTypesRepository } from './session-types.repository';
import { SessionTypesService } from './services/session-types.service';
import { SessionTypesQueryService } from './services/session-types-query.service';

@Module({
  providers: [
    SessionTypesRepository,
    SessionTypesService,
    SessionTypesQueryService,
  ],
  exports: [SessionTypesService, SessionTypesQueryService, SessionTypesRepository],
})
export class SessionTypesModule {}

