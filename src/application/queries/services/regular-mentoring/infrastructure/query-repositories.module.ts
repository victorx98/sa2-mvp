import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleRegularMentoringQueryRepository } from './repositories/drizzle-regular-mentoring-query.repository';
import { REGULAR_MENTORING_QUERY_REPOSITORY } from '../interfaces/regular-mentoring-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: REGULAR_MENTORING_QUERY_REPOSITORY,
      useClass: DrizzleRegularMentoringQueryRepository,
    },
  ],
  exports: [REGULAR_MENTORING_QUERY_REPOSITORY],
})
export class RegularMentoringQueryRepositoriesModule {}
