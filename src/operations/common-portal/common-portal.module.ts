import { Module } from '@nestjs/common';
import { AuthBffService } from './auth/auth.service';
import { UserBffService } from './user/user.service';
import { SessionBffService } from './session/session.service';
import { ApplicationModule } from '@application/application.module';

/**
 * Operations Layer - Common Portal Module
 * 职责：注册公共门户的 BFF Services
 *
 * 特点：
 * - 导入 ApplicationModule 以使用 Application Layer 服务
 * - 导出 BFF Services 供 Controller 使用
 */
@Module({
  imports: [
    ApplicationModule, // 导入 Application Layer
  ],
  providers: [
    AuthBffService,
    UserBffService,
    SessionBffService,
  ],
  exports: [
    AuthBffService,
    UserBffService,
    SessionBffService,
  ],
})
export class CommonPortalModule {}
