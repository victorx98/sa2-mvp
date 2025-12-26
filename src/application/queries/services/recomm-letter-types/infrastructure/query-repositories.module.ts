import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleRecommLetterTypeQueryRepository } from './repositories/drizzle-recomm-letter-type-query.repository';
import { RECOMM_LETTER_TYPE_QUERY_REPOSITORY } from '../interfaces/recomm-letter-type-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: RECOMM_LETTER_TYPE_QUERY_REPOSITORY,
      useClass: DrizzleRecommLetterTypeQueryRepository,
    },
  ],
  exports: [RECOMM_LETTER_TYPE_QUERY_REPOSITORY],
})
export class RecommLetterTypesQueryRepositoriesModule {}
