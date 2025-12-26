import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { RecommLetterTypesRepository } from './infrastructure/repositories/recomm-letter-types.repository';
import { RecommLetterTypesService } from './services/recomm-letter-types.service';
import { RECOMM_LETTER_TYPES_REPOSITORY } from './repositories/recomm-letter-types.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: RECOMM_LETTER_TYPES_REPOSITORY,
      useClass: RecommLetterTypesRepository,
    },
    RecommLetterTypesService,
  ],
  exports: [RecommLetterTypesService],
})
export class RecommLetterTypesModule {}

