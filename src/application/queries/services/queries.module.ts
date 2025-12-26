import { Module } from '@nestjs/common';
import { ServicesQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { SessionTypesQueryRepositoriesModule } from './session-types/infrastructure/query-repositories.module';
import { RecommLetterTypesQueryRepositoriesModule } from './recomm-letter-types/infrastructure/query-repositories.module';
import { GetClassesUseCase } from './use-cases/get-classes.use-case';
import { GetClassMentorsUseCase } from './use-cases/get-class-mentors.use-case';
import { GetClassStudentsUseCase } from './use-cases/get-class-students.use-case';
import { GetClassCounselorsUseCase } from './use-cases/get-class-counselors.use-case';
import { GetSessionTypesUseCase } from './session-types/use-cases/get-session-types.use-case';
import { GetRecommLetterTypesUseCase } from './recomm-letter-types/use-cases/get-recomm-letter-types.use-case';

@Module({
  imports: [
    ServicesQueryRepositoriesModule,
    SessionTypesQueryRepositoriesModule,
    RecommLetterTypesQueryRepositoriesModule,
  ],
  providers: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
  ],
  exports: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
  ],
})
export class ServicesQueriesModule {}
