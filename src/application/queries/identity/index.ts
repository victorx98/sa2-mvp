import { Module } from '@nestjs/common';
import { IdentityQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { GetUserUseCase } from './use-cases/get-user.use-case';

@Module({
  imports: [IdentityQueryRepositoriesModule],
  providers: [GetUserUseCase],
  exports: [GetUserUseCase],
})
export class IdentityModule {}
