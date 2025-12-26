import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { CLASS_QUERY_REPOSITORY, IClassQueryRepository } from '../interfaces/class-query.repository.interface';
import { DrizzleClassQueryRepository } from './repositories/drizzle-class-query.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: CLASS_QUERY_REPOSITORY,
      useClass: DrizzleClassQueryRepository,
    },
  ],
  exports: [CLASS_QUERY_REPOSITORY],
})
export class ServicesQueryRepositoriesModule {}
