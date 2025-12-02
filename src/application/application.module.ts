import { Module } from "@nestjs/common";

// Infrastructure
import { DatabaseModule } from "@infrastructure/database/database.module";

// Domain Layer
import { UserModule } from "@domains/identity/user/user.module";
import { CatalogModule } from "@domains/catalog/catalog.module";

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
import { GetProductQuery } from "./queries/product/get-product.query";
import { GetProductsQuery } from "./queries/product/get-products.query";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
import { BookSessionCommand } from "./commands/booking/book-session.command";
import { UpdateStudentProfileCommand } from "./commands/profile/update-student-profile.command";
import { UpdateMentorProfileCommand } from "./commands/profile/update-mentor-profile.command";
import { UpdateCounselorProfileCommand } from "./commands/profile/update-counselor-profile.command";
import { CreateProductCommand } from "./commands/product/create-product.command";
import { UpdateProductCommand } from "./commands/product/update-product.command";
import { PublishProductCommand } from "./commands/product/publish-product.command";
import { CreateContractCommand } from "./commands/contract/create-contract.command";

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
    GetProductQuery,
    GetProductsQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    CreateProductCommand,
    UpdateProductCommand,
    PublishProductCommand,
    CreateContractCommand,

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
    GetProductQuery,
    GetProductsQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,
    UpdateStudentProfileCommand,
    UpdateMentorProfileCommand,
    UpdateCounselorProfileCommand,
    CreateProductCommand,
    UpdateProductCommand,
    PublishProductCommand,
    CreateContractCommand,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,
  ],
})
export class ApplicationModule {}
