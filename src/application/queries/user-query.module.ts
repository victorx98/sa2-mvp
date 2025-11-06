import { Module } from "@nestjs/common";
import { UserQueryService } from "./user-query.service";
import { UserController } from "@api/controllers/user.controller";
import { UserRepository } from "@infrastructure/repositories/user.repository";
import { USER_REPOSITORY } from "@domains/identity/user/user-repository.interface";

@Module({
  imports: [],
  controllers: [UserController],
  providers: [
    UserQueryService,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [UserQueryService],
})
export class UserQueryModule {}
