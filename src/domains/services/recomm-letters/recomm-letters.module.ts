import { Module } from '@nestjs/common';
import { RecommLettersRepository } from './infrastructure/repositories/recomm-letters.repository';
import { RECOMM_LETTERS_REPOSITORY } from './repositories/recomm-letters.repository.interface';

@Module({
  providers: [
    {
      provide: RECOMM_LETTERS_REPOSITORY,
      useClass: RecommLettersRepository,
    },
  ],
  exports: [RECOMM_LETTERS_REPOSITORY],
})
export class RecommLettersModule {}

