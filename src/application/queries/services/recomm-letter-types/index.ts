import { Module } from '@nestjs/common';
import { RecommLetterTypesQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { GetRecommLetterTypesUseCase } from './use-cases/get-recomm-letter-types.use-case';

@Module({
  imports: [RecommLetterTypesQueryRepositoriesModule],
  providers: [GetRecommLetterTypesUseCase],
  exports: [GetRecommLetterTypesUseCase],
})
export class RecommLetterTypesModule {}
