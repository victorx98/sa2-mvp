import { Module } from "@nestjs/common";

// Infrastructure
import { DatabaseModule } from "@infrastructure/database/database.module";

// Domain Layer
import { UserModule } from "@domains/identity/user/user.module";
import { CatalogModule } from "@domains/catalog/catalog.module";
import { FinancialModule } from "@domains/financial/financial.module";
import { PlacementModule } from "@domains/placement/placement.module";

// Application Layer - Queries
import { UserQueryService } from "./queries/user-query.service";
import { StudentListUseCase } from "./queries/identity/use-cases/student-list.use-case";
import { StudentProfileUseCase } from "./queries/identity/use-cases/student-profile.use-case";
import { MentorListUseCase } from "./queries/identity/use-cases/mentor-list.use-case";
import { MentorProfileUseCase } from "./queries/identity/use-cases/mentor-profile.use-case";
import { CounselorListUseCase } from "./queries/identity/use-cases/counselor-list.use-case";
import { SchoolListUseCase } from "./queries/identity/use-cases/school-list.use-case";
import { MajorListUseCase } from "./queries/identity/use-cases/major-list.use-case";
import { IdentityQueryRepositoriesModule } from "./queries/identity/infrastructure/query-repositories.module";
import { ServiceBalanceQuery } from "./queries/contract/service-balance.query";
import { GetStudentContractsUseCase } from "./queries/contract/use-cases/get-student-contracts.use-case";
import { GetServiceConsumptionUseCase } from "./queries/contract/use-cases/get-service-consumption.use-case";
import { ContractQueryRepositoriesModule } from "./queries/contract/infrastructure/query-repositories.module";
import { MockInterviewQueryService } from "@domains/query/services/mock-interview-query.service";
import { GetSessionTypesQuery } from "./queries/services/get-session-types.query";
import { GetRecommLetterTypesQuery } from "./queries/services/get-recomm-letter-types.query";
import { GetProductDetailUseCase } from "./queries/product/use-cases/get-product-detail.use-case";
import { SearchProductsUseCase } from "./queries/product/use-cases/search-products.use-case";
import { ProductQueryRepositoriesModule } from "./queries/product/infrastructure/query-repositories.module";
import { QueryJobsUseCase } from "./queries/placement/use-cases/query-jobs.use-case";
import { QueryJobApplicationsUseCase } from "./queries/placement/use-cases/query-job-applications.use-case";
import { PlacementQueryRepositoriesModule } from "./queries/placement/infrastructure/query-repositories.module";
import { ListMentorPricesUseCase } from "./queries/financial/use-cases/list-mentor-prices.use-case";
import { ListMentorAppealsUseCase } from "./queries/financial/use-cases/list-mentor-appeals.use-case";
import { FinancialQueryRepositoriesModule } from "./queries/financial/infrastructure/query-repositories.module";
import { ListJobCategoriesUseCase } from "./queries/preference/use-cases/list-job-categories.use-case";
import { ListJobTitlesUseCase } from "./queries/preference/use-cases/list-job-titles.use-case";
import { PreferenceQueryRepositoriesModule } from "./queries/preference/infrastructure/query-repositories.module";
import { CalendarQueryService } from "./queries/calendar/calendar-query.service";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
import { UpdateStudentProfileCommand } from "./commands/profile/update-student-profile.command";
import { UpdateMentorProfileCommand } from "./commands/profile/update-mentor-profile.command";
import { UpdateCounselorProfileCommand } from "./commands/profile/update-counselor-profile.command";
import { RegularMentoringService } from "./commands/services/regular-mentoring.service";
import { GapAnalysisService } from "./commands/services/gap-analysis.service";
import { AiCareerService } from "./commands/services/ai-career.service";
import { CommSessionService } from "./commands/services/comm-session.service";
import { MockInterviewService } from "./commands/services/mock-interview.service";
import { ClassService } from "./commands/services/class.service";
import { ClassSessionService } from "./commands/services/class-session.service";
import { SessionOrchestratorService } from "./commands/services/session-orchestrator.service";
import { ResumeService } from "./commands/services/resume.service";
import { RecommLetterTypeService } from "./commands/services/recomm-letter-type.service";
import { RecommLetterService } from "./commands/services/recomm-letter.service";
import { CreateProductCommand } from "./commands/product/create-product.command";
import { UpdateProductCommand } from "./commands/product/update-product.command";
import { UpdateProductStatusCommand } from "./commands/product/update-product-status.command";
import { AddProductItemCommand } from "./commands/product/add-product-item.command";
import { RemoveProductItemCommand } from "./commands/product/remove-product-item.command";
import { CreateProductSnapshotCommand } from "./commands/product/create-snapshot.command";
import { CreateContractCommand } from "./commands/contract/create-contract.command";
import { ActivateContractCommand } from "./commands/contract/activate-contract.command";
import { SignContractCommand } from "./commands/contract/sign-contract.command";
import { SuspendContractCommand } from "./commands/contract/suspend-contract.command";
import { ResumeContractCommand } from "./commands/contract/resume-contract.command";
import { CompleteContractCommand } from "./commands/contract/complete-contract.command";
import { TerminateContractCommand } from "./commands/contract/terminate-contract.command";
import { UpdateContractCommand } from "./commands/contract/update-contract.command";
import { UpdateContractStatusCommand } from "./commands/contract/update-contract-status.command";
import { ConsumeServiceCommand } from "./commands/contract/consume-service.command";
import { AddAmendmentLedgerCommand } from "./commands/contract/add-amendment-ledger.command";
import { CreateMentorAppealCommand } from "./commands/financial/create-mentor-appeal.command";
import { ApproveMentorAppealCommand } from "./commands/financial/approve-mentor-appeal.command";
import { RejectMentorAppealCommand } from "./commands/financial/reject-mentor-appeal.command";
import { CreateMentorPriceCommand } from "./commands/financial/create-mentor-price.command";
import { UpdateMentorPriceCommand } from "./commands/financial/update-mentor-price.command";
import { UpdateMentorPriceStatusCommand } from "./commands/financial/update-mentor-price-status.command";
import { BatchCreateMentorPricesCommand } from "./commands/financial/batch-create-mentor-prices.command";
import { BatchUpdateMentorPricesCommand } from "./commands/financial/batch-update-mentor-prices.command";

import { AdjustPayableLedgerCommand } from "./commands/financial/adjust-payable-ledger.command";
import { GenerateSettlementCommand } from "./commands/financial/generate-settlement.command";
import { UpdateOrCreatePaymentParamsCommand } from "./commands/financial/update-or-create-payment-params.command";
import { ModifyPaymentParamsCommand } from "./commands/financial/modify-payment-params.command";
import { CreateOrUpdateMentorPaymentInfoCommand } from "./commands/financial/create-or-update-mentor-payment-info.command";
import { UpdateMentorPaymentInfoStatusCommand } from "./commands/financial/update-mentor-payment-info-status.command";
import { CreateJobPositionCommand } from "./commands/placement/create-job-position.command";
import { UpdateJobPositionCommand } from "./commands/placement/update-job-position.command";
import { UpdateJobApplicationStatusCommand } from "./commands/placement/update-job-application-status.command";
import { RollbackJobApplicationStatusCommand } from "./commands/placement/rollback-job-application-status.command";
import { RecommendReferralApplicationsBatchCommand } from "./commands/placement/recommend-referral-applications-batch.command";
import { AssignReferralMentorCommand } from "./commands/placement/assign-referral-mentor.command";
import { CreateManualJobApplicationCommand } from "./commands/placement/create-manual-job-application.command";
import { CreateProxyApplicationsBatchCommand } from "./commands/placement/create-proxy-applications-batch.command";
import { CreateJobCategoryCommand } from "./commands/preference/create-job-category.command";
import { UpdateJobCategoryCommand } from "./commands/preference/update-job-category.command";
import { DeleteJobCategoryCommand } from "./commands/preference/delete-job-category.command";
import { CreateJobTitleCommand } from "./commands/preference/create-job-title.command";
import { UpdateJobTitleCommand } from "./commands/preference/update-job-title.command";
import { DeleteJobTitleCommand } from "./commands/preference/delete-job-title.command";

// Application Layer - Commands (兼容层)
import { AuthCommandService } from "./commands/auth-command/auth-command.service";

// Core Services
import { CalendarModule } from "@core/calendar";
import { MeetingModule } from "@core/meeting";
import { NotificationModule } from "@core/notification";
import { TelemetryModule } from "@telemetry/telemetry.module";

// Domain Services
import { ServicesModule } from "@domains/services/services.module";
import { ContractModule } from "@domains/contract/contract.module";
import { QueryModule } from "@domains/query/query.module";
import { AiCareerCreatedEventHandler } from "@application/events/handlers/services/ai-career-event.handler";
import { AiCareerNotificationHandler } from "@application/events/handlers/services/ai-career-notification.handler";
import { GapAnalysisCreatedEventHandler } from "@application/events/handlers/services/gap-analysis-event.handler";
import { GapAnalysisNotificationHandler } from "@application/events/handlers/services/gap-analysis-notification.handler";
import { RegularMentoringCreatedEventHandler } from "@application/events/handlers/services/regular-mentoring-event.handler";
import { RegularMentoringNotificationHandler } from "@application/events/handlers/services/regular-mentoring-notification.handler";
import { CommSessionCreatedEventHandler } from "@application/events/handlers/services/comm-session-event.handler";
import { CommSessionNotificationHandler } from "@application/events/handlers/services/comm-session-notification.handler";
import { ClassSessionNotificationHandler } from "@application/events/handlers/services/class-session-notification.handler";
import { ClassSessionCreatedEventHandler } from "@application/events/handlers/services/class-session-event.handler";
import { ClassSessionMeetingCompletedHandler } from "@application/events/handlers/services/class-session-meeting-completed.handler";
import { MeetingCompletedListener } from "@application/events/handlers/calendar/meeting-completed.handler";
import { SessionCompletedListener } from "@application/events/handlers/contract/session-completed-listener";
import { ClassStudentEventListener } from "@application/events/handlers/contract/class-student-event-listener";
import { PlacementEventListener } from "@application/events/handlers/contract/placement-event.listener";
import { ResumeBilledListener } from "@application/events/handlers/contract/resume-billed-listener";
import { ResumeBillCancelledListener } from "@application/events/handlers/contract/resume-bill-cancelled-listener";
import { ServiceSessionCompletedListener } from "@application/events/handlers/financial/service-session-completed-listener";
import { SettlementConfirmedListener } from "@application/events/handlers/financial/settlement-confirmed.listener";
import { PlacementApplicationStatusChangedListener } from "@application/events/handlers/financial/placement-application-status-changed.listener";
import { PlacementApplicationStatusRolledBackListener } from "@application/events/handlers/financial/placement-application-status-rolled-back.listener";
import { AppealApprovedListener } from "@application/events/handlers/financial/appeal-approved.listener";
import { PreferenceModule } from "@domains/preference/preference.module";
import { SessionProvisioningSaga } from "./sagas/services/session-provisioning.saga";

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
    NotificationModule, // 导入通知模块（包含通知队列和定时任务）
    TelemetryModule, // Domain Services
    UserModule, // Domain层：User (Identity)
    CatalogModule, // Domain层：Catalog
    ServicesModule, // Domain层：Services
    ContractModule, // Domain层：Contract
    FinancialModule, // Domain层：Financial
    PlacementModule, // Domain层：Placement
    PreferenceModule, // Domain层：Preference (参考数据)
    QueryModule, // Domain层：Query (跨域查询)
    PlacementQueryRepositoriesModule, // Placement Query Repositories
    FinancialQueryRepositoriesModule, // Financial Query Repositories
    ProductQueryRepositoriesModule, // Product Query Repositories
    ContractQueryRepositoriesModule, // Contract Query Repositories
    PreferenceQueryRepositoriesModule, // Preference Query Repositories
    IdentityQueryRepositoriesModule, // Identity Query Repositories
  ],
  providers: [
    // Queries
    UserQueryService,
    StudentListUseCase,
    StudentProfileUseCase,
    MentorListUseCase,
    MentorProfileUseCase,
    CounselorListUseCase,
    SchoolListUseCase,
    MajorListUseCase,
    ServiceBalanceQuery,
    GetStudentContractsUseCase,
    GetServiceConsumptionUseCase,
    MockInterviewQueryService,
    GetSessionTypesQuery,
    GetRecommLetterTypesQuery,
    GetProductDetailUseCase,
    SearchProductsUseCase,
    QueryJobsUseCase,
    QueryJobApplicationsUseCase,
    ListMentorPricesUseCase,
    ListMentorAppealsUseCase,
    ListJobCategoriesUseCase,
    ListJobTitlesUseCase,
    CalendarQueryService,

    // Commands
    RegisterCommand,
    LoginCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    RegularMentoringService,
    GapAnalysisService,
    AiCareerService,
    CommSessionService,
    MockInterviewService,
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,
    ResumeService,
    RecommLetterTypeService,
    RecommLetterService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    RegularMentoringNotificationHandler,
    GapAnalysisCreatedEventHandler,
    GapAnalysisNotificationHandler,
    AiCareerCreatedEventHandler,
    AiCareerNotificationHandler,
    CommSessionCreatedEventHandler,
    CommSessionNotificationHandler,
    ClassSessionCreatedEventHandler,
    ClassSessionNotificationHandler,
    ClassSessionMeetingCompletedHandler,
    SessionProvisioningSaga,
    MeetingCompletedListener,
    SessionCompletedListener,
    ClassStudentEventListener,
    PlacementEventListener,
    ResumeBilledListener,
    ResumeBillCancelledListener,
    ServiceSessionCompletedListener,
    SettlementConfirmedListener,
    PlacementApplicationStatusChangedListener,
    PlacementApplicationStatusRolledBackListener,
    AppealApprovedListener,
    CreateProductCommand,
    UpdateProductCommand,
    UpdateProductStatusCommand,
    AddProductItemCommand,
    RemoveProductItemCommand,
    CreateProductSnapshotCommand,
    CreateContractCommand,
    ActivateContractCommand,
    SignContractCommand,
    SuspendContractCommand,
    ResumeContractCommand,
    CompleteContractCommand,
    TerminateContractCommand,
    UpdateContractCommand,
    UpdateContractStatusCommand,
    ConsumeServiceCommand,
    AddAmendmentLedgerCommand,
    CreateMentorAppealCommand,
    ApproveMentorAppealCommand,
    RejectMentorAppealCommand,
    CreateMentorPriceCommand,
    UpdateMentorPriceCommand,
    UpdateMentorPriceStatusCommand,
    BatchCreateMentorPricesCommand,
    BatchUpdateMentorPricesCommand,

    AdjustPayableLedgerCommand,
    GenerateSettlementCommand,
    UpdateOrCreatePaymentParamsCommand,
    ModifyPaymentParamsCommand,
    CreateOrUpdateMentorPaymentInfoCommand,
    UpdateMentorPaymentInfoStatusCommand,
    CreateJobPositionCommand,
    UpdateJobPositionCommand,
    UpdateJobApplicationStatusCommand,
    RollbackJobApplicationStatusCommand,
    RecommendReferralApplicationsBatchCommand,
    AssignReferralMentorCommand,
    CreateManualJobApplicationCommand,
    CreateProxyApplicationsBatchCommand,
    CreateJobCategoryCommand,
    UpdateJobCategoryCommand,
    DeleteJobCategoryCommand,
    CreateJobTitleCommand,
    UpdateJobTitleCommand,
    DeleteJobTitleCommand,

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
    CatalogModule,
    FinancialModule,
    PlacementModule,
    PreferenceModule,
    QueryModule,

    // Queries
    UserQueryService,
    StudentListUseCase,
    StudentProfileUseCase,
    MentorListUseCase,
    MentorProfileUseCase,
    CounselorListUseCase,
    SchoolListUseCase,
    MajorListUseCase,
    ServiceBalanceQuery,
    GetStudentContractsUseCase,
    GetServiceConsumptionUseCase,
    MockInterviewQueryService,
    GetSessionTypesQuery,
    GetRecommLetterTypesQuery,
    GetProductDetailUseCase,
    SearchProductsUseCase,
    QueryJobsUseCase,
    QueryJobApplicationsUseCase,
    ListMentorPricesUseCase,
    ListMentorAppealsUseCase,
    ListJobCategoriesUseCase,
    ListJobTitlesUseCase,
    CalendarQueryService,

    // Commands
    RegisterCommand,
    LoginCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    RegularMentoringService,
    GapAnalysisService,
    AiCareerService,
    CommSessionService,
    MockInterviewService,
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,
    ResumeService,
    RecommLetterTypeService,
    RecommLetterService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    RegularMentoringNotificationHandler,
    GapAnalysisCreatedEventHandler,
    GapAnalysisNotificationHandler,
    AiCareerCreatedEventHandler,
    AiCareerNotificationHandler,
    CommSessionCreatedEventHandler,
    CommSessionNotificationHandler,
    ClassSessionCreatedEventHandler,
    ClassSessionNotificationHandler,
    ClassSessionMeetingCompletedHandler,
    MeetingCompletedListener,
    SessionCompletedListener,
    ClassStudentEventListener,
    PlacementEventListener,
    ResumeBilledListener,
    ResumeBillCancelledListener,
    ServiceSessionCompletedListener,
    SettlementConfirmedListener,
    PlacementApplicationStatusChangedListener,
    PlacementApplicationStatusRolledBackListener,
    AppealApprovedListener,
    CreateProductCommand,
    UpdateProductCommand,
    UpdateProductStatusCommand,
    AddProductItemCommand,
    RemoveProductItemCommand,
    CreateProductSnapshotCommand,
    CreateContractCommand,
    ActivateContractCommand,
    SignContractCommand,
    SuspendContractCommand,
    ResumeContractCommand,
    CompleteContractCommand,
    TerminateContractCommand,
    UpdateContractCommand,
    UpdateContractStatusCommand,
    ConsumeServiceCommand,
    AddAmendmentLedgerCommand,
    CreateMentorAppealCommand,
    ApproveMentorAppealCommand,
    RejectMentorAppealCommand,
    CreateMentorPriceCommand,
    UpdateMentorPriceCommand,
    UpdateMentorPriceStatusCommand,
    BatchCreateMentorPricesCommand,
    BatchUpdateMentorPricesCommand,

    AdjustPayableLedgerCommand,
    GenerateSettlementCommand,
    UpdateOrCreatePaymentParamsCommand,
    ModifyPaymentParamsCommand,
    CreateOrUpdateMentorPaymentInfoCommand,
    UpdateMentorPaymentInfoStatusCommand,
    CreateJobPositionCommand,
    UpdateJobPositionCommand,
    UpdateJobApplicationStatusCommand,
    RollbackJobApplicationStatusCommand,
    RecommendReferralApplicationsBatchCommand,
    AssignReferralMentorCommand,
    CreateManualJobApplicationCommand,
    CreateProxyApplicationsBatchCommand,
    CreateJobCategoryCommand,
    UpdateJobCategoryCommand,
    DeleteJobCategoryCommand,
    CreateJobTitleCommand,
    UpdateJobTitleCommand,
    DeleteJobTitleCommand,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,
  ],
})
export class ApplicationModule {}
