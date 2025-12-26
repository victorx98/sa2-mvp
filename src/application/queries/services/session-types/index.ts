import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { SessionTypesQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { GetSessionTypesUseCase } from './use-cases/get-session-types.use-case';

@Module({
  imports: [DatabaseModule, SessionTypesQueryRepositoriesModule],
  providers: [GetSessionTypesUseCase],
  exports: [GetSessionTypesUseCase],
})
export class SessionTypesModule {}
