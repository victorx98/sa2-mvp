import { Module } from '@nestjs/common';
import { UserQueryRepository } from './repositories/user-query.repository';
import { USER_QUERY_REPOSITORY, IUserQueryRepository } from '../interfaces/user-query.repository.interface';
import { UserModule } from '@domains/identity/user/user.module';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleStudentQueryRepository } from './repositories/student-query.adapter';
import { DrizzleMentorQueryRepository } from './repositories/mentor-query.adapter';
import { DrizzleCounselorQueryRepository } from './repositories/counselor-query.adapter';
import { DrizzleSchoolQueryRepository } from './repositories/school-query.adapter';
import { DrizzleMajorQueryRepository } from './repositories/major-query.adapter';
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
    DatabaseModule,
  ],
  providers: [
    {
      provide: USER_QUERY_REPOSITORY,
      useClass: UserQueryRepository,
    },
    {
      provide: STUDENT_QUERY_REPOSITORY,
      useClass: DrizzleStudentQueryRepository,
    },
    {
      provide: MENTOR_QUERY_REPOSITORY,
      useClass: DrizzleMentorQueryRepository,
    },
    {
      provide: COUNSELOR_QUERY_REPOSITORY,
      useClass: DrizzleCounselorQueryRepository,
    },
    {
      provide: SCHOOL_QUERY_REPOSITORY,
      useClass: DrizzleSchoolQueryRepository,
    },
    {
      provide: MAJOR_QUERY_REPOSITORY,
      useClass: DrizzleMajorQueryRepository,
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
