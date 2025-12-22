# Regular-Mentoring 模块 DDD 架构迁移文档

> **版本**: v1.0  
> **日期**: 2025-12-20  
> **目标**: 将 regular-mentoring 模块重构为符合 DDD 原则的标准架构  
> **参考**: `docs/DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md`

---

## 〇、迁移概览

### 核心原则
- **依赖方向**: 外层依赖内层，内层不依赖外层
- **Domain 层**: 使用富领域模型（class），不依赖框架和 ORM
- **Repository**: 接口在 Domain，实现在 Infrastructure
- **Value Object**: 封装领域概念，统一使用 value-objects 目录
- **Listener**: 移到 Application 层，Domain 层不监听外部事件

### 迁移范围

| 层级 | 当前问题 | 迁移目标 |
|------|---------|---------|
| **API** | DTO 定义在 Controller 内 | 提取到独立 dtos 目录 |
| **Application** | Listener 分散 | 合并到现有 Event Handler |
| **Domain** | 实体是贫血模型（type alias） | 富领域模型（class） |
| **Domain** | 仓储直接依赖 Drizzle | 接口与实现分离 |
| **Domain** | 缺少值对象 | 封装 SessionStatus 等概念 |
| **Domain** | Listener 在 Domain 层 | 移到 Application 层 |
| **Infrastructure** | 无独立子目录 | 创建 infrastructure 子目录 |

---

## 一、目标目录结构

```
src/
│
├── api/controllers/services/sessions/
│   ├── dtos/
│   │   ├── request.dto.ts          # 所有 Request DTO
│   │   ├── response.dto.ts         # 所有 Response DTO
│   │   └── index.ts
│   └── session.controller.ts               # 统一入口（保持不变）
│
├── application/commands/services/
│   ├── regular-mentoring.service.ts        # Application Service（保持不变）
│   ├── regular-mentoring-event.handler.ts  # Event Handler（新增 1 个方法）
│   └── session-orchestrator.service.ts     # 策略路由（保持不变）
│
├── domains/services/sessions/regular-mentoring/
│   ├── entities/
│   │   ├── regular-mentoring-session.entity.ts  # 富领域模型（class）
│   │   └── index.ts
│   │
│   ├── value-objects/
│   │   ├── session-status.vo.ts            # 状态枚举 + helper 函数
│   │   └── index.ts
│   │
│   ├── repositories/
│   │   ├── regular-mentoring.repository.interface.ts  # 仓储接口
│   │   ├── session-search.criteria.ts      # 查询条件
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── regular-mentoring-domain.service.ts  # 领域服务（纯业务逻辑）
│   │   └── index.ts
│   │
│   ├── exceptions/
│   │   ├── exceptions.ts                   # 所有异常合并到一个文件
│   │   └── index.ts
│   │
│   ├── infrastructure/                     # 基础设施实现
│   │   ├── repositories/
│   │   │   ├── regular-mentoring.repository.ts
│   │   │   └── index.ts
│   │   └── mappers/
│   │       ├── regular-mentoring.mapper.ts
│   │       └── index.ts
│   │
│   ├── dto/                                # 删除此目录
│   ├── mappers/                            # 删除此目录
│   ├── listeners/                          # 删除此目录
│   │
│   ├── regular-mentoring.module.ts
│   └── index.ts
│
└── infrastructure/database/schema/         # 全局 Schema（保持不变）
    ├── regular-mentoring-sessions.schema.ts
    └── ...
```

---

## 二、API 层迁移

### Step 1: 创建 dtos 目录

```bash
mkdir -p src/api/controllers/services/sessions/dtos
```

### Step 2: 创建 request.dto.ts

**文件路径**: `src/api/controllers/services/sessions/dtos/request.dto.ts`

**内容**: 从 `session.controller.ts` 中提取所有 Request DTO

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Session Request DTO
 */
export class CreateSessionRequestDto {
  @ApiProperty({
    description: 'Session Type',
    example: 'regular_mentoring',
    enum: ['regular_mentoring', 'gap_analysis', 'ai_career'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['regular_mentoring', 'gap_analysis', 'ai_career'])
  sessionType: string;

  @ApiProperty({
    description: 'Service Type (business-level)',
    example: 'premium_mentoring',
    required: false,
  })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiProperty({
    description: 'Student ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'Mentor/Tutor ID',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: 'Session Type ID',
    example: 'uuid-session-type-id',
  })
  @IsString()
  @IsNotEmpty()
  sessionTypeId: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Resume Coaching',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Session description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  @Transform(({ obj }) => obj.duration || 60)
  duration?: number;

  @ApiProperty({
    description: 'Meeting Provider',
    example: 'feishu',
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
}

/**
 * Update Session Request DTO
 */
export class UpdateSessionRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Resume Coaching',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Session description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
    required: false,
  })
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  duration?: number;
}
```

### Step 3: 创建 response.dto.ts

**文件路径**: `src/api/controllers/services/sessions/dtos/response.dto.ts`

```typescript
/**
 * Meeting DTO
 */
export class MeetingDto {
  id: string;
  meetingNo: string;
  meetingProvider: string;
  meetingId: string;
  topic: string;
  meetingUrl: string;
  ownerId: string;
  scheduleStartTime: string;
  scheduleDuration: number;
  status: string;
  actualDuration?: number;
  meetingTimeList?: any[];
  recordingUrl?: string;
  lastMeetingEndedTimestamp?: string;
  pendingTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session Response DTO
 */
export class SessionResponseDto {
  id: string;
  meetingId: string;
  sessionType: string;
  sessionTypeId: string;
  studentUserId: string;
  mentorUserId: string;
  createdByCounselorId: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  cancelledAt?: string;
  deletedAt?: string;
  aiSummaries?: any[];
  createdAt: string;
  updatedAt: string;
  meeting: MeetingDto;
}

/**
 * Create Session Response DTO
 */
export class CreateSessionResponseDto {
  sessionId: string;
  status: string;
  scheduledAt: string;
  holdId?: string;
}
```

### Step 4: 创建 index.ts

**文件路径**: `src/api/controllers/services/sessions/dtos/index.ts`

```typescript
export * from './request.dto';
export * from './response.dto';
```

### Step 5: 更新 Controller

**文件路径**: `src/api/controllers/services/session.controller.ts`

**修改内容**:
1. 删除 Controller 内的所有 DTO 定义
2. 添加 import: `import { CreateSessionRequestDto, UpdateSessionRequestDto, SessionResponseDto, CreateSessionResponseDto } from './dtos';`
3. 保持其他代码不变

---

## 三、Application 层迁移

### Step 1: 合并 Domain Listener 到 Event Handler

**文件路径**: `src/application/commands/services/regular-mentoring-event.handler.ts`

**操作**: 在现有文件末尾添加新方法

```typescript
// 在 RegularMentoringCreatedEventHandler 类中添加以下方法

/**
 * Handle Meeting Lifecycle Completed Event
 * 监听会议完成事件，更新 Session 状态
 */
@OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
async handleMeetingCompletion(
  payload: MeetingLifecycleCompletedPayload,
): Promise<void> {
  this.logger.log(
    `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
  );

  try {
    // Find session by meetingId
    const session = await this.domainRegularMentoringService.findByMeetingId(
      payload.meetingId,
    );

    if (session) {
      this.logger.log(
        `Found regular mentoring session ${session.id} for meeting ${payload.meetingId}`,
      );

      // Complete session
      await this.domainRegularMentoringService.completeSession(session.id, payload);

      this.logger.log(
        `Successfully completed regular mentoring session ${session.id}`,
      );
    } else {
      this.logger.debug(
        `No regular mentoring session found for meeting ${payload.meetingId}, skipping`,
      );
    }
  } catch (error) {
    this.logger.error(
      `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
      error.stack,
    );
  }
}
```

**添加 import**:
```typescript
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';
```

### Step 2: 删除 Domain 层的 Listener

```bash
rm -rf src/domains/services/sessions/regular-mentoring/listeners/
```

### Step 3: 更新 regular-mentoring.module.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/regular-mentoring.module.ts`

**修改**: 删除 `RegularMentoringEventListener` 的注册

```typescript
@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    RegularMentoringRepository,
    RegularMentoringService,
    // ❌ 删除这行
    // RegularMentoringEventListener,
  ],
  exports: [
    RegularMentoringService,
    RegularMentoringRepository,
  ],
})
export class RegularMentoringModule {}
```

---

## 四、Domain 层迁移

### 4.1 创建 Value Objects

#### Step 1: 创建 value-objects 目录

```bash
mkdir -p src/domains/services/sessions/regular-mentoring/value-objects
```

#### Step 2: 创建 session-status.vo.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/value-objects/session-status.vo.ts`

```typescript
/**
 * Session Status Value Object
 * 
 * 使用 enum + helper 函数的方式实现
 * 简单直接，符合项目风格
 */

export enum SessionStatus {
  PENDING_MEETING = 'pending_meeting',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
}

/**
 * 检查状态是否可以取消
 */
export function canBeCancelled(status: SessionStatus): boolean {
  return [
    SessionStatus.PENDING_MEETING,
    SessionStatus.SCHEDULED,
  ].includes(status);
}

/**
 * 检查状态是否可以更新
 */
export function canBeUpdated(status: SessionStatus): boolean {
  return ![
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
    SessionStatus.DELETED,
  ].includes(status);
}

/**
 * 检查状态转换是否合法
 */
export function canTransitionTo(
  currentStatus: SessionStatus,
  newStatus: SessionStatus,
): boolean {
  const transitions: Record<SessionStatus, SessionStatus[]> = {
    [SessionStatus.PENDING_MEETING]: [
      SessionStatus.SCHEDULED,
      SessionStatus.CANCELLED,
    ],
    [SessionStatus.SCHEDULED]: [
      SessionStatus.COMPLETED,
      SessionStatus.CANCELLED,
    ],
    [SessionStatus.COMPLETED]: [],
    [SessionStatus.CANCELLED]: [],
    [SessionStatus.DELETED]: [],
  };
  
  return transitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * 从字符串创建 SessionStatus
 */
export function fromString(value: string): SessionStatus {
  const statusMap: Record<string, SessionStatus> = {
    'pending_meeting': SessionStatus.PENDING_MEETING,
    'scheduled': SessionStatus.SCHEDULED,
    'completed': SessionStatus.COMPLETED,
    'cancelled': SessionStatus.CANCELLED,
    'deleted': SessionStatus.DELETED,
  };
  
  const status = statusMap[value.toLowerCase()];
  if (!status) {
    throw new Error(`Invalid session status: ${value}`);
  }
  
  return status;
}

/**
 * 检查状态是否为最终状态
 */
export function isFinalStatus(status: SessionStatus): boolean {
  return [
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
  ].includes(status);
}
```

#### Step 3: 创建 index.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/value-objects/index.ts`

```typescript
export * from './session-status.vo';
```

### 4.2 创建 Entities

#### Step 1: 创建 entities 目录

```bash
mkdir -p src/domains/services/sessions/regular-mentoring/entities
```

#### Step 2: 创建 regular-mentoring-session.entity.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/entities/regular-mentoring-session.entity.ts`

```typescript
import { SessionStatus, canBeCancelled, canTransitionTo } from '../value-objects/session-status.vo';
import { InvalidStatusTransitionException } from '../exceptions/invalid-status-transition.exception';

/**
 * Regular Mentoring Session Entity (富领域模型)
 * 
 * 职责：
 * 1. 封装会话的核心业务状态
 * 2. 提供业务行为方法
 * 3. 维护业务不变性约束
 * 4. 管理状态转换逻辑
 */
export class RegularMentoringSession {
  private constructor(
    private readonly id: string,
    private meetingId: string | null,
    private readonly sessionType: string,
    private readonly sessionTypeId: string,
    private readonly serviceType: string | null,
    private readonly serviceHoldId: string | null,
    private readonly studentUserId: string,
    private readonly mentorUserId: string,
    private readonly createdByCounselorId: string,
    private title: string,
    private description: string | null,
    private status: SessionStatus,
    private scheduledAt: Date,
    private completedAt: Date | null,
    private cancelledAt: Date | null,
    private deletedAt: Date | null,
    private readonly aiSummaries: any[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  // ============================================
  // Factory Methods
  // ============================================

  /**
   * 创建新会话（工厂方法）
   */
  static create(props: {
    id: string;
    sessionType: string;
    sessionTypeId: string;
    serviceType?: string;
    serviceHoldId?: string;
    studentUserId: string;
    mentorUserId: string;
    createdByCounselorId: string;
    title: string;
    description?: string;
    scheduledAt: Date;
  }): RegularMentoringSession {
    const now = new Date();
    
    return new RegularMentoringSession(
      props.id,
      null, // meetingId 异步填充
      props.sessionType,
      props.sessionTypeId,
      props.serviceType || null,
      props.serviceHoldId || null,
      props.studentUserId,
      props.mentorUserId,
      props.createdByCounselorId,
      props.title,
      props.description || null,
      SessionStatus.PENDING_MEETING, // 初始状态
      props.scheduledAt,
      null, // completedAt
      null, // cancelledAt
      null, // deletedAt
      [], // aiSummaries
      now, // createdAt
      now, // updatedAt
    );
  }

  /**
   * 从数据库重建实体（Mapper 使用）
   */
  static reconstitute(props: {
    id: string;
    meetingId: string | null;
    sessionType: string;
    sessionTypeId: string;
    serviceType: string | null;
    serviceHoldId: string | null;
    studentUserId: string;
    mentorUserId: string;
    createdByCounselorId: string;
    title: string;
    description: string | null;
    status: SessionStatus;
    scheduledAt: Date;
    completedAt: Date | null;
    cancelledAt: Date | null;
    deletedAt: Date | null;
    aiSummaries: any[];
    createdAt: Date;
    updatedAt: Date;
  }): RegularMentoringSession {
    return new RegularMentoringSession(
      props.id,
      props.meetingId,
      props.sessionType,
      props.sessionTypeId,
      props.serviceType,
      props.serviceHoldId,
      props.studentUserId,
      props.mentorUserId,
      props.createdByCounselorId,
      props.title,
      props.description,
      props.status,
      props.scheduledAt,
      props.completedAt,
      props.cancelledAt,
      props.deletedAt,
      props.aiSummaries,
      props.createdAt,
      props.updatedAt,
    );
  }

  // ============================================
  // Business Methods (状态转换)
  // ============================================

  /**
   * 完成会议设置（异步流程）
   * PENDING_MEETING → SCHEDULED
   */
  scheduleMeeting(meetingId: string): void {
    if (!canTransitionTo(this.status, SessionStatus.SCHEDULED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        SessionStatus.SCHEDULED,
      );
    }
    
    this.meetingId = meetingId;
    this.status = SessionStatus.SCHEDULED;
    this.updatedAt = new Date();
  }

  /**
   * 完成会话
   * SCHEDULED → COMPLETED
   */
  complete(): void {
    if (!canTransitionTo(this.status, SessionStatus.COMPLETED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        SessionStatus.COMPLETED,
      );
    }
    
    this.status = SessionStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 取消会话
   * SCHEDULED/PENDING_MEETING → CANCELLED
   */
  cancel(): void {
    if (!canBeCancelled(this.status)) {
      throw new Error(
        `Cannot cancel session with status: ${this.status}`,
      );
    }
    
    this.status = SessionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 软删除会话
   */
  softDelete(): void {
    this.status = SessionStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 更新会话信息
   */
  updateInfo(props: {
    title?: string;
    description?: string;
    scheduledAt?: Date;
  }): void {
    if (props.title !== undefined) {
      this.title = props.title;
    }
    if (props.description !== undefined) {
      this.description = props.description;
    }
    if (props.scheduledAt !== undefined) {
      this.scheduledAt = props.scheduledAt;
    }
    this.updatedAt = new Date();
  }

  // ============================================
  // Business Rules (业务规则验证)
  // ============================================

  /**
   * 检查是否可以取消
   */
  canBeCancelled(): boolean {
    return canBeCancelled(this.status);
  }

  /**
   * 检查是否可以更新
   */
  canBeUpdated(): boolean {
    return ![
      SessionStatus.COMPLETED,
      SessionStatus.CANCELLED,
      SessionStatus.DELETED,
    ].includes(this.status);
  }

  // ============================================
  // Getters
  // ============================================

  getId(): string {
    return this.id;
  }

  getMeetingId(): string | null {
    return this.meetingId;
  }

  getSessionType(): string {
    return this.sessionType;
  }

  getSessionTypeId(): string {
    return this.sessionTypeId;
  }

  getServiceType(): string | null {
    return this.serviceType;
  }

  getServiceHoldId(): string | null {
    return this.serviceHoldId;
  }

  getStudentUserId(): string {
    return this.studentUserId;
  }

  getMentorUserId(): string {
    return this.mentorUserId;
  }

  getCreatedByCounselorId(): string {
    return this.createdByCounselorId;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string | null {
    return this.description;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getScheduledAt(): Date {
    return this.scheduledAt;
  }

  getCompletedAt(): Date | null {
    return this.completedAt;
  }

  getCancelledAt(): Date | null {
    return this.cancelledAt;
  }

  getDeletedAt(): Date | null {
    return this.deletedAt;
  }

  getAiSummaries(): any[] {
    return this.aiSummaries;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
```

#### Step 3: 创建 index.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/entities/index.ts`

```typescript
export * from './regular-mentoring-session.entity';
```

### 4.3 创建 Exceptions

#### Step 1: 创建 exceptions 目录

```bash
mkdir -p src/domains/services/sessions/regular-mentoring/exceptions
```

#### Step 2: 创建异常类（合并到一个文件）

**文件路径**: `src/domains/services/sessions/regular-mentoring/exceptions/exceptions.ts`

```typescript
/**
 * Regular Mentoring Domain Exceptions
 */

/**
 * Session 未找到
 */
export class SessionNotFoundException extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundException';
  }
}

/**
 * 无效的状态转换
 */
export class InvalidStatusTransitionException extends Error {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid status transition: ${currentStatus} → ${targetStatus}`);
    this.name = 'InvalidStatusTransitionException';
  }
}

/**
 * Session 不可取消
 */
export class SessionNotCancellableException extends Error {
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} cannot be cancelled (current status: ${status})`);
    this.name = 'SessionNotCancellableException';
  }
}

/**
 * Session 不可更新
 */
export class SessionNotUpdatableException extends Error {
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} cannot be updated (current status: ${status})`);
    this.name = 'SessionNotUpdatableException';
  }
}
```

#### Step 3: 创建 index.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/exceptions/index.ts`

```typescript
export * from './exceptions';
```

### 4.4 创建 Repository Interface

#### Step 1: 创建 repositories 目录

```bash
mkdir -p src/domains/services/sessions/regular-mentoring/repositories
```

#### Step 2: 创建仓储接口

**文件路径**: `src/domains/services/sessions/regular-mentoring/repositories/regular-mentoring.repository.interface.ts`

```typescript
import { RegularMentoringSession } from '../entities/regular-mentoring-session.entity';
import { SessionSearchCriteria } from './session-search.criteria';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Regular Mentoring Repository Interface
 * 
 * 定义数据访问抽象，使用领域实体作为参数和返回值
 */
export interface IRegularMentoringRepository {
  /**
   * 根据 ID 查询会话
   */
  findById(id: string): Promise<RegularMentoringSession | null>;

  /**
   * 根据 meetingId 查询会话
   */
  findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null>;

  /**
   * 保存会话（创建）
   */
  save(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * 更新会话
   */
  update(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * 搜索会话
   */
  search(criteria: SessionSearchCriteria): Promise<RegularMentoringSession[]>;
}

/**
 * DI Token
 */
export const REGULAR_MENTORING_REPOSITORY = Symbol('REGULAR_MENTORING_REPOSITORY');
```

#### Step 3: 创建查询条件

**文件路径**: `src/domains/services/sessions/regular-mentoring/repositories/session-search.criteria.ts`

```typescript
import { SessionStatus } from '../value-objects/session-status.vo';

/**
 * Session Search Criteria
 * 
 * 查询条件（不是 DTO）
 */
export interface SessionSearchCriteria {
  status?: SessionStatus;
  studentId?: string;
  mentorId?: string;
  counselorId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}
```

#### Step 4: 创建 index.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/repositories/index.ts`

```typescript
export * from './regular-mentoring.repository.interface';
export * from './session-search.criteria';
```

### 4.5 重构 Domain Service

**文件路径**: `src/domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service.ts`

**操作**: 重写为纯业务逻辑（不包含事务、事件、外部服务）

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { IRegularMentoringRepository, REGULAR_MENTORING_REPOSITORY } from '../repositories/regular-mentoring.repository.interface';
import { RegularMentoringSession } from '../entities/regular-mentoring-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import { SessionNotFoundException } from '../exceptions/session-not-found.exception';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Regular Mentoring Domain Service
 * 
 * 职责：纯业务逻辑，不涉及事务、事件、外部服务
 */
@Injectable()
export class RegularMentoringDomainService {
  private readonly logger = new Logger(RegularMentoringDomainService.name);

  constructor(
    @Inject(REGULAR_MENTORING_REPOSITORY)
    private readonly repository: IRegularMentoringRepository,
  ) {}

  /**
   * 创建会话
   */
  async createSession(
    props: {
      id: string;
      sessionType: string;
      sessionTypeId: string;
      serviceType?: string;
      serviceHoldId?: string;
      studentUserId: string;
      mentorUserId: string;
      createdByCounselorId: string;
      title: string;
      description?: string;
      scheduledAt: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<RegularMentoringSession> {
    this.logger.log(`Creating session for student ${props.studentUserId}`);
    
    // 创建实体
    const session = RegularMentoringSession.create(props);
    
    // 保存
    await this.repository.save(session, tx);
    
    return session;
  }

  /**
   * 完成会议设置（异步流程）
   * PENDING_MEETING → SCHEDULED
   */
  async scheduleMeeting(
    sessionId: string,
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Scheduling meeting for session ${sessionId}`);
    
    // 查询实体
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    // 调用实体方法（业务规则在实体内）
    session.scheduleMeeting(meetingId);
    
    // 保存
    await this.repository.update(session, tx);
  }

  /**
   * 完成会话
   * SCHEDULED → COMPLETED
   */
  async completeSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Completing session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.complete();
    await this.repository.update(session, tx);
  }

  /**
   * 取消会话
   * SCHEDULED/PENDING_MEETING → CANCELLED
   */
  async cancelSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Cancelling session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.cancel();
    await this.repository.update(session, tx);
  }

  /**
   * 更新会话信息
   */
  async updateSession(
    sessionId: string,
    props: {
      title?: string;
      description?: string;
      scheduledAt?: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<RegularMentoringSession> {
    this.logger.log(`Updating session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.updateInfo(props);
    await this.repository.update(session, tx);
    
    return session;
  }

  /**
   * 软删除会话
   */
  async deleteSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Deleting session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.softDelete();
    await this.repository.update(session, tx);
  }

  /**
   * 根据 meetingId 查询会话
   */
  async findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null> {
    return this.repository.findByMeetingId(meetingId);
  }

  /**
   * 根据 ID 查询会话
   */
  async getSessionById(id: string): Promise<RegularMentoringSession> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }
}
```

### 4.6 创建 Infrastructure 层

#### Step 1: 创建目录

```bash
mkdir -p src/domains/services/sessions/regular-mentoring/infrastructure/repositories
mkdir -p src/domains/services/sessions/regular-mentoring/infrastructure/mappers
```

#### Step 2: 创建 Mapper

**文件路径**: `src/domains/services/sessions/regular-mentoring/infrastructure/mappers/regular-mentoring.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RegularMentoringSession } from '../../entities/regular-mentoring-session.entity';
import { SessionStatus, fromString } from '../../value-objects/session-status.vo';
import type { RegularMentoringSession as DbSession } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';

/**
 * Regular Mentoring Mapper
 * 
 * 职责：Entity ↔ DB Record 转换
 */
@Injectable()
export class RegularMentoringMapper {
  /**
   * 数据库记录 → 领域实体
   */
  toDomain(record: DbSession): RegularMentoringSession {
    return RegularMentoringSession.reconstitute({
      id: record.id,
      meetingId: record.meetingId,
      sessionType: record.sessionType,
      sessionTypeId: record.sessionTypeId,
      serviceType: record.serviceType,
      serviceHoldId: record.serviceHoldId,
      studentUserId: record.studentUserId,
      mentorUserId: record.mentorUserId,
      createdByCounselorId: record.createdByCounselorId,
      title: record.title,
      description: record.description,
      status: fromString(record.status),
      scheduledAt: new Date(record.scheduledAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
      cancelledAt: record.cancelledAt ? new Date(record.cancelledAt) : null,
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      aiSummaries: record.aiSummaries || [],
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  /**
   * 领域实体 → 数据库记录
   */
  toPersistence(entity: RegularMentoringSession): Partial<DbSession> {
    return {
      id: entity.getId(),
      meetingId: entity.getMeetingId(),
      sessionType: entity.getSessionType(),
      sessionTypeId: entity.getSessionTypeId(),
      serviceType: entity.getServiceType(),
      serviceHoldId: entity.getServiceHoldId(),
      studentUserId: entity.getStudentUserId(),
      mentorUserId: entity.getMentorUserId(),
      createdByCounselorId: entity.getCreatedByCounselorId(),
      title: entity.getTitle(),
      description: entity.getDescription(),
      status: entity.getStatus(),
      scheduledAt: entity.getScheduledAt().toISOString(),
      completedAt: entity.getCompletedAt()?.toISOString() || null,
      cancelledAt: entity.getCancelledAt()?.toISOString() || null,
      deletedAt: entity.getDeletedAt()?.toISOString() || null,
      aiSummaries: entity.getAiSummaries(),
      updatedAt: new Date(),
    };
  }
}
```

#### Step 3: 创建 Repository 实现

**文件路径**: `src/domains/services/sessions/regular-mentoring/infrastructure/repositories/regular-mentoring.repository.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import type { DrizzleDatabase, DrizzleTransaction, DrizzleExecutor } from '@shared/types/database.types';
import { IRegularMentoringRepository } from '../../repositories/regular-mentoring.repository.interface';
import { RegularMentoringSession } from '../../entities/regular-mentoring-session.entity';
import { SessionSearchCriteria } from '../../repositories/session-search.criteria';
import { RegularMentoringMapper } from '../mappers/regular-mentoring.mapper';

/**
 * Drizzle Regular Mentoring Repository
 * 
 * 实现 IRegularMentoringRepository 接口
 */
@Injectable()
export class DrizzleRegularMentoringRepository implements IRegularMentoringRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mapper: RegularMentoringMapper,
  ) {}

  async findById(id: string): Promise<RegularMentoringSession | null> {
    const [record] = await this.db
      .select()
      .from(regularMentoringSessions)
      .where(eq(regularMentoringSessions.id, id))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null> {
    const [record] = await this.db
      .select()
      .from(regularMentoringSessions)
      .where(eq(regularMentoringSessions.meetingId, meetingId))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .insert(regularMentoringSessions)
      .values(data as any);
  }

  async update(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .update(regularMentoringSessions)
      .set(data)
      .where(eq(regularMentoringSessions.id, session.getId()));
  }

  async search(criteria: SessionSearchCriteria): Promise<RegularMentoringSession[]> {
    // TODO: 实现复杂查询逻辑
    const records = await this.db
      .select()
      .from(regularMentoringSessions)
      .limit(criteria.pageSize || 20);
    
    return records.map(record => this.mapper.toDomain(record));
  }
}
```

#### Step 4: 创建 index.ts

**文件路径**: `src/domains/services/sessions/regular-mentoring/infrastructure/repositories/index.ts`

```typescript
export * from './drizzle-regular-mentoring.repository';
```

**文件路径**: `src/domains/services/sessions/regular-mentoring/infrastructure/mappers/index.ts`

```typescript
export * from './regular-mentoring.mapper';
```

### 4.7 更新 Module 配置

**文件路径**: `src/domains/services/sessions/regular-mentoring/regular-mentoring.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { RegularMentoringDomainService } from './services/regular-mentoring-domain.service';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';
import { REGULAR_MENTORING_REPOSITORY } from './repositories/regular-mentoring.repository.interface';
import { DrizzleRegularMentoringRepository } from './infrastructure/repositories/drizzle-regular-mentoring.repository';
import { RegularMentoringMapper } from './infrastructure/mappers/regular-mentoring.mapper';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    // Mapper
    RegularMentoringMapper,
    
    // Repository (依赖注入)
    {
      provide: REGULAR_MENTORING_REPOSITORY,
      useClass: DrizzleRegularMentoringRepository,
    },
    
    // Domain Service
    RegularMentoringDomainService,
  ],
  exports: [
    REGULAR_MENTORING_REPOSITORY,
    RegularMentoringDomainService,
  ],
})
export class RegularMentoringModule {}
```

### 4.8 删除旧文件

```bash
# 删除旧的 dto 目录
rm -rf src/domains/services/sessions/regular-mentoring/dto/

# 删除旧的 mappers 目录（已移到 infrastructure）
rm -rf src/domains/services/sessions/regular-mentoring/mappers/

# 删除旧的 repositories 实现（保留接口）
rm src/domains/services/sessions/regular-mentoring/repositories/regular-mentoring.repository.ts

# 删除旧的 entities（如果是 type alias）
# 已被新的 class 替换
```

---

## 五、Application 层调整

### Step 1: 更新 Application Service

**文件路径**: `src/application/commands/services/regular-mentoring.service.ts`

**修改内容**:

1. **更新 import**
   ```typescript
   import { RegularMentoringDomainService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service';
   ```

2. **更新方法调用**（如果方法签名有变化）
   - `createSession()` 方法中调用 `domainService.createSession()`
   - `completeMeetingSetup()` 改为 `domainService.scheduleMeeting()`
   - 其他方法保持不变

### Step 2: 更新 Event Handler

**文件路径**: `src/application/commands/services/regular-mentoring-event.handler.ts`

**修改内容**:

1. **更新方法调用**
   ```typescript
   // 从
   await this.domainRegularMentoringService.completeMeetingSetup(
     event.sessionId,
     meeting.id,
     tx,
   );

   // 改为
   await this.domainRegularMentoringService.scheduleMeeting(
     event.sessionId,
     meeting.id,
     tx,
   );
   ```

---

## 六、验证与测试

### Step 1: 编译检查

```bash
npm run build
```

### Step 2: 运行测试

```bash
npm run test
```

### Step 3: 启动服务

```bash
npm run start:dev
```

### Step 4: 功能测试

测试以下功能：
- ✅ 创建会话（POST /api/services/sessions）
- ✅ 查询会话（GET /api/services/sessions/:id）
- ✅ 更新会话（PATCH /api/services/sessions/:id）
- ✅ 取消会话（POST /api/services/sessions/:id/cancel）
- ✅ 删除会话（DELETE /api/services/sessions/:id）
- ✅ 会议完成事件处理

---

## 七、迁移检查清单

### API 层
- [ ] 创建 `dtos` 目录
- [ ] 创建 `request.dto.ts`
- [ ] 创建 `response.dto.ts`
- [ ] 创建 `index.ts`
- [ ] 更新 Controller import
- [ ] 删除 Controller 内的 DTO 定义

### Application 层
- [ ] 合并 Domain Listener 到 Event Handler
- [ ] 添加 `handleMeetingCompletion` 方法
- [ ] 添加必要的 import
- [ ] 更新方法调用（如有变化）

### Domain 层
- [ ] 创建 `value-objects` 目录
- [ ] 创建 `session-status.vo.ts`
- [ ] 创建 `entities` 目录
- [ ] 创建 `regular-mentoring-session.entity.ts`（富模型）
- [ ] 创建 `exceptions` 目录
- [ ] 创建 `exceptions.ts`（所有异常合并）
- [ ] 创建 `repositories` 接口
- [ ] 创建 `regular-mentoring.repository.interface.ts`
- [ ] 创建 `session-search.criteria.ts`
- [ ] 重构 Domain Service（纯业务逻辑）
- [ ] 创建 `infrastructure` 目录
- [ ] 创建 Mapper
- [ ] 创建 Repository 实现
- [ ] 更新 Module 配置（DI）
- [ ] 删除旧文件（dto、mappers、listeners、旧 repositories）

### 验证
- [ ] 编译通过
- [ ] 测试通过
- [ ] 服务启动成功
- [ ] 功能测试通过

---

## 八、注意事项

### 1. 依赖方向
- ✅ Application → Domain（正确）
- ✅ Infrastructure → Domain（正确）
- ❌ Domain → Infrastructure（错误，避免）
- ❌ Domain → Application（错误，避免）

### 2. 实体设计
- ✅ 使用 class（不是 interface 或 type）
- ✅ 封装业务规则在实体方法内
- ✅ 私有字段 + 公共 getter
- ✅ 提供工厂方法（create、reconstitute）

### 3. 值对象
- ✅ SessionStatus 使用 enum + helper 函数
- ✅ 简单直接，符合项目风格
- ✅ 如需复杂验证，可升级为 class

### 4. Repository
- ✅ 接口在 Domain 层
- ✅ 实现在 Infrastructure 层
- ✅ 使用 DI Token 绑定
- ✅ 使用 Mapper 转换

### 5. Domain Service
- ✅ 纯业务逻辑
- ❌ 不包含事务管理
- ❌ 不包含事件发布
- ❌ 不调用外部服务

### 6. Listener
- ✅ 监听外部事件的 Listener 在 Application 层
- ❌ Domain 层不监听外部事件
- ✅ Domain 层可以发布领域事件（如需要）

---

## 九、后续优化建议

### 1. 单元测试
- 为 Entity 编写单元测试（无需数据库）
- 为 Value Object 编写单元测试
- 为 Domain Service 编写集成测试（Mock Repository）

### 2. 领域事件
- 如需要，可在 Domain 层引入领域事件
- 例如：`SessionCancelledEvent`（Domain 内部通信）

### 3. 查询优化
- 完善 `search()` 方法的实现
- 添加索引优化

### 4. 其他 Session 类型
- 参考 regular-mentoring 迁移其他类型
- gap-analysis、ai-career 等

---

## 十、参考资料

- [DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md](docs/DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**文档版本**: v1.0  
**最后更新**: 2025-12-20  
**维护者**: Architecture Team

