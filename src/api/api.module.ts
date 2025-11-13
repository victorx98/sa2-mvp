import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { UserController } from "./controllers/user.controller";
import { SessionController } from "./controllers/session.controller";
import { CounselorSessionsController } from "./controllers/counselor/counselor-sessions.controller";
import { MentorStudentsController } from "./controllers/mentor/mentor-students.controller";
import { CounselorStudentsController } from "./controllers/counselor/counselor-students.controller";
import { ApplicationModule } from "@application/application.module";

/**
 * API Layer - Root Module
 * 职责：
 * 1. 注册所有 Controllers
 * 2. 直接导入 Application Layer（去掉 BFF 层）
 */
@Module({
  imports: [
    ApplicationModule, // 直接导入 Application Layer（去掉 Operations Layer）
  ],
  controllers: [
    // Common Controllers
    AuthController,
    UserController,
    SessionController,

    // Counselor Controllers
    CounselorSessionsController,
    CounselorStudentsController,

    // Mentor Controllers
    MentorStudentsController,
  ],
})
export class ApiModule {}
