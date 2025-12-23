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
import { StudentListQuery } from "./queries/student/student-list.query";
import { StudentProfileQuery } from "./queries/student/student-profile.query";
import { MentorListQuery } from "./queries/mentor/mentor-list.query";
import { MentorProfileQuery } from "./queries/mentor/mentor-profile.query";
import { CounselorListQuery } from "./queries/counselor/counselor-list.query";
import { SchoolListQuery } from "./queries/school/school-list.query";
import { MajorListQuery } from "./queries/major/major-list.query";
import { ServiceBalanceQuery } from "./queries/contract/service-balance.query";
import { StudentContractsQuery } from "./queries/contract/student-contracts.query";
import { RegularMentoringQueryService } from "./queries/services/regular-mentoring-query.service";
import { ClassQueryService } from "./queries/services/class.query.service";
import { ClassSessionQueryService } from "./queries/services/class-session.query.service";
import { CommSessionQueryService } from "./queries/services/comm-session.query.service";
import { GetSessionTypesQuery } from "./queries/services/get-session-types.query";
import { GetRecommLetterTypesQuery } from "./queries/services/get-recomm-letter-types.query";
import { GetProductDetailQuery } from "./queries/product/get-product-detail.query";
import { SearchProductsQuery } from "./queries/product/search-products.query";
import { QueryJobsQuery } from "./queries/placement/query-jobs.query";
import { QueryJobApplicationsQuery } from "./queries/placement/query-job-applications.query";
import { ListMentorPricesQuery } from "./queries/financial/list-mentor-prices.query";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
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
    TelemetryModule, // Domain Services
    UserModule, // Domain层：User (Identity)
    CatalogModule, // Domain层：Catalog
    ServicesModule, // Domain层：Services
    ContractModule, // Domain层：Contract
    FinancialModule, // Domain层：Financial
    PlacementModule, // Domain层：Placement
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
    StudentContractsQuery,
    RegularMentoringQueryService,
    ClassQueryService,
    ClassSessionQueryService,
    CommSessionQueryService,
    GetSessionTypesQuery,
    GetRecommLetterTypesQuery,
    GetProductDetailQuery,
    SearchProductsQuery,
    QueryJobsQuery,
    QueryJobApplicationsQuery,
    ListMentorPricesQuery,

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
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,
    ResumeService,
    RecommLetterTypeService,
    RecommLetterService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    GapAnalysisCreatedEventHandler,
    AiCareerCreatedEventHandler,
    CommSessionCreatedEventHandler,
    ClassSessionCreatedEventHandler,
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
    QueryModule,

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
    StudentContractsQuery,
    RegularMentoringQueryService,
    ClassQueryService,
    ClassSessionQueryService,
    CommSessionQueryService,
    GetSessionTypesQuery,
    GetRecommLetterTypesQuery,
    GetProductDetailQuery,
    SearchProductsQuery,
    QueryJobsQuery,
    QueryJobApplicationsQuery,
    ListMentorPricesQuery,

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
    ClassService,
    ClassSessionService,
    SessionOrchestratorService,
    ResumeService,
    RecommLetterTypeService,
    RecommLetterService,

    // Event Handlers
    RegularMentoringCreatedEventHandler,
    GapAnalysisCreatedEventHandler,
    AiCareerCreatedEventHandler,
    CommSessionCreatedEventHandler,
    ClassSessionCreatedEventHandler,
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

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,
  ],
})
export class ApplicationModule {}
