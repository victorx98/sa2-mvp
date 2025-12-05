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
import { GetContractQuery } from "./queries/contract/get-contract.query";
import { GetContractsQuery } from "./queries/contract/get-contracts.query";
import { GetProductQuery } from "./queries/product/get-product.query";
import { GetProductsQuery } from "./queries/product/get-products.query";
import { GetSessionTypesQuery } from "./queries/services/get-session-types.query";
import { GetMentorAppealsQuery } from "./queries/financial/get-mentor-appeals.query";
import { GetMentorAppealQuery } from "./queries/financial/get-mentor-appeal.query";
import { GetSettlementsQuery } from "./queries/financial/get-settlements.query";
import { GetSettlementQuery } from "./queries/financial/get-settlement.query";
import { GetJobPositionsQuery } from "./queries/placement/get-job-positions.query";
import { GetJobPositionQuery } from "./queries/placement/get-job-position.query";
import { GetJobApplicationsQuery } from "./queries/placement/get-job-applications.query";
import { GetJobApplicationQuery } from "./queries/placement/get-job-application.query";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
import { BookSessionCommand } from "./commands/booking/book-session.command";
import { UpdateStudentProfileCommand } from "./commands/profile/update-student-profile.command";
import { UpdateMentorProfileCommand } from "./commands/profile/update-mentor-profile.command";
import { UpdateCounselorProfileCommand } from "./commands/profile/update-counselor-profile.command";
import { CreateProductCommand } from "./commands/product/create-product.command";
import { UpdateProductCommand } from "./commands/product/update-product.command";
import { UpdateProductStatusCommand } from "./commands/product/update-product-status.command";
import { AddProductItemCommand } from "./commands/product/add-product-item.command";
import { RemoveProductItemCommand } from "./commands/product/remove-product-item.command";
import { UpdateProductItemSortOrderCommand } from "./commands/product/update-item-sort-order.command";
import { CreateProductSnapshotCommand } from "./commands/product/create-snapshot.command";
import { CreateContractCommand } from "./commands/contract/create-contract.command";
import { ActivateContractCommand } from "./commands/contract/activate-contract.command";
import { SignContractCommand } from "./commands/contract/sign-contract.command";
import { SuspendContractCommand } from "./commands/contract/suspend-contract.command";
import { ResumeContractCommand } from "./commands/contract/resume-contract.command";
import { CompleteContractCommand } from "./commands/contract/complete-contract.command";
import { TerminateContractCommand } from "./commands/contract/terminate-contract.command";
import { UpdateContractCommand } from "./commands/contract/update-contract.command";
import { ConsumeServiceCommand } from "./commands/contract/consume-service.command";
import { AddAmendmentLedgerCommand } from "./commands/contract/add-amendment-ledger.command";
import { CreateMentorAppealCommand } from "./commands/financial/create-mentor-appeal.command";
import { ApproveMentorAppealCommand } from "./commands/financial/approve-mentor-appeal.command";
import { RejectMentorAppealCommand } from "./commands/financial/reject-mentor-appeal.command";
import { CreateJobPositionCommand } from "./commands/placement/create-job-position.command";
import { UpdateJobPositionCommand } from "./commands/placement/update-job-position.command";
import { UpdateJobApplicationStatusCommand } from "./commands/placement/update-job-application-status.command";

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
    GetContractQuery,
    GetContractsQuery,
    GetProductQuery,
    GetProductsQuery,
    GetSessionTypesQuery,
    GetMentorAppealsQuery,
    GetMentorAppealQuery,
    GetSettlementsQuery,
    GetSettlementQuery,
    GetJobPositionsQuery,
    GetJobPositionQuery,
    GetJobApplicationsQuery,
    GetJobApplicationQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    CreateProductCommand,
    UpdateProductCommand,
    UpdateProductStatusCommand,
    AddProductItemCommand,
    RemoveProductItemCommand,
    UpdateProductItemSortOrderCommand,
    CreateProductSnapshotCommand,
    CreateContractCommand,
    ActivateContractCommand,
    SignContractCommand,
    SuspendContractCommand,
    ResumeContractCommand,
    CompleteContractCommand,
    TerminateContractCommand,
    UpdateContractCommand,
    ConsumeServiceCommand,
    AddAmendmentLedgerCommand,
    CreateMentorAppealCommand,
    ApproveMentorAppealCommand,
    RejectMentorAppealCommand,
    CreateJobPositionCommand,
    UpdateJobPositionCommand,
    UpdateJobApplicationStatusCommand,

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
    GetContractQuery,
    GetContractsQuery,
    GetProductQuery,
    GetProductsQuery,
    GetSessionTypesQuery,
    GetMentorAppealsQuery,
    GetMentorAppealQuery,
    GetSettlementsQuery,
    GetSettlementQuery,
    GetJobPositionsQuery,
    GetJobPositionQuery,
    GetJobApplicationsQuery,
    GetJobApplicationQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    CreateProductCommand,
    UpdateProductCommand,
    UpdateProductStatusCommand,
    AddProductItemCommand,
    RemoveProductItemCommand,
    UpdateProductItemSortOrderCommand,
    CreateProductSnapshotCommand,
    CreateContractCommand,
    ActivateContractCommand,
    SignContractCommand,
    SuspendContractCommand,
    ResumeContractCommand,
    CompleteContractCommand,
    TerminateContractCommand,
    UpdateContractCommand,
    ConsumeServiceCommand,
    AddAmendmentLedgerCommand,
    CreateMentorAppealCommand,
    ApproveMentorAppealCommand,
    RejectMentorAppealCommand,
    CreateJobPositionCommand,
    UpdateJobPositionCommand,
    UpdateJobApplicationStatusCommand,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,
  ],
})
export class ApplicationModule {}
