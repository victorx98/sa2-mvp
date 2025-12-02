import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth/auth.controller";
import { UserController } from "./controllers/users/user.controller";
import { SessionController } from "./controllers/sessions/sessions.controller";
import { CounselorStudentContractController } from "./controllers/counselors/counselor-student-contract.controller";
import { CounselorsController } from "./controllers/counselors/counselors.controller";
import { MentorsController } from "./controllers/mentors/mentors.controller";
import { SchoolsController } from "./controllers/references/schools.controller";
import { MajorsController } from "./controllers/references/majors.controller";
import { StudentsController } from "./controllers/students/students.controller";
import { StudentProfileController } from "./controllers/students/student-profile.controller";
import { MentorProfileController } from "./controllers/mentors/mentor-profile.controller";
import { CounselorProfileController } from "./controllers/counselors/counselor-profile.controller";
import { ApplicationModule } from "@application/application.module";
import { WebhookModule } from "@core/webhook/webhook.module";

/**
 * API Layer - Root Module
 * 职责：
 * 1. 注册所有 Controllers
 * 2. 直接导入 Application Layer（去掉 BFF 层）
 */
@Module({
  imports: [
    // Application Layer for business logic
    ApplicationModule,
    
    // Webhook Module for receiving webhook events from Feishu and Zoom
    WebhookModule,
  ],
  controllers: [
    // Common Controllers
    AuthController,
    UserController,
    SessionController,
    
    // Reference Data Controllers
    SchoolsController,
    MajorsController,

    // Counselor Controllers
    CounselorStudentContractController,
    CounselorProfileController,
    CounselorsController,

    // Mentor Controllers
    MentorsController,
    MentorProfileController,

    // Student Controllers
    StudentsController,
    StudentProfileController,
  ],
})
export class ApiModule {}
