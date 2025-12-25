/**
 * Identity Query Repositories Module
 * 身份查询仓储模块（学生、导师、顾问、学校、专业）
 */
import { Module } from '@nestjs/common';
import { QueryModule } from '@domains/query/query.module';
import {
  STUDENT_QUERY_REPOSITORY,
  MENTOR_QUERY_REPOSITORY,
  COUNSELOR_QUERY_REPOSITORY,
  SCHOOL_QUERY_REPOSITORY,
  MAJOR_QUERY_REPOSITORY,
} from '../interfaces/identity-query.repository.interface';
import { StudentQueryAdapter } from './repositories/student-query.adapter';
import { MentorQueryAdapter } from './repositories/mentor-query.adapter';
import { CounselorQueryAdapter } from './repositories/counselor-query.adapter';
import { SchoolQueryAdapter } from './repositories/school-query.adapter';
import { MajorQueryAdapter } from './repositories/major-query.adapter';

@Module({
  imports: [QueryModule],
  providers: [
    {
      provide: STUDENT_QUERY_REPOSITORY,
      useClass: StudentQueryAdapter,
    },
    {
      provide: MENTOR_QUERY_REPOSITORY,
      useClass: MentorQueryAdapter,
    },
    {
      provide: COUNSELOR_QUERY_REPOSITORY,
      useClass: CounselorQueryAdapter,
    },
    {
      provide: SCHOOL_QUERY_REPOSITORY,
      useClass: SchoolQueryAdapter,
    },
    {
      provide: MAJOR_QUERY_REPOSITORY,
      useClass: MajorQueryAdapter,
    },
  ],
  exports: [
    STUDENT_QUERY_REPOSITORY,
    MENTOR_QUERY_REPOSITORY,
    COUNSELOR_QUERY_REPOSITORY,
    SCHOOL_QUERY_REPOSITORY,
    MAJOR_QUERY_REPOSITORY,
  ],
})
export class IdentityQueryRepositoriesModule {}

