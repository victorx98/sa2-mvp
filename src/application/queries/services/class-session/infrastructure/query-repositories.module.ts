import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleClassSessionQueryRepository } from './repositories/drizzle-class-session-query.repository';
import { CLASS_SESSION_QUERY_REPOSITORY } from '../interfaces/class-session-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: CLASS_SESSION_QUERY_REPOSITORY,
      useClass: DrizzleClassSessionQueryRepository,
    },
  ],
  exports: [CLASS_SESSION_QUERY_REPOSITORY],
})
export class ClassSessionsQueryRepositoriesModule {}
