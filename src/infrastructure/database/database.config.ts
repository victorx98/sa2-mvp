import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.configService.get<string>('DATABASE_URL'),
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: false, // Set to false in production
      logging: this.configService.get('NODE_ENV') === 'development',
      ssl: {
        rejectUnauthorized: false, // Required for Supabase
      },
    };
  }
}
