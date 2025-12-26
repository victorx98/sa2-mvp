import { Module } from '@nestjs/common';
import { ServicesQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { GetClassesUseCase } from './use-cases/get-classes.use-case';
import { GetClassMentorsUseCase } from './use-cases/get-class-mentors.use-case';
import { GetClassStudentsUseCase } from './use-cases/get-class-students.use-case';
import { GetClassCounselorsUseCase } from './use-cases/get-class-counselors.use-case';

@Module({
  imports: [ServicesQueryRepositoriesModule],
  providers: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
  ],
  exports: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
  ],
})
export class ServicesQueriesModule {}
