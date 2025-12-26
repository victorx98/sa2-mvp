import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/identity/auth.controller";
import { UserController } from "./controllers/identity/user.controller";
import { CounselorStudentContractController } from "./controllers/identity/counselor-student-contract.controller";
import { CounselorsController } from "./controllers/identity/counselors.controller";
import { MentorsController } from "./controllers/identity/mentors.controller";
import { SchoolsController } from "./controllers/preference/schools.controller";
import { MajorsController } from "./controllers/preference/majors.controller";
import { StudentsController } from "./controllers/identity/students.controller";
import { StudentProfileController } from "./controllers/identity/student-profile.controller";
import { MentorProfileController } from "./controllers/identity/mentor-profile.controller";
import { CounselorProfileController } from "./controllers/identity/counselor-profile.controller";
import { ApplicationModule } from "@application/application.module";
import { WebhookModule } from "@core/webhook/webhook.module";
import { CommSessionController } from "./controllers/services/comm-sessions/comm-session.controller";
import { MockInterviewController } from "./controllers/services/mock-interviews/mock-interview.controller";
import { ProductsController } from "./controllers/catalog/products.controller";
import { ContractsController } from "./controllers/contract/contracts.controller";
import { FinancialController } from "./controllers/financial/financial.controller";
import { PlacementController } from "./controllers/placement/placement.controller";
import { PlacementQueryController } from "./controllers/placement/placement-query.controller";
import { PlacementReferralController } from "./controllers/placement/placement-referral.controller";
import { PlacementProxyController } from "./controllers/placement/placement-proxy.controller";
import { SessionController as UnifiedSessionController } from "./controllers/services/sessions/session.controller";
import { ClassController } from "./controllers/services/class/class.controller";
import { ClassSessionController } from "./controllers/services/class/class-session.controller";
import { SessionTypesController } from "./controllers/services/session-types/session-types.controller";
import { RecommLetterTypesController } from "./controllers/services/recomm-letter-types/recomm-letter-types.controller";
import { ResumeController } from "./controllers/services/resume/resume.controller";
import { RecommLetterController } from "./controllers/services/recomm-letter/recomm-letter.controller";
import { FileController } from "./controllers/file.controller";
import { FileModule } from "@core/file/file.module";
import { CalendarController } from "./controllers/calendar/calendar.controller";
import { JobCategoriesController } from "./controllers/preference/job-categories.controller";
import { JobTitlesController } from "./controllers/preference/job-titles.controller";

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

    // File Module for file upload (AWS S3)
    FileModule,
  ],
  controllers: [
    // Common Controllers
    AuthController,
    UserController,
    CalendarController,
    
    // Reference Data Controllers
    SchoolsController,
    MajorsController,

    // Preference Controllers
    JobCategoriesController,
    JobTitlesController,

    // Counselor Controllers
    CounselorStudentContractController,
    CounselorProfileController,
    CounselorsController,
    
    // Service Controllers
    UnifiedSessionController, // Unified session API endpoint
    SessionTypesController, // Session types query API
    RecommLetterTypesController, // Recommendation letter types API
    CommSessionController,
    MockInterviewController,
    ClassController, // Class management
    ClassSessionController, // Class session management
    ResumeController, // Resume management
    RecommLetterController, // Recommendation letter management
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
    PlacementQueryController,
    PlacementReferralController,
    PlacementProxyController,

    // File Controllers
    FileController,
  ],
})
export class ApiModule {}
