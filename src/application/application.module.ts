import { Module } from "@nestjs/common";

// Infrastructure
import { DatabaseModule } from "@infrastructure/database/database.module";

// Domain Layer
import { UserModule } from "@domains/identity/user/user.module";

// Application Layer - Queries
import { UserQueryService } from "./queries/user-query.service";
import { StudentListQuery } from "./queries/student/student-list.query";
import { StudentProfileQuery } from "./queries/student/student-profile.query";
import { MentorListQuery } from "./queries/mentor/mentor-list.query";
import { MentorProfileQuery } from "./queries/mentor/mentor-profile.query";
import { CounselorListQuery } from "./queries/counselor/counselor-list.query";
import { SchoolListQuery } from "./queries/school/school-list.query";
import { MajorListQuery } from "./queries/major/major-list.query";
import { ServiceBalanceQuery } from "./queries/contract/service-balance.query";
import { RegularMentoringQueryService } from "./queries/services/regular-mentoring-query.service";
import { ClassQueryService } from "./queries/services/class.query.service";
import { ClassSessionQueryService } from "./queries/services/class-session.query.service";
import { CommSessionQueryService } from "./queries/services/comm-session.query.service";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
import { BookSessionCommand } from "./commands/booking/book-session.command";
import { UpdateStudentProfileCommand } from "./commands/profile/update-student-profile.command";
import { UpdateMentorProfileCommand } from "./commands/profile/update-mentor-profile.command";
import { UpdateCounselorProfileCommand } from "./commands/profile/update-counselor-profile.command";
import { RegularMentoringService } from "./commands/services/regular-mentoring.service";
import { RegularMentoringCreatedEventHandler } from "./commands/services/regular-mentoring-event.handler";
import { GapAnalysisService } from "./commands/services/gap-analysis.service";
import { GapAnalysisCreatedEventHandler } from "./commands/services/gap-analysis-event.handler";
import { AiCareerService } from "./commands/services/ai-career.service";
import { AiCareerCreatedEventHandler } from "./commands/services/ai-career-event.handler";
import { CommSessionService } from "./commands/services/comm-session.service";
import { CommSessionCreatedEventHandler } from "./commands/services/comm-session-event.handler";
import { ClassService } from "./commands/services/class.service";
import { ClassSessionService } from "./commands/services/class-session.service";
import { ClassSessionCreatedEventHandler } from "./commands/services/class-session-event.handler";
import { SessionOrchestratorService } from "./commands/services/session-orchestrator.service";

// Application Layer - Commands (兼容层)
import { AuthCommandService } from "./commands/auth-command/auth-command.service";

// Core Services
import { CalendarModule } from "@core/calendar";
import { MeetingModule } from "@core/meeting";
import { TelemetryModule } from "@telemetry/telemetry.module";

// Domain Services
import { ServicesModule } from "@domains/services/services.module";
import { ContractModule } from "@domains/contract/contract.module";
import { QueryModule } from "@domains/query/query.module";

/**
 * Application Layer - Root Module
 * 职责：
 * 1. 注册所有 Queries
 * 2. 注册所有 Commands
 * 3. 注册所有 Sagas
 * 4. 导出供 Operations Layer 使用
 */
@Module({
  imports: [
    DatabaseModule, // 导入数据库模块，提供事务支持
    CalendarModule, // 导入日历模块（包含事件监听器）
    MeetingModule, // 导入会议提供者模块
    TelemetryModule, // 提供 MetricsService 等遥测服务
    UserModule, // Domain层：User (Identity)
    ServicesModule, // Domain层：Services
    ContractModule, // Domain层：Contract
    QueryModule, // Domain层：Query (跨域查询)
  ],
  providers: [

    // Queries
    UserQueryService,
    StudentListQuery,
    StudentProfileQuery,
    MentorListQuery,
    MentorProfileQuery,
    CounselorListQuery,
    SchoolListQuery,
    MajorListQuery,
    ServiceBalanceQuery,
    RegularMentoringQueryService,
    ClassQueryService,
    ClassSessionQueryService,
    CommSessionQueryService,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    RegularMentoringService,
    GapAnalysisService,
    AiCareerService,
    CommSessionService,
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    GapAnalysisCreatedEventHandler,
    AiCareerCreatedEventHandler,
    CommSessionCreatedEventHandler,
    ClassSessionCreatedEventHandler,

    // Commands (兼容层)
    AuthCommandService,
  ],
  exports: [
    // Core Services
    CalendarModule,
    MeetingModule,

    // Domain Services
    ServicesModule,
    UserModule,
    ContractModule,

    // Queries
    UserQueryService,
    StudentListQuery,
    StudentProfileQuery,
    MentorListQuery,
    MentorProfileQuery,
    CounselorListQuery,
    SchoolListQuery,
    MajorListQuery,
    ServiceBalanceQuery,
    RegularMentoringQueryService,
    ClassQueryService,
    ClassSessionQueryService,
    CommSessionQueryService,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    RegularMentoringService,
    GapAnalysisService,
    AiCareerService,
    CommSessionService,
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    GapAnalysisCreatedEventHandler,
    AiCareerCreatedEventHandler,
    CommSessionCreatedEventHandler,
    ClassSessionCreatedEventHandler,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,
  ],
})
export class ApplicationModule {}
