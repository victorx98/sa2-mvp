# 简历上传与导师计费功能设计文档

> **版本：** v2.0  
> **创建日期：** 2025-12-15  
> **更新日期：** 2025-12-15  
> **状态：** 设计阶段  
> **所属域：** Services Domain (Resume Sub-domain)

---

## 📋 目录

- [1. 功能概述](#1-功能概述)
- [2. 核心概念与架构](#2-核心概念与架构)
- [3. 数据模型设计](#3-数据模型设计)
- [4. 领域服务接口](#4-领域服务接口)
- [5. DTO 定义](#5-dto-定义)
- [6. 业务规则与验证](#6-业务规则与验证)
- [7. 状态机设计](#7-状态机设计)
- [8. API 接口设计](#8-api-接口设计)
- [9. 实现指南](#9-实现指南)

---

## 1. 功能概述

### 1.1 功能职责

本模块负责管理学生简历的上传、版本管理、最终版本设置以及导师计费功能。

**核心职责：**

- ✅ 支持针对每个 Job Title 上传多份简历
- ✅ 管理简历的最终版本（Set Final / Cancel Final）
- ✅ 处理简历导师计费逻辑（每个 Job Title 仅允许计费一次）
- ✅ 记录计费时间和 Final 设置时间

**不负责的职责：**

- ❌ 不处理 Job Title 管理（由独立模块负责，本模块调用接口获取）
- ❌ 不处理简历文件的存储（使用 AWS S3，仅存储 URL）
- ❌ 不处理 AI 简历分析（由 AI 服务负责）
- ❌ 不处理导师分配逻辑（已由其他模块负责）
- ❌ 不处理 Viewable By 权限控制（暂不实现）

### 1.2 功能特性

1. **Job Title 关联**：调用外部模块接口获取 Job Title 列表
2. **多版本简历**：每个 Job Title 可上传多份简历（存储在 AWS S3）
3. **最终版本标记**：支持设置和取消最终版本（Set Final / Cancel Final）
4. **单次计费约束**：每个 Job Title 只能为一份简历计费一次
5. **状态管理**：使用 `status` 字段管理简历状态（uploaded/final/deleted）

---

## 2. 核心概念与架构

### 2.1 核心概念

#### 2.1.1 Resume（简历）

**定义：** 学生针对某个 Job Title 上传的简历文件及其元数据。

**特点：**
- 每个 Resume 属于一个 Job Title（直接存储 Job Title 文本）
- 一个 Job Title 可以有多个 Resume
- 每个 Job Title 最多只能有一个 Resume 被设置为 Final（status='final'）
- 每个 Job Title 最多只能有一个 Resume 被计费（mentorUserId 非空）
- 简历文件存储在 AWS S3，数据库仅存储 URL

#### 2.1.2 Resume Billing（简历计费）

**定义：** 针对某份简历向导师支付费用的记录。

**约束：**
- 每个 Job Title 只能计费一次
- 计费后不影响 Set Final / Cancel Final 操作
- 计费时必须选择导师
- 计费时必须提供原因说明

### 2.2 架构设计

#### 2.2.1 数据流向

```
┌──────────────┐
│   学生        │
└──────┬───────┘
       │ 1. 调用外部接口获取 Job Title 列表
       ▼
┌─────────────────────┐
│  外部 Job Title模块  │
└──────┬──────────────┘
       │ 2. 选择 Job Title 并上传简历到 S3
       ▼
┌─────────────────────────────┐
│  Resumes (简历表)            │
│  - jobTitle (文本)           │
│  - fileUrl (S3)             │
│  - status (uploaded/final)  │
│  - mentorUserId (计费导师)  │
│  - billedAt (计费时间)      │
│  - finalSetAt (Final时间)   │
└─────────────────────────────┘
```

#### 2.2.2 模块依赖

```
┌─────────────────────────────────────────────────────┐
│               Resume Domain 架构                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  API Layer (Controller)                             │
│  - Resume Controller                                │
│  - Job Title Controller                             │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Service Layer                                      │
│  - Resume Service                                   │
│  - Resume Billing Service                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Repository Layer                                   │
│  - Resume Repository                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Database Layer (PostgreSQL)                        │
│  - resumes (简历核心信息)                            │
└─────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 核心表结构

Resume Domain 仅包含 1 张核心表：

| 表名       | 类型   | 职责                              |
| ---------- | ------ | --------------------------------- |
| `resumes` | 实体表 | 简历核心信息（文件、状态、计费） |

#### 3.1.1 表设计说明

```
┌──────────────────────────────────┐
│          resumes                 │
├──────────────────────────────────┤
│  - id (主键)                     │
│  - studentUserId (外键→users)   │
│  - jobTitle (文本)               │
│  - fileUrl (S3 URL)             │
│  - fileName (原始文件名)         │
│  - status (状态枚举)             │
│  - finalSetAt (Final时间)       │
│  - mentorUserId (计费导师)      │
│  - billedAt (计费时间)          │
│  - uploadedBy (上传人)          │
│  - createdAt / updatedAt        │
└──────────────────────────────────┘
```

### 3.2 Schema 定义

#### 3.2.1 resumes（简历表）

**文件路径：** `src/infrastructure/database/schema/resumes.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { userTable } from './user.schema';

export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // 关联字段（参考 ai-career-sessions、regular-mentoring-sessions）
    studentUserId: uuid('student_user_id')
      .notNull()
      .references(() => userTable.id),
    
    // Job Title 信息（直接存储文本）
    jobTitle: varchar('job_title', { length: 200 }).notNull(),

    // 文件信息（AWS S3）
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileName: varchar('file_name', { length: 500 }).notNull(),

    // 状态信息
    status: varchar('status', { length: 20 }).notNull().default('uploaded'), // 'uploaded' | 'final' | 'deleted'
    finalSetAt: timestamp('final_set_at', { withTimezone: true }),

    // 计费信息
    mentorUserId: uuid('mentor_user_id').references(() => userTable.id), // NULL = 未计费
    billedAt: timestamp('billed_at', { withTimezone: true }),

    // 审计字段
    uploadedBy: uuid('uploaded_by').notNull().references(() => userTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_resumes_student_user_id').on(table.studentUserId),
    index('idx_resumes_job_title').on(table.jobTitle),
    index('idx_resumes_status').on(table.status),
    index('idx_resumes_mentor_user_id').on(table.mentorUserId),
    index('idx_resumes_student_job_title').on(table.studentUserId, table.jobTitle),
    // 状态约束
    check('resumes_status_check',
      sql`status IN ('uploaded', 'final', 'deleted')`
    ),
  ],
);

// 唯一索引约束：同一学生+Job Title，只能有一个简历被计费
// CREATE UNIQUE INDEX idx_resumes_unique_billed 
// ON resumes(student_user_id, job_title) 
// WHERE mentor_user_id IS NOT NULL;

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
```

**字段说明：**

| 字段              | 类型          | 说明                           | 约束                                    |
| ----------------- | ------------- | ------------------------------ | --------------------------------------- |
| `id`            | UUID          | 主键                           | PRIMARY KEY                             |
| `studentUserId` | UUID          | 学生ID                         | NOT NULL, FK → students, CASCADE DELETE|
| `jobTitle`      | VARCHAR(200)  | 职位类型文本                   | NOT NULL                                |
| `fileUrl`       | VARCHAR(1000) | S3 文件 URL                    | NOT NULL                                |
| `fileName`      | VARCHAR(500)  | 原始文件名                     | NOT NULL                                |
| `status`        | ENUM          | 简历状态                       | NOT NULL, DEFAULT 'uploaded'            |
| `finalSetAt`    | TIMESTAMP     | 设置为最终版本的时间           | 月度统计用                              |
| `mentorUserId`  | UUID          | 计费导师ID（NULL=未计费）      | FK → users                             |
| `billedAt`      | TIMESTAMP     | 计费时间                       | 月度统计导师费用用                      |
| `uploadedBy`    | UUID          | 上传人                         | NOT NULL, FK → users                   |
| `createdAt`     | TIMESTAMP     | 创建时间                       | NOT NULL                                |
| `updatedAt`     | TIMESTAMP     | 更新时间                       | NOT NULL                                |

---

## 4. 领域服务接口

### 4.1 ResumeService（简历管理服务）

**职责：** 管理简历的上传、查询、删除和操作

**服务方法（5个）：**

| #  | 方法名              | 方法签名                                                                                      | 功能说明                                      |
| -- | ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1  | `upload`          | `upload(dto: UploadResumeDto, userId: string): Promise<Resume>`                            | 上传简历                                      |
| 2  | `listByStudent`   | `listByStudent(studentUserId: string): Promise<Record<string, ResumeDetail[]>>`            | 查询学生的简历列表（按 Job Title 分组返回）   |
| 3  | `setFinal`        | `setFinal(resumeId: string, userId: string): Promise<Resume>`                               | 设置为最终版本（自动取消旧 Final）            |
| 4  | `cancelFinal`     | `cancelFinal(resumeId: string, userId: string): Promise<Resume>`                            | 取消最终版本                                  |
| 5  | `delete`          | `delete(resumeId: string, userId: string): Promise<void>`                                   | 删除简历（软删除，已计费和 Final 状态不可删除）|

**实现位置：** `src/domains/services/resume/services/resume.service.ts`

### 4.2 ResumeBillingService（简历计费服务）

**职责：** 处理简历计费逻辑

**服务方法（1个）：**

| # | 方法名            | 方法签名                                                                                      | 功能说明                     |
| - | ----------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| 1 | `billResume`    | `billResume(dto: BillResumeDto, userId: string): Promise<Resume>`                          | 为简历计费（每个职位类型仅一次，自动写入 service_references 表并发布事件）|

**实现位置：** `src/domains/services/resume/services/resume-billing.service.ts`

**计费流程（事务）：**
1. 验证 Job Title 是否已计费（唯一索引 + 服务层校验）
2. 更新简历计费状态（mentorUserId、billedAt）
3. 写入 `service_references` 表（记录服务消耗）
4. 发布 `resume.billed` 事件

---

## 5. DTO 定义

### 5.1 Resume DTOs

#### 5.1.1 UploadResumeDto

```typescript
interface UploadResumeDto {
  studentUserId: string;   // 学生ID
  jobTitle: string;        // 职位类型文本（如 'Software Engineer'）
  fileName: string;        // 原始文件名
  fileUrl: string;         // S3 文件 URL
}
```

**验证规则：**

- ✅ `studentUserId` 必填，必须存在
- ✅ `jobTitle` 必填，长度不超过 200 字符
- ✅ `fileName` 必填
- ✅ `fileUrl` 必填，必须是有效的 S3 URL

#### 5.1.2 BillResumeDto

```typescript
interface BillResumeDto {
  resumeId: string;         // 简历ID
  mentorUserId: string;     // 导师ID（必填）
}
```

**验证规则：**

- ✅ `resumeId` 必填，必须存在
- ✅ `mentorUserId` 必填，必须存在且为导师角色
- ✅ 该简历所属的 Job Title 不能已计费过

#### 5.1.3 ResumeDetail（响应接口）

```typescript
interface ResumeDetail {
  id: string;
  studentUserId: string;
  jobTitle: string;           // 职位类型文本
  fileName: string;
  fileUrl: string;            // S3 URL
  status: 'uploaded' | 'final' | 'deleted';
  finalSetAt?: Date;          // Final 时间（月度统计用）
  mentorUserId?: string;      // 计费导师ID（NULL = 未计费）
  billedAt?: Date;            // 计费时间（月度导师费用统计用）
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 6. 业务规则与验证

### 6.1 Resume 业务规则

#### 6.1.1 上传规则

| 规则           | 说明                                         | 错误代码                   |
| -------------- | -------------------------------------------- | -------------------------- |
| 学生存在性     | `studentUserId` 必须存在                   | `STUDENT_NOT_FOUND`      |
| Job Title 必填 | `jobTitle` 必填，长度不超过 200           | `JOB_TITLE_REQUIRED`     |
| 文件 URL 验证  | `fileUrl` 必须是有效的 S3 URL             | `INVALID_FILE_URL`       |

#### 6.1.2 Set Final 规则

| 规则           | 说明                                                          | 错误代码                          |
| -------------- | ------------------------------------------------------------- | --------------------------------- |
| 简历存在性     | `resumeId` 必须存在                                         | `RESUME_NOT_FOUND`              |
| 状态检查       | 简历必须是 `status='uploaded'`                              | `INVALID_STATUS`                |
| 唯一性约束     | 同一 Job Title 只能有一个 Final 简历，自动取消旧的 Final     | -                                 |
| 原因必填       | `reason` 必填                                               | `REASON_REQUIRED`               |
| 已计费可设置   | 即便简历已计费，依然可以 Set Final / Cancel Final             | -                                 |

#### 6.1.3 Cancel Final 规则

| 规则       | 说明                               | 错误代码                  |
| ---------- | ---------------------------------- | ------------------------- |
| 简历存在性 | `resumeId` 必须存在              | `RESUME_NOT_FOUND`      |
| 状态检查   | 简历必须是 `status='final'`      | `RESUME_NOT_FINAL`      |
| 原因必填   | `reason` 必填                    | `REASON_REQUIRED`       |

#### 6.1.4 计费规则

| 规则           | 说明                                           | 错误代码                          |
| -------------- | ---------------------------------------------- | --------------------------------- |
| 简历存在性     | `resumeId` 必须存在                          | `RESUME_NOT_FOUND`              |
| 导师存在性     | `mentorUserId` 必须存在且为导师角色          | `MENTOR_NOT_FOUND`              |
| 单次计费约束   | 同一 Job Title 只能计费一次                    | `JOB_TITLE_ALREADY_BILLED`      |
| 原因必填       | `reason` 必填                                | `REASON_REQUIRED`               |
| 计费后不可修改 | 简历计费后（mentorUserId 非空），不能再次计费 | `RESUME_ALREADY_BILLED`         |

#### 6.1.5 删除规则

| 规则       | 说明                                   | 错误代码                  |
| ---------- | -------------------------------------- | ------------------------- |
| 简历存在性 | `resumeId` 必须存在                  | `RESUME_NOT_FOUND`      |
| 已计费限制 | 已计费的简历不允许删除（mentorUserId 非空）| `BILLED_RESUME_CANNOT_DELETE` |
| Final 限制 | Final 状态的简历不允许删除（status='final'）| `FINAL_RESUME_CANNOT_DELETE` |

### 6.2 错误代码清单

#### 6.2.1 Resume 相关错误

| 错误代码                          | HTTP状态码 | 说明                               |
| --------------------------------- | ---------- | ---------------------------------- |
| `RESUME_NOT_FOUND`              | 404        | 简历不存在                         |
| `STUDENT_NOT_FOUND`             | 404        | 学生不存在                         |
| `MENTOR_NOT_FOUND`              | 404        | 导师不存在                         |
| `JOB_TITLE_REQUIRED`            | 400        | Job Title 必填                     |
| `INVALID_FILE_URL`              | 400        | 文件 URL 无效                      |
| `INVALID_STATUS`                | 400        | 简历状态不正确                     |
| `RESUME_NOT_FINAL`              | 400        | 简历不是最终版本（status≠'final'）|
| `JOB_TITLE_ALREADY_BILLED`      | 400        | 该职位类型已计费，不能再次计费     |
| `RESUME_ALREADY_BILLED`         | 400        | 该简历已计费（mentorUserId 非空）  |
| `BILLED_RESUME_CANNOT_DELETE`   | 400        | 已计费的简历不允许删除             |
| `FINAL_RESUME_CANNOT_DELETE`    | 400        | Final 状态的简历不允许删除         |
| `REASON_REQUIRED`               | 400        | 必须提供操作原因                   |

---

## 7. 状态机设计

### 7.1 Resume 状态机

```
┌─────────────────────────────────────────────────────────────┐
│                    Resume 状态机                             │
└─────────────────────────────────────────────────────────────┘

         upload()
           │
           ▼
      ┌────────────┐
      │  uploaded  │
      │  (已上传)  │
      └─────┬──────┘
            │
            │ setFinal()
            ▼
      ┌────────────┐      cancelFinal()       ┌────────────┐
      │   final    │ ──────────────────────▶  │  uploaded  │
      │ (最终版本) │                           │  (已上传)  │
      └─────┬──────┘                           └────────────┘
            │                                        │
            │ delete()                               │ delete()
            ▼                                        ▼
      ┌────────────┐                          ┌────────────┐
      │  deleted   │                          │  deleted   │
      │  (已删除)  │                          │  (已删除)  │
      └────────────┘                          └────────────┘


计费说明（独立于 status）：
- mentorUserId 为 NULL：未计费
- mentorUserId 非空：已计费
- 计费操作不改变 status 字段
- 已计费的简历不允许删除（status 不能变为 'deleted'）

状态说明：
- uploaded: 已上传状态，可以 Set Final 或计费
- final: 最终版本状态，可以 Cancel Final 或计费
- deleted: 已删除状态（软删除，仅未计费的简历可删除）
```

**状态转换规则：**

| 当前状态     | 允许操作        | 目标状态     | 备注                               |
| ------------ | --------------- | ------------ | ---------------------------------- |
| `uploaded` | `setFinal()`  | `final`    | 同一 Job Title 只能有一个 Final    |
| `final`    | `cancelFinal()`| `uploaded` | finalSetAt 清空                    |
| `uploaded` | `delete()`    | `deleted`  | 仅未计费的简历可删除               |
| `final`    | `delete()`    | `deleted`  | 仅未计费的简历可删除               |
| `任意状态`   | `billResume()`| 保持不变     | mentorUserId 设置，同一 Job Title 只能计费一次 |

---

## 8. API 接口设计

**说明：** Job Title 由外部模块管理，本模块通过调用外部接口获取 Job Title 列表。

### 8.1 Resume 接口

#### 8.1.1 上传简历

**接口路径：** `POST /api/resume/resumes`

**请求体：**

```json
{
  "studentUserId": "uuid",
  "jobTitle": "Software Engineer",
  "fileName": "resume.pdf",
  "fileUrl": "https://s3.amazonaws.com/bucket/resumes/resume.pdf"
}
```

**响应示例：**

```json
{
  "code": 201,
  "message": "Resume uploaded successfully",
  "data": {
    "id": "uuid",
    "studentUserId": "uuid",
    "jobTitle": "Software Engineer",
    "fileName": "resume.pdf",
    "fileUrl": "https://s3.amazonaws.com/bucket/resumes/resume.pdf",
    "status": "uploaded",
    "createdAt": "2025-12-15T10:00:00Z"
  }
}
```

#### 8.1.2 获取学生简历列表

**接口路径：** `GET /api/resume/resumes/student/:studentUserId`

**查询参数：** 无

**响应示例（按 Job Title 分组）：**

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "Software Engineer": [
      {
        "id": "uuid-1",
        "studentUserId": "uuid",
        "jobTitle": "Software Engineer",
        "fileName": "resume_v1.pdf",
        "fileUrl": "https://s3.amazonaws.com/bucket/resumes/resume_v1.pdf",
        "status": "final",
        "finalSetAt": "2025-12-15T10:00:00Z",
        "mentorUserId": null,
        "createdAt": "2025-12-14T10:00:00Z"
      },
      {
        "id": "uuid-2",
        "studentUserId": "uuid",
        "jobTitle": "Software Engineer",
        "fileName": "resume_v2.pdf",
        "fileUrl": "https://s3.amazonaws.com/bucket/resumes/resume_v2.pdf",
        "status": "uploaded",
        "mentorUserId": null,
        "createdAt": "2025-12-15T10:00:00Z"
      }
    ],
    "Financial Analyst": [
      {
        "id": "uuid-3",
        "studentUserId": "uuid",
        "jobTitle": "Financial Analyst",
        "fileName": "resume_fa.pdf",
        "fileUrl": "https://s3.amazonaws.com/bucket/resumes/resume_fa.pdf",
        "status": "uploaded",
        "mentorUserId": null,
        "createdAt": "2025-12-10T10:00:00Z"
      }
    ]
  }
}
```

#### 8.1.3 设置最终版本

**接口路径：** `POST /api/resume/resumes/:resumeId/set-final`

**请求体：** 无

**响应示例：**

```json
{
  "code": 200,
  "message": "Resume set as final successfully",
  "data": {
    "id": "uuid",
    "status": "final",
    "finalSetAt": "2025-12-15T10:00:00Z"
  }
}
```

#### 8.1.4 取消最终版本

**接口路径：** `POST /api/resume/resumes/:resumeId/cancel-final`

**请求体：** 无

**响应示例：**

```json
{
  "code": 200,
  "message": "Final status canceled successfully",
  "data": {
    "id": "uuid",
    "status": "uploaded",
    "finalSetAt": null
  }
}
```

#### 8.1.5 简历计费

**接口路径：** `POST /api/resume/billing`

**请求体：**

```json
{
  "resumeId": "uuid",
  "mentorUserId": "mentor-uuid"
}
```

**响应示例：**

```json
{
  "code": 200,
  "message": "Resume billed successfully",
  "data": {
    "id": "uuid",
    "mentorUserId": "mentor-uuid",
    "billedAt": "2025-12-15T10:00:00Z"
  }
}
```

#### 8.1.6 删除简历

**接口路径：** `DELETE /api/resume/resumes/:resumeId`

**响应示例：**

```json
{
  "code": 200,
  "message": "Resume deleted successfully",
  "data": null
}
```

---

## 9. 实现指南

### 9.1 目录结构

**参考：** `src/domains/services/sessions/regular-mentoring/`

```
src/domains/services/resume/
├── resume.module.ts
├── services/
│   ├── resume.service.ts
│   └── resume-billing.service.ts
├── repositories/
│   └── resume.repository.ts
├── dto/
│   ├── upload-resume.dto.ts
│   └── bill-resume.dto.ts
├── entities/
│   └── resume.entity.ts
└── mappers/
    └── resume.mapper.ts
```

### 9.2 模块依赖

```typescript
// src/domains/services/resume/resume.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { ResumeService } from './services/resume.service';
import { ResumeBillingService } from './services/resume-billing.service';
import { ResumeRepository } from './repositories/resume.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    ResumeService,
    ResumeBillingService,
    ResumeRepository,
  ],
  exports: [
    ResumeService,
    ResumeBillingService,
  ],
})
export class ResumeModule {}
```

### 9.3 服务实现要点

#### 9.3.1 ResumeService 核心逻辑

- **上传简历**：验证 S3 URL 格式
- **Set Final**：自动取消同一 Job Title 的旧 Final（更新 status 和 finalSetAt）
- **Cancel Final**：更新 status='uploaded'，清空 finalSetAt
- **删除简历**：已计费和 Final 状态不可删除
- **列表查询**：按 Job Title 分组返回（后端分组）

#### 9.3.2 ResumeBillingService 核心逻辑

**计费流程（事务）：**
1. 验证 Job Title 是否已计费（唯一索引 + 服务层校验）
2. 更新简历计费状态（mentorUserId、billedAt）
3. 写入 `service_references` 表
4. 发布 `resume.billed` 事件

**Service References 记录格式：**
```typescript
{
  id: resumeId,
  serviceType: 'resume_review',
  title: `${jobTitle} Resume Review`,
  studentUserId: resume.studentUserId,
  providerUserId: resume.mentorUserId,
  consumedUnits: '1.00',
  unitType: 'times',
  completedTime: new Date(),
}
```

**事件发布：**
```typescript
// 事件名：resume.billed
{
  resumeId: string,
  studentUserId: string,
  mentorUserId: string,
  jobTitle: string,
  billedAt: Date,
}
```

#### 9.3.3 文件上传说明

**S3 上传由独立 File Service 处理：**
1. 前端调用 `POST /api/files/upload` 上传文件到 S3
2. File Service 返回 S3 URL
3. 前端调用 Resume API 创建简历记录（传入 S3 URL）
4. Resume 模块仅验证 URL 格式并存储

### 9.4 数据库迁移步骤

#### 9.4.1 创建 Schema 文件

```bash
# 创建 resumes schema
touch src/infrastructure/database/schema/resumes.schema.ts
```

#### 9.4.2 更新 schema/index.ts

```typescript
// src/infrastructure/database/schema/index.ts
export * from './resumes.schema';
```

#### 9.4.3 生成 Drizzle 迁移

```bash
npm run db:generate
```

#### 9.4.4 创建补充 SQL 迁移（索引和触发器）

**文件：** `src/infrastructure/database/migrations/xxxx_create_resume_indexes_and_triggers.sql`

```sql
-- ============================================
-- Resume Domain - 唯一索引约束
-- ============================================

-- 唯一索引约束：同一学生+Job Title，只能有一个简历被计费
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_unique_billed 
ON resumes(student_user_id, job_title) 
WHERE mentor_user_id IS NOT NULL;

-- 触发器（自动更新 updated_at）
CREATE TRIGGER update_resumes_updated_at
  BEFORE UPDATE ON resumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 9.4.5 应用迁移

```bash
# 开发环境（直接推送，包含 Drizzle 迁移）
npm run db:push

# 手动应用 SQL 迁移（索引和触发器）
psql $DATABASE_URL < src/infrastructure/database/migrations/xxxx_create_resume_indexes_and_triggers.sql

# 生产环境（运行所有迁移）
npm run db:migrate
```

### 9.5 统一错误处理

**使用项目统一异常处理机制：**

```typescript
// 使用 NestJS 内置异常
import { BadRequestException, NotFoundException } from '@nestjs/common';

// 示例
throw new NotFoundException('RESUME_NOT_FOUND');
throw new BadRequestException('JOB_TITLE_ALREADY_BILLED');
```

### 9.6 关键实现要点

**数据库约束：**
- 唯一索引确保同一 Job Title 单次计费
- 外键引用 `userTable.id`（与 session 表保持一致）
- status 字段 CHECK 约束

**事务处理：**
- 计费操作必须在事务中完成
- Set Final 操作需要事务（取消旧 Final + 设置新 Final）

**事件发布：**
- 仅计费成功后发布 `resume.billed` 事件
- 事件包含：resumeId、studentUserId、mentorUserId、jobTitle、billedAt

**Service References：**
- serviceType: `'resume_review'`
- unitType: `'times'`
- consumedUnits: `'1.00'`

---

**文档结束**


