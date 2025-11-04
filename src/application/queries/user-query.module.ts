import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserQueryService } from './user-query.service';
import { UserController } from '@api/controllers/user.controller';
import { UserEntity } from '@infrastructure/database/entities/user.entity';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { USER_REPOSITORY } from '@domains/identity/user/user-repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
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
