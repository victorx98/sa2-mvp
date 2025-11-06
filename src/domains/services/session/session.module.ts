import { Module } from '@nestjs/common';
import { SessionService } from './session.service';

/**
 * Domain Layer - Session Module
 */
@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
