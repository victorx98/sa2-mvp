import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { UserController } from "./controllers/user.controller";
import { SessionController } from "./controllers/session.controller";
import { CounselorSessionsController } from "./controllers/counselor/counselor-sessions.controller";
import { CounselorStudentContractController } from "./controllers/counselor/counselor-student-contract.controller";
import { CounselorsController } from "./controllers/counselor/counselors.controller";
import { MentorsController } from "./controllers/mentor/mentors.controller";
import { ReferenceDataController } from "./controllers/reference-data.controller";
import { StudentsController } from "./controllers/student/students.controller";
import { StudentProfileController } from "./controllers/student/student-profile.controller";
import { MentorProfileController } from "./controllers/mentor/mentor-profile.controller";
import { CounselorProfileController } from "./controllers/counselor/counselor-profile.controller";
import { AdminProductsController } from "./controllers/admin/products.controller";
import { AdminContractsController } from "./controllers/admin/contracts.controller";
import { AdminFinancialController } from "./controllers/admin/financial.controller";
import { AdminPlacementController } from "./controllers/admin/placement.controller";
import { AdminServiceTypesController } from "./controllers/admin/service-types.controller";
import { SessionTypesController } from "./controllers/services/session-types.controller";
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
    ReferenceDataController,

    // Service Controllers
    SessionTypesController,

    // Admin Controllers
    AdminProductsController,
    AdminContractsController,
    AdminFinancialController,
    AdminPlacementController,
    AdminServiceTypesController,

    // Counselor Controllers
    CounselorSessionsController,
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
