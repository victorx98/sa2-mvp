import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleCommSessionQueryRepository } from './repositories/drizzle-comm-session-query.repository';
import { COMM_SESSION_QUERY_REPOSITORY } from '../interfaces/comm-session-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: COMM_SESSION_QUERY_REPOSITORY,
      useClass: DrizzleCommSessionQueryRepository,
    },
  ],
  exports: [COMM_SESSION_QUERY_REPOSITORY],
})
export class CommSessionsQueryRepositoriesModule {}
