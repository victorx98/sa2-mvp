# Identity Domain 领域服务接口文档

> **版本：** v1.0.0  
> **创建日期：** 2025-01-09  
> **状态：** 接口设计完成  
> **负责域：** Identity Domain（身份域）  
> **文档编号：** IDENTITY-DOMAIN-SERVICES-2025-01-09

## 📋 目录

- [1. 概述](#1-概述)
- [2. UserService 接口](#2-userservice-接口)
  - [2.1 用户查询接口](#21-用户查询接口)
  - [2.2 用户创建接口](#22-用户创建接口)
  - [2.3 用户更新接口](#23-用户更新接口)
  - [2.4 角色管理接口](#24-角色管理接口)
- [3. StudentProfileService 接口](#3-studentprofileservice-接口)
  - [3.1 学生档案查询](#31-学生档案查询)
  - [3.2 学生档案创建](#32-学生档案创建)
  - [3.3 学生档案更新](#33-学生档案更新)
- [4. MentorProfileService 接口](#4-mentorprofileservice-接口)
  - [4.1 导师档案查询](#41-导师档案查询)
  - [4.2 导师档案创建](#42-导师档案创建)
  - [4.3 导师档案更新](#43-导师档案更新)
- [5. CounselorProfileService 接口](#5-counselorprofileservice-接口)
  - [5.1 顾问档案查询](#51-顾问档案查询)
  - [5.2 顾问档案创建](#52-顾问档案创建)
  - [5.3 顾问档案更新](#53-顾问档案更新)

---

## 1. 概述

本文档描述 Identity Domain 对外提供的领域服务接口。这些接口由 Domain Layer 实现，供 Application Layer 调用。

**设计原则：**
- Domain Layer 不直接暴露 REST API
- 所有接口支持事务参数（`tx?: DrizzleTransaction`），确保数据一致性
- 接口返回领域实体或领域值对象，不返回 DTO
- 接口专注于业务逻辑，不涉及 HTTP 相关概念

---

## 2. UserService 接口

### 2.1 用户查询接口

#### 2.1.1 findById

**方法签名：**

```typescript
findById(id: string): Promise<User | null>
```

**功能描述：** 根据用户ID查询用户信息（不包含角色）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 用户ID（UUID） |

**返回值：** `Promise<User | null>`

**返回数据：**

```typescript
interface User {
  id: string;
  email: string;
  gender?: Gender;
  nameEn?: string;
  nameZh?: string;
  status?: string;
  country?: Country;
  createdTime?: Date;
  modifiedTime?: Date;
  roles?: string[];  // 此方法不返回角色信息
}
```

**异常：** 无（返回 null 表示用户不存在）

#### 2.1.2 findByIdWithRoles

**方法签名：**

```typescript
findByIdWithRoles(id: string): Promise<User | null>
```

**功能描述：** 根据用户ID查询用户信息（包含角色列表）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 用户ID（UUID） |

**返回值：** `Promise<User | null>`

**返回数据：** 同 `findById`，但 `roles` 字段包含用户的所有角色

**异常：** 无（返回 null 表示用户不存在）

#### 2.1.3 findByEmail

**方法签名：**

```typescript
findByEmail(email: string): Promise<User | null>
```

**功能描述：** 根据邮箱查询用户信息（不包含角色）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| email | string | 是 | 用户邮箱地址 |

**返回值：** `Promise<User | null>`

**返回数据：** 同 `findById`

**异常：** 无（返回 null 表示用户不存在）

### 2.2 用户创建接口

#### 2.2.1 create

**方法签名：**

```typescript
create(user: CreateUserInput, tx?: DrizzleTransaction): Promise<User>
```

**功能描述：** 创建新用户（不分配角色）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user | CreateUserInput | 是 | 用户创建输入 |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**输入数据：**

```typescript
interface CreateUserInput {
  id: string;              // 用户ID（必须与 auth.users.id 一致）
  email: string;           // 邮箱
  nameEn?: string;         // 英文姓名
  nameZh?: string;         // 中文姓名
  gender?: Gender;         // 性别
  status?: string;         // 用户状态
  country?: Country;       // 国家代码
}
```

**返回值：** `Promise<User>`

**异常：**
- 如果用户ID已存在，可能抛出数据库约束异常

#### 2.2.2 createWithRoles

**方法签名：**

```typescript
createWithRoles(
  user: CreateUserInput,
  roles: string[],
  tx?: DrizzleTransaction,
): Promise<User>
```

**功能描述：** 创建新用户并分配角色（原子操作）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user | CreateUserInput | 是 | 用户创建输入 |
| roles | string[] | 是 | 角色ID列表（如 ['student', 'mentor']） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<User>`（包含角色信息）

**异常：**
- 如果用户ID已存在，可能抛出数据库约束异常
- 如果角色ID不存在，可能抛出外键约束异常

### 2.3 用户更新接口

#### 2.3.1 update

**方法签名：**

```typescript
update(
  id: string,
  user: Partial<CreateUserInput>,
  tx?: DrizzleTransaction,
): Promise<User>
```

**功能描述：** 更新用户信息（部分更新）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 用户ID |
| user | Partial<CreateUserInput> | 是 | 需要更新的字段（部分字段） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<User>`（更新后的用户信息）

**异常：**
- 如果用户不存在，可能抛出异常

### 2.4 角色管理接口

#### 2.4.1 authorizeRoles

**方法签名：**

```typescript
authorizeRoles(
  userId: string,
  roles: string[],
  tx?: DrizzleTransaction,
): Promise<string[]>
```

**功能描述：** 为用户分配角色（如果角色已存在则跳过）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| roles | string[] | 是 | 角色ID列表 |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<string[]>`（返回用户当前的所有角色ID列表）

**异常：**
- 如果用户不存在，可能抛出异常
- 如果角色ID不存在，可能抛出外键约束异常

#### 2.4.2 getRolesByUserId

**方法签名：**

```typescript
getRolesByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<string[]>
```

**功能描述：** 查询用户的所有角色

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<string[]>`（角色ID列表，如 ['student', 'mentor']）

**异常：** 无（返回空数组表示用户没有角色）

---

## 3. StudentProfileService 接口

### 3.1 学生档案查询

#### 3.1.1 getAggregateByUserId

**方法签名：**

```typescript
getAggregateByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<{ user: User; profile: Student }>
```

**功能描述：** 根据用户ID查询学生完整档案（包含 User 基础信息和 Student Profile 专有信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 student.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<{ user: User; profile: Student }>`

**返回数据：**

```typescript
{
  user: {
    id: string;                 // 用户ID
    email: string;              // 邮箱
    gender?: Gender;            // 性别
    nameEn?: string;            // 英文姓名
    nameZh?: string;            // 中文姓名
    status?: string;            // 用户状态
    country?: Country;          // 国家代码
    roles?: string[];           // 用户角色列表
    createdTime?: Date;         // 创建时间
    modifiedTime?: Date;        // 更新时间
  },
  profile: {
    id: string;                    // 用户ID（FK -> user.id）
    status?: string;               // 学生状态
    highSchool?: string | null;    // 高中学校ID（FK -> schools.id）
    underCollege?: string | null;   // 本科院校ID（FK -> schools.id）
    underMajor?: string | null;     // 本科专业ID（FK -> majors.id）
    graduateCollege?: string | null; // 研究生院校ID（FK -> schools.id）
    graduateMajor?: string | null;   // 研究生专业ID（FK -> majors.id）
    aiResumeSummary?: string | null; // AI简历摘要
    customerImportance?: string | null; // 客户重要性
    graduationDate?: string | null;   // 毕业时间（DATE）
    grades?: string | null;          // 成绩信息
    createdTime?: Date;              // 创建时间
    modifiedTime?: Date;             // 更新时间
    createdBy?: string;              // 创建人ID
    updatedBy?: string;              // 更新人ID
  }
}
```

**异常：**
- `NotFoundException`：如果用户不存在或学生档案不存在

#### 3.1.2 findByUserId

**方法签名：**

```typescript
findByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<Student | null>
```

**功能描述：** 根据用户ID查询学生档案（仅返回 Profile 信息，不包含 User 基础信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 student.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<Student | null>`

**返回数据：** 仅返回 Student Profile 实体（不包含 User 信息）

**异常：** 无（返回 null 表示学生档案不存在）

**说明：** 此方法用于仅需要 Profile 信息的场景，如需完整档案请使用 `getAggregateByUserId`

### 3.2 学生档案创建

#### 3.2.1 ensureProfile

**方法签名：**

```typescript
ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void>
```

**功能描述：** 确保学生档案存在（如果不存在则创建，存在则不做任何操作）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<void>`

**异常：** 无（幂等操作）

### 3.3 学生档案更新

#### 3.3.1 update

**方法签名：**

```typescript
update(
  userId: string,
  input: IUpdateStudentProfileInput,
  updatedBy: string,
  tx?: DrizzleTransaction,
): Promise<Student>
```

**功能描述：** 更新学生档案（部分更新）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| input | IUpdateStudentProfileInput | 是 | 需要更新的字段（部分字段） |
| updatedBy | string | 是 | 更新人ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**输入数据：**

```typescript
interface IUpdateStudentProfileInput {
  status?: string;
  highSchool?: string | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
  aiResumeSummary?: string | null;
  customerImportance?: string | null;
  graduationDate?: string | null;  // ISO 8601 日期格式：YYYY-MM-DD
  grades?: string | null;
}
```

**返回值：** `Promise<Student>`（更新后的学生档案）

**异常：**
- `NotFoundException`：如果学生档案不存在

---

## 4. MentorProfileService 接口

### 4.1 导师档案查询

#### 4.1.1 getAggregateByUserId

**方法签名：**

```typescript
getAggregateByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<{ user: User; profile: Mentor }>
```

**功能描述：** 根据用户ID查询导师完整档案（包含 User 基础信息和 Mentor Profile 专有信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 mentor.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<{ user: User; profile: Mentor }>`

**返回数据：**

```typescript
{
  user: {
    id: string;                 // 用户ID
    email: string;              // 邮箱
    gender?: Gender;            // 性别
    nameEn?: string;            // 英文姓名
    nameZh?: string;            // 中文姓名
    status?: string;            // 用户状态
    country?: Country;          // 国家代码
    roles?: string[];           // 用户角色列表
    createdTime?: Date;         // 创建时间
    modifiedTime?: Date;        // 更新时间
  },
  profile: {
    id: string;                    // 用户ID（FK -> user.id）
    status?: string;               // 导师状态
    type?: string | null;          // 导师类型
    company?: string | null;       // 公司名称
    companyTitle?: string | null;  // 公司职位
    briefIntro?: string | null;   // 个人简介
    highSchool?: string | null;    // 高中学校ID（FK -> schools.id）
    location?: string | null;      // 位置
    level?: string | null;         // 级别
    rating?: number | null;        // 评分
    underCollege?: string | null;  // 本科院校ID（FK -> schools.id）
    underMajor?: string | null;    // 本科专业ID（FK -> majors.id）
    graduateCollege?: string | null; // 研究生院校ID（FK -> schools.id）
    graduateMajor?: string | null;   // 研究生专业ID（FK -> majors.id）
    createdTime?: Date;              // 创建时间
    modifiedTime?: Date;             // 更新时间
    createdBy?: string;              // 创建人ID
    updatedBy?: string;              // 更新人ID
  }
}
```

**异常：**
- `NotFoundException`：如果用户不存在或导师档案不存在

#### 4.1.2 findByUserId

**方法签名：**

```typescript
findByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<Mentor | null>
```

**功能描述：** 根据用户ID查询导师档案（仅返回 Profile 信息，不包含 User 基础信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 mentor.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<Mentor | null>`

**返回数据：** 仅返回 Mentor Profile 实体（不包含 User 信息）

**异常：** 无（返回 null 表示导师档案不存在）

**说明：** 此方法用于仅需要 Profile 信息的场景，如需完整档案请使用 `getAggregateByUserId`

### 4.2 导师档案创建

#### 4.2.1 ensureProfile

**方法签名：**

```typescript
ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void>
```

**功能描述：** 确保导师档案存在（如果不存在则创建，存在则不做任何操作）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<void>`

**异常：** 无（幂等操作）

### 4.3 导师档案更新

#### 4.3.1 update

**方法签名：**

```typescript
update(
  userId: string,
  input: UpdateMentorProfileInput,
  updatedBy: string,
  tx?: DrizzleTransaction,
): Promise<Mentor>
```

**功能描述：** 更新导师档案（部分更新）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| input | UpdateMentorProfileInput | 是 | 需要更新的字段（部分字段） |
| updatedBy | string | 是 | 更新人ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**输入数据：**

```typescript
interface UpdateMentorProfileInput {
  status?: string;
  type?: string | null;
  company?: string | null;
  companyTitle?: string | null;
  briefIntro?: string | null;
  highSchool?: string | null;
  location?: string | null;
  level?: string | null;
  rating?: number | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
}
```

**返回值：** `Promise<Mentor>`（更新后的导师档案）

**异常：**
- `NotFoundException`：如果导师档案不存在

---

## 5. CounselorProfileService 接口

### 5.1 顾问档案查询

#### 5.1.1 getAggregateByUserId

**方法签名：**

```typescript
getAggregateByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<{ user: User; profile: Counselor }>
```

**功能描述：** 根据用户ID查询顾问完整档案（包含 User 基础信息和 Counselor Profile 专有信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 counselor.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<{ user: User; profile: Counselor }>`

**返回数据：**

```typescript
{
  user: {
    id: string;                 // 用户ID
    email: string;              // 邮箱
    gender?: Gender;            // 性别
    nameEn?: string;            // 英文姓名
    nameZh?: string;            // 中文姓名
    status?: string;            // 用户状态
    country?: Country;          // 国家代码
    roles?: string[];           // 用户角色列表
    createdTime?: Date;         // 创建时间
    modifiedTime?: Date;        // 更新时间
  },
  profile: {
    id: string;                    // 用户ID（FK -> user.id）
    status?: string;               // 顾问状态
    createdTime?: Date;             // 创建时间
    modifiedTime?: Date;            // 更新时间
    createdBy?: string;             // 创建人ID
    updatedBy?: string;             // 更新人ID
  }
}
```

**异常：**
- `NotFoundException`：如果用户不存在或顾问档案不存在

#### 5.1.2 findByUserId

**方法签名：**

```typescript
findByUserId(
  userId: string,
  tx?: DrizzleTransaction,
): Promise<Counselor | null>
```

**功能描述：** 根据用户ID查询顾问档案（仅返回 Profile 信息，不包含 User 基础信息）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID（UUID，与 counselor.id 一致） |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<Counselor | null>`

**返回数据：** 仅返回 Counselor Profile 实体（不包含 User 信息）

**异常：** 无（返回 null 表示顾问档案不存在）

**说明：** 此方法用于仅需要 Profile 信息的场景，如需完整档案请使用 `getAggregateByUserId`

### 5.2 顾问档案创建

#### 5.2.1 ensureProfile

**方法签名：**

```typescript
ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void>
```

**功能描述：** 确保顾问档案存在（如果不存在则创建，存在则不做任何操作）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**返回值：** `Promise<void>`

**异常：** 无（幂等操作）

### 5.3 顾问档案更新

#### 5.3.1 update

**方法签名：**

```typescript
update(
  userId: string,
  input: Partial<UpdateCounselorProfileInput>,
  updatedBy: string,
  tx?: DrizzleTransaction,
): Promise<Counselor>
```

**功能描述：** 更新顾问档案（部分更新）

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| input | Partial<UpdateCounselorProfileInput> | 是 | 需要更新的字段（部分字段） |
| updatedBy | string | 是 | 更新人ID |
| tx | DrizzleTransaction | 否 | 数据库事务（可选） |

**输入数据：**

```typescript
interface UpdateCounselorProfileInput {
  status?: string;
}
```

**返回值：** `Promise<Counselor>`（更新后的顾问档案）

**异常：**
- `NotFoundException`：如果顾问档案不存在

---

## 附录：接口汇总

### UserService 接口汇总

| 方法名 | 功能描述 | 事务支持 |
|--------|----------|----------|
| `findById(id: string)` | 根据ID查询用户（不含角色） | 否 |
| `findByIdWithRoles(id: string)` | 根据ID查询用户（含角色） | 否 |
| `findByEmail(email: string)` | 根据邮箱查询用户 | 否 |
| `create(user, tx?)` | 创建用户 | 是 |
| `createWithRoles(user, roles, tx?)` | 创建用户并分配角色 | 是 |
| `update(id, user, tx?)` | 更新用户信息 | 是 |
| `authorizeRoles(userId, roles, tx?)` | 分配角色 | 是 |
| `getRolesByUserId(userId, tx?)` | 查询用户角色 | 否 |

### StudentProfileService 接口汇总

| 方法名 | 功能描述 | 事务支持 |
|--------|----------|----------|
| `getAggregateByUserId(userId, tx?)` | 查询学生完整档案（User + Profile） | 否 |
| `findByUserId(userId, tx?)` | 查询学生档案（仅 Profile） | 否 |
| `ensureProfile(userId, tx?)` | 确保学生档案存在 | 是 |
| `update(userId, input, updatedBy, tx?)` | 更新学生档案 | 是 |

### MentorProfileService 接口汇总

| 方法名 | 功能描述 | 事务支持 |
|--------|----------|----------|
| `getAggregateByUserId(userId, tx?)` | 查询导师完整档案（User + Profile） | 否 |
| `findByUserId(userId, tx?)` | 查询导师档案（仅 Profile） | 否 |
| `ensureProfile(userId, tx?)` | 确保导师档案存在 | 是 |
| `update(userId, input, updatedBy, tx?)` | 更新导师档案 | 是 |

### CounselorProfileService 接口汇总

| 方法名 | 功能描述 | 事务支持 |
|--------|----------|----------|
| `getAggregateByUserId(userId, tx?)` | 查询顾问完整档案（User + Profile） | 否 |
| `findByUserId(userId, tx?)` | 查询顾问档案（仅 Profile） | 否 |
| `ensureProfile(userId, tx?)` | 确保顾问档案存在 | 是 |
| `update(userId, input, updatedBy, tx?)` | 更新顾问档案 | 是 |
