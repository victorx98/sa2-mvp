# MentorX - Condensed Architecture Design

This document outlines the key design principles for the API, Operations (BFF), and Application layers of the MentorX platform, following Domain-Driven Design (DDD) principles.

## 1. Architecture Overview

The architecture is composed of four primary layers. This document focuses on the top three.

```
┌────────────────────┐
│     API Layer      │  (HTTP, Auth, Routing, Trace, Exception)
└─────────┬──────────┘
          ↓
┌────────────────────┐
│  Application Layer │  (Business Use Case Orchestration, Frontend Adaption, DTO Mapping)
└─────────┬──────────┘
          ↓
┌────────────────────┐
│    Domain Layer    │  (Business Rules & Models)
└────────────────────┘
```

---

## 2. Layer Design & Responsibilities

### 2.1. API Layer (Controllers)

- **Responsibilities**:
    - Handle HTTP requests, routing, and parameter extraction (`@Get`, `@Post`, `@Body`).
    - Enforce authentication and authorization using Guards (`@UseGuards`, `@Roles`).
    - Keep controllers "thin" by delegating all business logic to the Operations/Application layer.
    - Define API contracts using OpenAPI/Swagger decorators (`@ApiTags`, `@ApiOperation`).
- **Directory Structure**:
    ```
    src/api/controllers/{role}/{resource}.controller.ts
    // e.g., src/api/controllers/student/sessions.controller.ts
    ```

### 2.2. Application Layer

- **Responsibilities**:
    - Orchestrate business use cases.
    - For write operations, coordinate multiple Domain services and ensure business rules are enforced.
    - For read operations, efficiently fetch data from domain and transform from entities/DTOs into specific Response DTOs for the client
    - Manage cross-domain transactions to ensure data consistency.
    - Remain role-agnostic, returning business data that can be reused by multiple BFFs.
    - 提供api(可以用不同api区分意图); controller代码只做路由/参数解析/鉴权，不识别意图

- **Implementation Strategy: Command Query Responsibility Segregation (CQRS)**
    To balance business rule integrity with query performance, the application layer adopts a CQRS approach. This means the implementation strategy for write operations (Commands, Sagas) is different from read operations (Queries). Responsibility: 
    1. 意图识别、决定查询策略: 比如根据当前用户role/参数值, 来决定调用哪个domain query
    2. 提供用例语义明确的方法: 比如findByCounselorId、findByMentorId

    - **Commands & Sagas (Write Path)**:
        - **Goal**: Ensure business rules and data consistency are strictly enforced.
        - **Method**: MUST operate through the **Domain Layer**. The command handler loads Aggregates from repositories, executes business logic by calling methods on the Aggregate entities themselves, and then saves the changes. This guarantees that all domain invariants are protected.

    - **Queries (Read Path)**:
        - **Goal**: Maximize performance and flexibility for data retrieval.
        - **Method**: CAN and SHOULD bypass the full Domain model. Query handlers can directly use the ORM (e.g., Drizzle) or raw SQL to fetch data from the database. This allows for optimized `JOIN` operations and projections, returning flat DTOs tailored for specific UI needs without the overhead of hydrating full domain entities.

- **Service Types**:
    - **Queries**: Read-only operations. Implemented for high performance by directly querying the database to build read models (DTOs).
    - **Commands**: Write operations. Implemented by loading the domain aggregate and executing its methods to ensure business rules are met. 由domain内部方法保证详细业务规则。
    - **Sagas**: Complex, multi-domain write operations requiring transactions. Also operates through the domain layer to ensure consistency.
    - Command DTO 面向“写操作结果确认”，Query DTO 面向“读取视图”；前者扁平纯数
  据，后者按场景组合，但同样要保持与领域实体解耦
- **Directory Structure**:
    ```
    src/application/
    ├── queries/{feature}/{get-something.query.ts, dto/}
    ├── commands/{feature}/{do-something.command.ts, dto/}
    └── sagas/{feature}/{orchestrate-something.saga.ts, dto/}
    ```

### 2.3. Domain Layer
- **职责**:
    - 包含核心业务规则和模型（聚合根、实体、值对象）。
    - 确保领域不变性（Domain Invariants）得到维护。
    - 领域被划分为独立的业务域（例如：`identity`, `contract`, `catalog` 等）。
    - 引入 **Query Domain**：一个特殊的领域，专注于提供跨业务域的统一查询能力，可以直接 join 各域表进行高效查询，构建 Read Model。


---

## 3. Cross-Cutting Concerns

- **Data Aggregation**: Primarily handled by **Application Layer Queries**. The **BFF Layer** may perform additional light aggregation for UI purposes.
- **Authentication & Authorization**: Handled in the **API Layer** via NestJS Guards. Decorators like `@CurrentUser` and `@Roles` provide user context and access control.
- **Exception Handling**:
    - Domain/Application layers throw specific business exceptions (e.g., `InsufficientBalanceException`).
    - A global exception filter in the `main.ts` file catches these exceptions and maps them to appropriate HTTP status codes(included in Nest framework).
    - The BFF layer can optionally catch exceptions to return more user-friendly error messages in the response DTO.
- **API Specification**: The **API Layer** is decorated with `@nestjs/swagger` annotations to generate an OpenAPI specification automatically.
- **Caching**: Expensive and frequently accessed queries in the **Application Layer** can be cached using decorators (e.g., `@Cacheable`) with a TTL, leveraging tools like `cache-manager` with Redis.
- **Logging & Observability**:
    - Inject the `Logger` service in Application services (Sagas, Commands).
    - Log the entry, exit, and execution duration of critical operations.
    - Use structured logging (JSON format) to facilitate searching and analysis in tools like Datadog or ELK.

---

## 4. 依赖与集成
- **依赖**: 
  - 直接调用: 依赖调用返回值，必须同事务内
  - 事件通知: 非实时，可事务外
- **集成**: 参照 @testcase_standard.md

## 5. Use Case 1: Book a Session (Write Path)

This use case shows a complex write operation (Saga) that first performs reads for validation and then executes a transaction.

### API Layer

The controller is responsible for HTTP handling and calls the application saga.

```typescript
// src/api/controllers/student/student-sessions.controller.ts
@Controller('api/student/sessions')
export class StudentSessionsController {
  constructor(private readonly bookSessionSaga: BookSessionSaga) {}

  @Post()
  async bookSession(
    @CurrentUser() user: JwtUser,
    @Body() body: BookSessionRequestDto,
  ): Promise<SessionBookingResponseDto> {
    const session = await this.bookSessionSaga.execute({ /* ... */ });
    // Transform domain entity to response DTO
    return { /* ... */ };
  }
}
```

### Application Layer (Commands)

The saga orchestrates the use case. Crucially, for any read operations (like pre-validations), it **delegates to a specialized Domain Query Service**. It does not perform queries itself.

```typescript
// src/application/commands/booking/book-session.ts
@Injectable()
export class BookSessionCommand {
  constructor(
    private readonly drizzle: DrizzleService,
    // Inject DOMAIN-level query services for reading
    private readonly contractQueryService: ContractQueryService,
    private readonly calendarQueryService: CalendarQueryService,
    // Inject DOMAIN-level write services
    private readonly holdService: ServiceHoldService,
    private readonly sessionService: SessionService,
    private readonly eventBus: EventBus,
  ) { super(); }

  async execute(input: BookingInput): Promise<Session> {
    // 1. Pre-validation using Domain Query Services
    const [balance, availability] = await Promise.all([
      this.contractQueryService.getBalance({ contractId: input.contractId, serviceId: input.serviceId }),
      this.calendarQueryService.checkAvailability({ mentorId: input.mentorId, timeRange: [input.startTime, input.endTime] }),
    ]);
    if (balance.available < 1) throw new InsufficientBalanceException();
    if (!availability.isAvailable) throw new TimeConflictException();

    // 2. Transactional operations using Domain Write Services
    const session = await this.drizzle.db.transaction(async (tx) => {
      const hold = await this.holdService.createHold({ ... }, { transaction: tx });
      const newSession = await this.sessionService.createSession({ holdId: hold.id, ...input }, { transaction: tx });
      return newSession;
    });

    // 3. Post-transaction events
    await this.eventBus.publish(new SessionScheduledEvent(session));
    return session;
  }
}
```

### Domain Layer (Query Service Example)

A Domain Query Service is responsible for fetching read models. It lives in the domain but is separate from the write-side business logic.

```typescript
// src/domains/contract/queries/contract-query.service.ts
@Injectable()
export class ContractQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getBalance(input: { contractId: string, serviceId: string }): Promise<{ available: number }> {
    // Uses ORM to build an efficient query for a specific read model.
    const result = await this.drizzle.db. ... ; // Complex SQL to calculate balance
    return { available: result.balance };
  }
}
```

## 6. Use Case 2: Get Student List (Query Path)

This use case demonstrates the pure read path, separating the Application and Domain query responsibilities.

### API Layer

The controller delegates to a lightweight application service.

```typescript
// src/api/controllers/admin/users.controller.ts
@Controller('api/admin/users')
export class UsersController {
  constructor(private readonly userAppService: UserApplicationService) {}

  @Get('students')
  @ApiOperation({ summary: 'Get a list of all students' })
  async getStudents(): Promise<StudentListItemDto[]> {
    return this.userAppService.findAllStudents();
  }
}
```

### Application Layer (Query)

The application service is a thin orchestrator. It **must not** contain SQL or ORM logic. Its only job is to call the appropriate Domain Query Service.

```typescript
// src/application/queries/user/user.app-query.service.ts
@Injectable()
export class UserApplicationService {
  constructor(
    // Inject the read-model service from the Domain layer
    private readonly studentQueryService: StudentQueryService
  ) {}

  async findAllStudents(): Promise<StudentListItemDto[]> {
    // Delegate fetching to the specialized domain query service
    return this.studentQueryService.findAll();
  }
}
```

### Domain Layer (Query Service)

The `StudentQueryService` lives in the `Query` domain and is responsible for building the all read model. It uses the ORM directly for maximum performance.

```typescript
// src/domains/query/services/student-query.service.ts
@Injectable()
export class StudentQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll(): Promise<StudentListItemDto[]> {
    // Directly query the database, joining tables for an efficient read model.
    const result = await this.drizzle.db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      activeContractCount: sql<number>`count(${contracts.id})`,
    })
    .from(users)
    .leftJoin(contracts, eq(users.id, contracts.studentId))
    .where(eq(users.role, 'student'))
    .groupBy(users.id);

    return result;
  }
}
```
