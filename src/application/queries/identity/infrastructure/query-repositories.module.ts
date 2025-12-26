import { Module } from '@nestjs/common';
import { UserQueryRepository } from './repositories/user-query.repository';
import { USER_QUERY_REPOSITORY, IUserQueryRepository } from '../interfaces/user-query.repository.interface';
import { UserModule } from '@domains/identity/user/user.module';
import { QueryModule } from '@domains/query/query.module';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { StudentQueryAdapter } from './repositories/student-query.adapter';
import { MentorQueryAdapter } from './repositories/mentor-query.adapter';
import { DrizzleCounselorQueryRepository } from './repositories/counselor-query.adapter';
import { SchoolQueryAdapter } from './repositories/school-query.adapter';
import { MajorQueryAdapter } from './repositories/major-query.adapter';
import {
  STUDENT_QUERY_REPOSITORY,
  MENTOR_QUERY_REPOSITORY,
  COUNSELOR_QUERY_REPOSITORY,
  SCHOOL_QUERY_REPOSITORY,
  MAJOR_QUERY_REPOSITORY,
} from '../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Module({
  imports: [
    UserModule,
    QueryModule,
    DatabaseModule,
  ],
  providers: [
    {
      provide: USER_QUERY_REPOSITORY,
      useClass: UserQueryRepository,
    },
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
      useClass: DrizzleCounselorQueryRepository,
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
    USER_QUERY_REPOSITORY,
    STUDENT_QUERY_REPOSITORY,
    MENTOR_QUERY_REPOSITORY,
    COUNSELOR_QUERY_REPOSITORY,
    SCHOOL_QUERY_REPOSITORY,
    MAJOR_QUERY_REPOSITORY,
  ],
})
export class IdentityQueryRepositoriesModule {}
