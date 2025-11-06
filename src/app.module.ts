import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthCommandModule } from './application/commands/auth-command/auth-command.module';
import { UserQueryModule } from './application/queries/user-query.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthCommandModule,
    UserQueryModule,
  ],
})
export class AppModule {}
