import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleSessionTypeQueryRepository } from './repositories/drizzle-session-type-query.repository';
import { SESSION_TYPE_QUERY_REPOSITORY } from '../interfaces/session-type-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: SESSION_TYPE_QUERY_REPOSITORY,
      useClass: DrizzleSessionTypeQueryRepository,
    },
  ],
  exports: [SESSION_TYPE_QUERY_REPOSITORY],
})
export class SessionTypesQueryRepositoriesModule {}
