import { Module } from "@nestjs/common";

// Domain Layer
import { UserModule } from "@domains/identity/user/user.module";
import { ContractModule } from "@domains/contract/contract.module";
import { FinancialModule } from "@domains/financial/financial.module";
import { PreferenceModule } from "@domains/preference/preference.module";
import { SessionTypesModule } from "@domains/services/session-types/session-types.module";
import { RecommLetterTypesModule } from "@domains/services/recomm-letter-types/recomm-letter-types.module";
import { RecommLetterModule } from "@domains/services/recomm-letter/recomm-letter.module";
import { RecommLettersModule } from "@domains/services/recomm-letters/recomm-letters.module";
import { RegularMentoringModule } from "@domains/services/sessions/regular-mentoring/regular-mentoring.module";
import { GapAnalysisModule } from "@domains/services/sessions/gap-analysis/gap-analysis.module";
import { AiCareerModule } from "@domains/services/sessions/ai-career/ai-career.module";
import { CommSessionsModule } from "@domains/services/comm-sessions/comm-sessions.module";
import { MockInterviewsModule } from "@domains/services/mock-interviews/mock-interviews.module";
import { ClassModule } from "@domains/services/class/class.module";
import { ResumeModule } from "@domains/services/resume/resume.module";
import { QueryModule } from "@domains/query/query.module";

// Application Layer - Queries
import { GetUserUseCase } from "./queries/identity/use-cases/get-user.use-case";
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
import { GetSessionTypesUseCase } from "./queries/services/session-types/use-cases/get-session-types.use-case";
import { GetRecommLetterTypesUseCase } from "./queries/services/recomm-letter-types/use-cases/get-recomm-letter-types.use-case";
import { SessionTypesQueryRepositoriesModule } from "./queries/services/session-types/infrastructure/query-repositories.module";
import { RecommLetterTypesQueryRepositoriesModule } from "./queries/services/recomm-letter-types/infrastructure/query-repositories.module";
import { ServicesQueryRepositoriesModule } from "./queries/services/infrastructure/query-repositories.module";
import { GetClassesUseCase } from "./queries/services/use-cases/get-classes.use-case";
import { GetClassMentorsUseCase } from "./queries/services/use-cases/get-class-mentors.use-case";
import { GetClassStudentsUseCase } from "./queries/services/use-cases/get-class-students.use-case";
import { GetClassCounselorsUseCase } from "./queries/services/use-cases/get-class-counselors.use-case";

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
import { GetCalendarEventsUseCase } from "./queries/calendar/use-cases/get-calendar-events.use-case";
import { CalendarQueryRepositoriesModule } from "./queries/calendar/infrastructure/query-repositories.module";
// Mock Interviews Queries
import { MockInterviewsQueryRepositoriesModule } from "./queries/mock-interviews/infrastructure/query-repositories.module";
import { GetStudentMockInterviewsUseCase } from "./queries/mock-interviews/use-cases/get-student-mock-interviews.use-case";
import { GetCounselorMockInterviewsUseCase } from "./queries/mock-interviews/use-cases/get-counselor-mock-interviews.use-case";
import { GetMockInterviewsByStudentIdsUseCase } from "./queries/mock-interviews/use-cases/get-mock-interviews-by-student-ids.use-case";
import { GetMockInterviewByIdUseCase } from "./queries/mock-interviews/use-cases/get-mock-interview-by-id.use-case";

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

// Event Handlers
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

@Module({
  imports: [
    // Domain Layer
    UserModule,
    ContractModule,
    FinancialModule,
    PreferenceModule,
    SessionTypesModule,
    RecommLetterTypesModule,
    RecommLetterModule,
    RecommLettersModule,
    RegularMentoringModule,
    GapAnalysisModule,
    AiCareerModule,
    CommSessionsModule,
    MockInterviewsModule,
    ClassModule,
    ResumeModule,
    QueryModule,
    // Core Services
    CalendarModule,
    MeetingModule,
    NotificationModule,
    TelemetryModule,
    // Query Repositories
    PlacementQueryRepositoriesModule,
    FinancialQueryRepositoriesModule,
    ProductQueryRepositoriesModule,
    ContractQueryRepositoriesModule,
    PreferenceQueryRepositoriesModule,
    IdentityQueryRepositoriesModule,
    ServicesQueryRepositoriesModule,
    SessionTypesQueryRepositoriesModule,
    RecommLetterTypesQueryRepositoriesModule,
    CalendarQueryRepositoriesModule,
    MockInterviewsQueryRepositoriesModule,
  ],
  providers: [
    // Queries
    GetUserUseCase,
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
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
    GetProductDetailUseCase,
    SearchProductsUseCase,
    QueryJobsUseCase,
    QueryJobApplicationsUseCase,
    ListMentorPricesUseCase,
    ListMentorAppealsUseCase,
    ListJobCategoriesUseCase,
    ListJobTitlesUseCase,
    GetCalendarEventsUseCase,
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    // Mock Interviews Queries
    GetStudentMockInterviewsUseCase,
    GetCounselorMockInterviewsUseCase,
    GetMockInterviewsByStudentIdsUseCase,
    GetMockInterviewByIdUseCase,

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

    // Commands (兼容层)
    AuthCommandService,
  ],
  exports: [
    // Domain Layer
    UserModule,
    QueryModule,
    ResumeModule,
    RecommLetterModule,

    // Core Services
    CalendarModule,
    MeetingModule,

    // Queries
    GetUserUseCase,
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
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
    GetProductDetailUseCase,
    SearchProductsUseCase,
    QueryJobsUseCase,
    QueryJobApplicationsUseCase,
    ListMentorPricesUseCase,
    ListMentorAppealsUseCase,
    ListJobCategoriesUseCase,
    ListJobTitlesUseCase,
    GetCalendarEventsUseCase,
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    // Mock Interviews Queries
    GetStudentMockInterviewsUseCase,
    GetCounselorMockInterviewsUseCase,
    GetMockInterviewsByStudentIdsUseCase,
    GetMockInterviewByIdUseCase,

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
