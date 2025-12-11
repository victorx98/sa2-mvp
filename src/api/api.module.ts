import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/identity/auth.controller";
import { UserController } from "./controllers/identity/user.controller";
import { SessionController } from "./controllers/sessions/sessions.controller";
import { CounselorStudentContractController } from "./controllers/identity/counselor-student-contract.controller";
import { CounselorsController } from "./controllers/identity/counselors.controller";
import { MentorsController } from "./controllers/identity/mentors.controller";
import { SchoolsController } from "./controllers/references/schools.controller";
import { MajorsController } from "./controllers/references/majors.controller";
import { StudentsController } from "./controllers/identity/students.controller";
import { StudentProfileController } from "./controllers/identity/student-profile.controller";
import { MentorProfileController } from "./controllers/identity/mentor-profile.controller";
import { CounselorProfileController } from "./controllers/identity/counselor-profile.controller";
import { ApplicationModule } from "@application/application.module";
import { WebhookModule } from "@core/webhook/webhook.module";
import { RegularMentoringController } from "./controllers/services/regular-mentoring.controller";
import { GapAnalysisController } from "./controllers/services/gap-analysis.controller";
import { AiCareerController } from "./controllers/services/ai-career.controller";
import { CommSessionController } from "./controllers/services/comm-session.controller";
import { ProductsController } from "./controllers/catalog/products.controller";
import { ContractsController } from "./controllers/contract/contracts.controller";
import { FinancialController } from "./controllers/financial/financial.controller";
import { PlacementController } from "./controllers/placement/placement.controller";
import { SessionController as UnifiedSessionController } from "./controllers/services/session.controller";

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
    
    // Service Controllers (Unified + Legacy)
    UnifiedSessionController, // New unified API endpoint
    RegularMentoringController, // Legacy - kept for backward compatibility
    GapAnalysisController, // Legacy - kept for backward compatibility
    AiCareerController, // Legacy - kept for backward compatibility
    CommSessionController,
    // Mentor Controllers
    MentorsController,
    MentorProfileController,

    // Student Controllers
    StudentsController,
    StudentProfileController,

    // Catalog Controllers
    ProductsController,

    // Contract Controllers
    ContractsController,

    // Financial Controllers
    FinancialController,

    // Placement Controllers
    PlacementController,
  ],
})
export class ApiModule {}
