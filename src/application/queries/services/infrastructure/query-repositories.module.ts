import { Module } from '@nestjs/common';
import { ClassQueryRepositoriesModule } from '../class/infrastructure/query-repositories.module';

@Module({
  imports: [ClassQueryRepositoriesModule],
  exports: [ClassQueryRepositoriesModule],
})
export class ServicesQueryRepositoriesModule {}
