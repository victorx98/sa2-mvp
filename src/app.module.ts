import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommandModule } from './application/commands/auth-command/auth-command.module';
import { UserQueryModule } from './application/queries/user-query.module';
import { DatabaseConfig } from './infrastructure/database/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthCommandModule,
    UserQueryModule,
  ],
})
export class AppModule {}
