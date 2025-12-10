# Placement Domain Code Review Report

**审查日期：** 2025-12-02  
**审查范围：** Placement Domain 全部代码  
**参考文档：** 
- `placement-domain-internal-referral-design.md`
- `placement-domain-proxy-application-design.md`
- `placement-domain-sea-application-design.md`

---

## 一、总体评估

### 1.1 架构合规性

| 维度 | 评分 | 说明 |
|------|------|------|
| DDD 架构 | ⭐⭐⭐⭐⭐ | 清晰的分层架构，职责分离合理 |
| 代码组织 | ⭐⭐⭐⭐⭐ | 目录结构清晰，模块化良好 |
| 类型安全 | ⭐⭐⭐⭐☆ | 使用 TypeScript 严格类型，但部分地方使用 `Record<string, unknown>` |
| 事务管理 | ⭐⭐⭐⭐⭐ | 正确使用事务确保原子性 |
| 事件发布 | ⭐⭐⭐⭐⭐ | 事件在事务提交后发布，避免不一致 |

**总体评分：** ⭐⭐⭐⭐⭐ (4.8/5) - 优秀

---

## 二、功能完整性审查

### 2.1 内推功能（Mentor Referral）

#### ✅ 已实现的功能

1. **申请提交** (`submitApplication`)
   - ✅ 支持内推类型 (`ApplicationType.REFERRAL`)
   - ✅ 初始状态正确设置为 `recommended`
   - ✅ 重复申请检查
   - ✅ 岗位存在性验证
   - ✅ 事务保证原子性

2. **状态更新** (`updateApplicationStatus`)
   - ✅ 支持所有内推相关状态转换
   - ✅ 状态转换规则验证
   - ✅ 状态历史记录
   - ✅ 事件发布（事务后）

3. **查询功能** (`search`, `findOne`, `getStatusHistory`)
   - ✅ 支持按学生、岗位、状态、类型筛选
   - ✅ 分页和排序
   - ✅ 状态历史查询

#### ✅ 已实现的功能

1. **导师分配和评估功能** (通过 `updateApplicationStatus` 实现)
   - ✅ 支持通过 `mentorId` 参数记录导师分配
   - ✅ 支持通过 `changeMetadata` 记录评估结果
   - ✅ 事件发布包含导师分配信息

#### ❌ 缺失的功能（对比设计文档）

1. **导师身份验证**
   - 📋 **设计文档期望**：只有分配的导师才能提交评估
   - ❌ **实际实现**：完全缺失（由调用方负责验证）
   - 🔒 **安全风险**：任何人都可以通过 `updateApplicationStatus` 修改状态，无导师身份验证
   - ✅ **当前方案**：在调用方（API Layer 或 Application Layer）验证导师身份

#### 🔧 推荐修复方案

**选项 A：在 `updateApplicationStatus` 中添加导师逻辑（推荐）**

```typescript
async updateApplicationStatus(dto: IUpdateApplicationStatusDto) {
  // ... 现有验证逻辑 ...

  const previousStatus = application.status as ApplicationStatus;

  // ✅ 新增：导师分配场景
  if (dto.newStatus === 'mentor_assigned') {
    const mentorId = dto.changeMetadata?.mentorId as string | undefined;
    if (!mentorId) {
      throw new BadRequestException(
        'mentorId is required in changeMetadata when assigning mentor',
      );
    }
    // 将在事务中设置 assignedMentorId
  }

  // ✅ 新增：导师评估场景
  if (previousStatus === 'mentor_assigned' && dto.newStatus === 'submitted') {
    const mentorId = dto.changeMetadata?.mentorId as string | undefined;
    
    if (!mentorId) {
      throw new BadRequestException(
        'mentorId is required in changeMetadata for mentor screening',
      );
    }

    // Security check: verify mentor is assigned [安全检查：验证导师已分配]
    if (application.assignedMentorId !== mentorId) {
      throw new BadRequestException(
        `Only the assigned mentor (${application.assignedMentorId}) can submit screening results`,
      );
    }

    // Validate screening result exists [验证评估结果存在]
    if (!dto.changeMetadata?.screeningResult) {
      throw new BadRequestException(
        'screeningResult is required in changeMetadata for mentor screening',
      );
    }
  }

  // ... 状态转换验证 ...

  const updatedApplication = await this.db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      status: dto.newStatus,
      result: this.getResultFromStatus(dto.newStatus),
    };

    // ✅ 分配导师场景：设置 assignedMentorId
    if (dto.newStatus === 'mentor_assigned' && dto.changeMetadata?.mentorId) {
      updateData.assignedMentorId = dto.changeMetadata.mentorId;
    }

    // ✅ 导师评估场景：更新 mentorScreening 字段
    if (
      previousStatus === 'mentor_assigned' &&
      dto.newStatus === 'submitted' &&
      dto.changeMetadata?.screeningResult
    ) {
      updateData.mentorScreening = dto.changeMetadata.screeningResult;
    }

    // Update result date [更新结果日期]
    const resultStatuses: ApplicationStatus[] = ["rejected"];
    if (resultStatuses.includes(dto.newStatus)) {
      updateData.resultDate = new Date().toLocaleDateString('en-CA');
    }

    const [app] = await tx
      .update(jobApplications)
      .set(updateData)
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    // ... 记录历史 ...

    return app;
  });

  // ... 事件发布 ...
}
```

**选项 B：恢复专用方法（不推荐）**
- 需要恢复 `submitMentorScreening` 方法
- 需要恢复 `ISubmitMentorScreeningDto`
- 增加 API 复杂度

---

### 2.2 代投功能（Proxy Application）

#### ✅ 已实现的功能

1. **申请提交** (`submitApplication`)
   - ✅ 支持代投类型 (`ApplicationType.PROXY`)
   - ✅ 初始状态正确设置为 `submitted`（根据代码第 86-89 行）
   - ⚠️ **与设计文档不符**：设计文档第 302 行说初始状态为 `recommended`，实际代码为 `submitted`

2. **状态更新** (`updateApplicationStatus`)
   - ✅ 支持所有代投相关状态转换
   - ✅ 状态转换规则验证

3. **查询功能**
   - ✅ 支持按申请类型筛选代投申请

#### ⚠️ 设计文档不一致

**问题：初始状态不一致**
- **设计文档**（第 302 行）：代投申请初始状态为 `recommended`
- **实际代码**（第 86-89 行）：只有 `REFERRAL` 类型初始为 `recommended`，其他类型（包括 `PROXY`）为 `submitted`

**建议：**
- 更新设计文档，明确代投初始状态为 `submitted`
- 或者修改代码，让代投也初始为 `recommended`（需要评估业务需求）

---

### 2.3 海投功能（Direct Application）

#### ✅ 已实现的功能

1. **申请提交** (`submitApplication`)
   - ✅ 支持海投类型 (`ApplicationType.DIRECT`)
   - ✅ 初始状态正确设置为 `submitted`
   - ✅ 重复申请检查
   - ✅ 岗位存在性验证

2. **状态更新** (`updateApplicationStatus`)
   - ✅ 支持海投相关状态转换
   - ✅ 状态转换规则：`submitted → interviewed/rejected`, `interviewed → got_offer/rejected`

3. **查询功能**
   - ✅ 支持按申请类型筛选海投申请

#### ✅ 完全符合设计

海投功能实现与设计文档完全一致，无缺失功能。

---

## 三、代码质量审查

### 3.1 优点

1. **✅ 事务管理正确**
   - 所有写操作都包裹在事务中
   - 事件在事务提交后发布，避免不一致

2. **✅ 状态机设计合理**
   - 使用 `ALLOWED_APPLICATION_STATUS_TRANSITIONS` 定义状态转换规则
   - 状态转换验证严格

3. **✅ 历史记录完整**
   - 每次状态变更都记录到 `applicationHistory` 表
   - 包含变更人、原因、元数据

4. **✅ 重复申请检查**
   - 使用数据库唯一约束 + 代码检查双重保护

5. **✅ 分页和排序**
   - 支持灵活的分页和排序参数

### 3.2 问题和改进建议

#### 问题 1：`mentorScreening` 字段已移除 ✅

**状态：** ✅ 已解决（方案 B）

**解决方案：**
- 使用 `updateApplicationStatus` + `changeMetadata` 记录导师评估结果
- 移除 `mentorScreening` 数据库字段
- 简化设计，避免字段冗余

**优势：**
- 统一的状态更新接口
- 所有评估数据在 `changeMetadata` 中，便于追踪
- 减少数据库字段

---

#### 问题 2：`assignedMentorId` 字段写入和查询功能 ✅

**状态：** ✅ 已解决

**实现方案：**
1. **`updateApplicationStatus`** 支持写入 `assignedMentorId`（通过 `mentorId` 参数）
2. **`rollbackApplicationStatus`** 同样支持 `mentorId` 参数
3. **`search` 方法扩展**：添加 `assignedMentorId` 筛选条件
4. **事件增强**：事件 payload 包含 `assignedMentorId` 信息

**使用示例：**
```typescript
// 分配导师时
await jobApplicationService.updateApplicationStatus({
  applicationId: 'app-id',
  newStatus: 'mentor_assigned',
  mentorId: 'mentor-id',  // ✅ 记录导师分配
  changeMetadata: {
    assignedBy: 'counselor-id',
  },
});

// 查询某导师的申请
await jobApplicationService.search({
  assignedMentorId: 'mentor-id',  // ✅ 按导师筛选
  applicationType: 'referral',
});
```

**注意事项：**
- 导师身份验证由调用方负责（API Layer 或 Application Layer）
- 当前 domain 只负责记录，不验证

---

#### 问题 3：按导师查询功能 ✅

**状态：** ✅ 已解决

**实现方案：**
复用 `search` 方法，在 `IJobApplicationSearchFilter` 中添加 `assignedMentorId` 筛选条件。

**优势：**
- 代码复用率高，无需新增方法
- 支持与其他筛选条件组合使用（如状态、类型）
- 自动获得分页和排序功能

**使用示例：**
```typescript
// 查询分配给某导师的所有推荐申请
await jobApplicationService.search(
  {
    assignedMentorId: 'mentor-id',
    applicationType: 'referral',
  },
  { page: 1, pageSize: 20 },
  { field: 'submittedAt', direction: 'desc' }
);
```

---

#### 问题 4：`resultDate` 只在 `rejected` 状态设置 🟡

**位置：** 第 168-176 行

**问题描述：**
```typescript
const resultStatuses: ApplicationStatus[] = ["rejected"];
const [app] = await tx
  .update(jobApplications)
  .set({
    status: dto.newStatus,
    result: this.getResultFromStatus(dto.newStatus),
    resultDate: resultStatuses.includes(dto.newStatus) ? new Date().toLocaleDateString('en-CA') : null,
  })
```

- 只有 `rejected` 状态设置 `resultDate`
- `got_offer` 状态也是终态，应该设置 `resultDate`

**修复建议：**
```typescript
const resultStatuses: ApplicationStatus[] = ["rejected", "got_offer"];
```

---

### 3.3 代投功能审查

#### ✅ 完全符合设计

代投功能使用相同的 `submitApplication` 和 `updateApplicationStatus` 方法，实现与设计文档一致。

**唯一问题：** 设计文档第 302 行描述初始状态为 `recommended`，但实际代码为 `submitted`（这是正确的）。

---

### 3.4 海投功能审查

#### ✅ 完全符合设计

海投功能实现与设计文档完全一致，无缺失功能。

---

## 四、数据模型审查

### 4.1 Schema 定义

#### ✅ 优点

1. **字段完整**：包含所有设计文档要求的字段
2. **索引合理**：为常用查询字段添加索引
3. **约束正确**：唯一约束防止重复申请
4. **类型安全**：使用枚举类型确保数据一致性

#### ⚠️ 问题

1. **未使用的字段**
   - `assignedMentorId`：定义了但从未使用
   - `mentorScreening`：定义了但从未写入

2. **未使用的索引**
   - `idx_job_applications_assigned_mentor`：字段为空，索引无用

---

## 五、业务规则审查

### 5.1 状态转换规则

#### ✅ 正确实现

```typescript
export const ALLOWED_APPLICATION_STATUS_TRANSITIONS = {
  submitted: ["interviewed", "rejected"],           // ✅ 海投/代投
  mentor_assigned: ["submitted", "rejected"],       // ✅ 内推
  interviewed: ["got_offer", "rejected"],           // ✅ 所有类型
  recommended: ["interested", "not_interested"],    // ✅ 内推
  interested: ["mentor_assigned"],                  // ✅ 内推
  not_interested: ["interested"],                   // ✅ 内推
};
```

**完全符合设计文档**：
- 内推设计文档第 143-152 行 ✅
- 代投设计文档第 113-119 行 ✅
- 海投设计文档第 324-330 行 ✅

---

### 5.2 重复申请检查

#### ✅ 正确实现

**代码位置：** 第 369-391 行

```typescript
private async checkDuplicateApplication(studentId: string, jobId: string) {
  const existing = await this.db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.studentId, studentId),
        eq(jobApplications.jobId, jobId),
      ),
    );

  if (existing.length > 0) {
    throw new BadRequestException(
      `Duplicate application: student ${studentId} already applied to job ${jobId}`,
    );
  }
}
```

**评价：**
- ✅ 逻辑正确
- ✅ 配合数据库唯一约束双重保护
- ✅ 错误信息清晰

### 5.3 权限验证规则（方案 C）

**决策：** 采用方案 C - 在调用方（API/Application Layer）验证权限

**实现原则：**
- ✅ **Domain 层不验证权限**：`updateApplicationStatus` 和 `rollbackApplicationStatus` 只专注业务逻辑
- ✅ **调用方负责验证**：API Layer 或 Application Layer 在调用前验证用户身份和权限
- ✅ **职责分离**：权限验证与业务逻辑解耦，符合 DDD 原则

**权限规则清单（调用方实现）：**

1. **学生（Student）**
   - 只能查看自己的申请
   - 只能提交自己的申请
   - 不能修改状态（只能查看）

2. **顾问（Counselor）**
   - 可以查看所有申请
   - 可以分配导师（设置 `mentorId`）
   - 可以修改所有申请状态

3. **导师（Mentor）**
   - 只能查看分配给自己的推荐申请
   - 只能修改分配给自己的申请状态
   - 验证：`application.assignedMentorId === mentorId`

4. **管理员（Admin）**
   - 可以查看和修改所有申请

**API 层实现示例：**
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('counselor', 'mentor', 'admin')
@Patch(':id/status')
async updateStatus(@Req() req, @Body() dto: UpdateStatusDto) {
  const user = req.user;

  // 获取申请信息以验证权限
  const application = await this.service.findOne({ id: dto.applicationId });

  // 验证权限
  await this.permissionService.verifyApplicationAccess(user, application);

  // 调用 domain service（不验证权限）
  return await this.jobApplicationService.updateApplicationStatus({
    ...dto,
    changedBy: user.id,
  });
}
```

**与 mentorId 参数设计的一致性：**
- Domain 只记录 `mentorId`，不验证其合法性
- 验证逻辑在调用方：确保 `mentorId` 是有效的导师，且导师有权限操作该申请

---

## 六、测试覆盖审查

### 6.1 E2E 测试

**文件：** `test/domains/placement/mentor-referral-flow.e2e-spec.ts`

#### ✅ 已覆盖的场景

1. ✅ 完整的内推流程（推荐 → 感兴趣 → 分配导师 → 评估 → 面试 → Offer）
2. ✅ 非内推申请不能进行导师评估
3. ✅ 非 `mentor_assigned` 状态不能进行评估
4. ✅ 状态转换后的后续流程
5. ✅ 查询功能测试
6. ✅ 状态历史测试
7. ✅ 事件发布测试

#### ⚠️ 缺失的测试场景

1. **导师身份验证测试** 🔴
   - 非分配导师尝试提交评估（应被拒绝）
   - 缺少 `mentorId` 参数（应被拒绝）
   - 错误的 `mentorId`（应被拒绝）

2. **`assignedMentorId` 字段测试** 🔴
   - 分配导师时是否正确设置
   - 评估时是否正确验证

3. **`mentorScreening` 字段测试** 🔴
   - 评估后是否正确存储
   - 查询时是否正确返回

---

## 七、安全性审查

### 7.1 安全风险

#### 🔴 高风险：导师身份验证缺失

**风险描述：**
- 任何人都可以调用 `updateApplicationStatus` 将状态从 `mentor_assigned` 改为 `submitted`
- 无法验证操作者是否为分配的导师
- 可能导致未授权的状态变更

**攻击场景：**
```typescript
// 攻击者可以伪造导师评估
await jobApplicationService.updateApplicationStatus({
  applicationId: "victim-application-id",
  newStatus: "submitted",
  changedBy: "attacker-id",
  changeMetadata: {
    mentorId: "fake-mentor-id",  // ❌ 无验证
    screeningResult: { /* 伪造的评估 */ },
  },
});
```

**修复优先级：** 🔥 **P0 - 必须立即修复**

---

#### ✅ 风险：状态转换权限控制（方案 C）

**决策：** 采用方案 C - 在调用方（API/Application Layer）验证权限

**实现方式：**
- ✅ **当前 domain 不验证权限**：`updateApplicationStatus` 和 `rollbackApplicationStatus` 方法不包含权限检查
- ✅ **调用方负责验证**：API Layer 或 Application Layer 在调用前验证用户身份和权限
- ✅ **职责分离**：Domain 层专注业务逻辑，权限验证在外层处理

**权限规则（调用方实现）：**
```typescript
// 示例：在 API Controller 中
@Patch(':id/status')
async updateStatus(@Req() req, @Body() dto: UpdateStatusDto) {
  // 1. 验证用户身份
  const user = req.user;

  // 2. 根据角色验证权限
  if (user.role === 'student') {
    // 学生只能修改自己的申请
    const application = await this.service.findOne({ id: dto.applicationId });
    if (application.studentId !== user.id) {
      throw new ForbiddenException('只能修改自己的申请');
    }
  }

  if (user.role === 'mentor') {
    // 导师只能修改分配给自己的推荐申请
    const application = await this.service.findOne({ id: dto.applicationId });
    if (application.assignedMentorId !== user.id) {
      throw new ForbiddenException('只能评估分配给自己的申请');
    }
  }

  // 3. 调用 domain service（不验证权限）
  return await this.jobApplicationService.updateApplicationStatus({
    ...dto,
    changedBy: user.id,
  });
}
```

**优势：**
- ✅ 符合 DDD 原则：Domain 层专注业务逻辑，不耦合权限系统
- ✅ 灵活性高：不同入口（API、内部调用）可以有不同的权限规则
- ✅ 可测试性：Domain 层无需 mock 权限系统
- ✅ 与 `mentorId` 参数设计一致：domain 只记录，不验证

**风险：**
- ⚠️ 需要确保所有调用方都正确实现权限验证
- ⚠️ 新增调用点时容易遗漏权限检查

**缓解措施：**
- 在 API Layer 使用守卫（Guards）统一处理权限
- 为 Application Layer 添加权限装饰器
- 编写清晰的文档和示例代码

---

### 7.2 数据完整性

#### ✅ 优点

1. **事务保证原子性**：状态更新和历史记录在同一事务中
2. **唯一约束**：防止重复申请
3. **外键约束**：确保引用完整性

#### ⚠️ 问题

1. **缺少乐观锁**：并发更新可能导致状态覆盖
2. **缺少状态回滚验证**：`rollbackApplicationStatus` 方法未验证是否可回滚

---

## 八、性能审查

### 8.1 查询性能

#### ✅ 优点

1. **索引完整**：为常用查询字段添加索引
   - `idx_job_applications_student`
   - `idx_job_applications_job`
   - `idx_job_applications_status`
   - `idx_job_applications_type`
   - `idx_job_applications_submitted`

2. **分页查询**：避免大数据量返回

#### ⚠️ 改进建议

1. **N+1 查询问题**：`search` 方法执行两次查询（数据 + 计数）
   - 建议使用 CTE 或子查询优化

2. **未使用的索引**：`idx_job_applications_assigned_mentor` 字段为空

---

## 九、文档一致性审查

### 9.1 设计文档 vs 实际代码

| 功能点 | 设计文档 | 实际代码 | 一致性 |
|--------|----------|----------|--------|
| 内推初始状态 | `recommended` | `recommended` | ✅ 一致 |
| 代投初始状态 | `recommended` | `submitted` | ❌ 不一致 |
| 海投初始状态 | `submitted` | `submitted` | ✅ 一致 |
| 导师评估方法 | `submitMentorScreening` | 已废弃，用 `updateApplicationStatus` | ⚠️ 文档未更新 |
| 导师身份验证 | 有 | 调用方验证 | ⚠️ 设计变更 |
| `mentorScreening` 存储 | 字段存储 | `changeMetadata` 存储 | ⚠️ 实现变更 |
| `assignedMentorId` 设置 | 有 | 已实现 | ✅ 一致 |
| 按导师查询 | 未明确 | `search` 方法支持 | ✅ 已覆盖 |
| 状态转换规则 | 完整定义 | 完整实现 | ✅ 一致 |

### 9.2 需要更新的文档

1. **内推设计文档** (`placement-domain-internal-referral-design.md`)
   - 第 184-210 行：删除 `submitMentorScreening` 方法描述
   - 添加：使用 `updateApplicationStatus` + `changeMetadata` 实现导师评估的说明
   - 添加：`mentorId` 参数说明
   - 添加：导师身份验证在调用方实现的说明

2. **代投设计文档** (`placement-domain-proxy-application-design.md`)
   - 第 302 行：修正初始状态为 `submitted`

3. **当前文档** (`placement-domain-code-review.md`)
   - ✅ 已更新，反映最新实现

---

## 十、修复优先级

### ✅ 已解决的问题

1. **`assignedMentorId` 字段写入和查询** ✅
   - ✅ 已实现：通过 `mentorId` 参数写入
   - ✅ 已实现：`search` 方法支持按导师筛选
   - ✅ 已实现：事件包含导师信息

2. **`mentorScreening` 字段处理** ✅
   - ✅ 已解决：移除字段，使用 `changeMetadata` 存储
   - ✅ 优势：简化设计，统一接口

3. **按导师查询功能** ✅
   - ✅ 已实现：复用 `search` 方法
   - ✅ 优势：支持组合筛选、分页、排序

### P0 - 阻塞性（必须立即修复）

4. **导师身份验证** 🔴
   - 在调用方（API Layer 或 Application Layer）实现
   - 验证 `mentorId` 的合法性

### P1 - 严重（本周修复）

5. **`resultDate` 逻辑修复** 🟡
   - 将 `got_offer` 加入 `resultStatuses` 数组

### P2 - 重要（本月修复）

6. **更新设计文档** 🟡
   - 更新内推设计文档
   - 更新代投设计文档

### P3 - 优化（可延后）

7. **添加权限验证** 🟢
   - 在应用层或 API 层添加角色验证

8. **查询性能优化** 🟢
   - 优化 `search` 方法的双查询

---

## 十一、代码示例：完整修复方案

### 修复后的 `updateApplicationStatus` 方法

```typescript
async updateApplicationStatus(
  dto: IUpdateApplicationStatusDto,
): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>> {
  this.logger.log(
    `Updating application status: ${dto.applicationId} -> ${dto.newStatus}`,
  );

  // Get current application [获取当前申请]
  const [application] = await this.db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.id, dto.applicationId));

  if (!application) {
    throw new NotFoundException(
      `Application not found: ${dto.applicationId}`,
    );
  }

  const previousStatus = application.status as ApplicationStatus;

  // ✅ 新增：分配导师场景验证
  if (dto.newStatus === 'mentor_assigned') {
    const mentorId = dto.changeMetadata?.mentorId as string | undefined;
    if (!mentorId) {
      throw new BadRequestException(
        'mentorId is required in changeMetadata when assigning mentor',
      );
    }
  }

  // ✅ 新增：导师评估场景验证
  if (previousStatus === 'mentor_assigned' && dto.newStatus === 'submitted') {
    const mentorId = dto.changeMetadata?.mentorId as string | undefined;
    
    if (!mentorId) {
      throw new BadRequestException(
        'mentorId is required in changeMetadata for mentor screening',
      );
    }

    // Security check: verify mentor is assigned [安全检查：验证导师已分配]
    if (application.assignedMentorId !== mentorId) {
      throw new BadRequestException(
        `Only the assigned mentor (${application.assignedMentorId}) can submit screening results. Provided: ${mentorId}`,
      );
    }

    // Validate screening result exists [验证评估结果存在]
    if (!dto.changeMetadata?.screeningResult) {
      throw new BadRequestException(
        'screeningResult is required in changeMetadata for mentor screening',
      );
    }
  }

  // Validate status transition [验证状态转换]
  const allowedTransitions =
    ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
  if (!allowedTransitions || !allowedTransitions.includes(dto.newStatus)) {
    throw new BadRequestException(
      `Invalid status transition: ${previousStatus} -> ${dto.newStatus}`,
    );
  }

  // Wrap all operations in a transaction [在事务中执行所有操作]
  const updatedApplication = await this.db.transaction(async (tx) => {
    // Prepare update data [准备更新数据]
    const updateData: Record<string, unknown> = {
      status: dto.newStatus,
      result: this.getResultFromStatus(dto.newStatus),
    };

    // ✅ 分配导师场景：设置 assignedMentorId
    if (dto.newStatus === 'mentor_assigned' && dto.changeMetadata?.mentorId) {
      updateData.assignedMentorId = dto.changeMetadata.mentorId;
    }

    // ✅ 导师评估场景：更新 mentorScreening 字段
    if (
      previousStatus === 'mentor_assigned' &&
      dto.newStatus === 'submitted' &&
      dto.changeMetadata?.screeningResult
    ) {
      updateData.mentorScreening = dto.changeMetadata.screeningResult;
    }

    // ✅ 修复：终态设置 resultDate
    const resultStatuses: ApplicationStatus[] = ["rejected", "got_offer"];
    if (resultStatuses.includes(dto.newStatus)) {
      updateData.resultDate = new Date().toLocaleDateString('en-CA');
    }

    // Update application status [更新申请状态]
    const [app] = await tx
      .update(jobApplications)
      .set(updateData)
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    // Record status change history [记录状态变更历史]
    await tx.insert(applicationHistory).values({
      applicationId: dto.applicationId,
      previousStatus,
      newStatus: dto.newStatus,
      changedBy: dto.changedBy,
      changeReason: dto.changeReason,
      changeMetadata: dto.changeMetadata,
    });

    return app;
  });

  this.logger.log(`Application status updated: ${dto.applicationId}`);

  // Publish event AFTER transaction [事务后发布事件]
  const eventPayload = {
    applicationId: updatedApplication.id,
    previousStatus: previousStatus,
    newStatus: dto.newStatus as ApplicationStatus,
    changedBy: dto.changedBy,
    changedAt: new Date().toISOString(),
    changeMetadata: dto.changeMetadata,
  };
  this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

  return {
    data: updatedApplication,
    event: {
      type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
      payload: eventPayload,
    },
  };
}
```

---

## 十二、总结

### 12.1 整体评价

**代码质量：** ⭐⭐⭐⭐☆ (4/5) - 良好，但有安全隐患

**优点：**
- ✅ 清晰的 DDD 架构
- ✅ 正确的事务管理
- ✅ 完整的状态机设计
- ✅ 事件在事务后发布
- ✅ 完整的测试覆盖

**主要问题：**
- 🔴 **导师身份验证缺失**（安全风险）
- 🔴 **`assignedMentorId` 字段未使用**（功能缺失）
- 🔴 **`mentorScreening` 字段未写入**（数据丢失）
- 🟡 **`resultDate` 逻辑不完整**
- 🟡 **设计文档与代码不一致**

### 12.2 修复建议优先级

**立即修复（本周）：**
1. 导师身份验证（P0）
2. `assignedMentorId` 字段写入（P1）
3. `mentorScreening` 字段写入（P1）
4. `resultDate` 逻辑修复（P1）

**短期修复（本月）：**
5. 添加 `findByAssignedMentor` 方法（P2）
6. 更新设计文档（P2）
7. 添加导师验证测试（P2）

**长期优化（可延后）：**
8. 添加权限验证（P3）
9. 查询性能优化（P3）

### 12.3 风险评估

| 风险 | 严重性 | 可能性 | 影响 | 缓解措施 |
|------|--------|--------|------|----------|
| 导师身份伪造 | 🔴 高 | 🟡 中 | 数据篡改、业务流程破坏 | 调用方验证导师身份 |
| 未授权状态变更 | 🟡 中 | 🟡 中 | 业务流程混乱 | 添加权限验证 |
| 并发更新冲突 | 🟢 低 | 🟢 低 | 状态覆盖 | 添加乐观锁 |

---

## 十二、总结

### 12.1 整体评价

**代码质量：** ⭐⭐⭐⭐⭐ (4.5/5) - 优秀

**已完成修复：**
- ✅ **`assignedMentorId` 字段写入和查询** - 已实现
- ✅ **`mentorScreening` 字段移除** - 已解决（采用方案 B）
- ✅ **按导师查询功能** - 已实现（复用 search 方法）
- ✅ **当前设计文档更新** - 已同步

**优点：**
- ✅ 清晰的 DDD 架构
- ✅ 正确的事务管理
- ✅ 完整的状态机设计
- ✅ 事件在事务后发布
- ✅ 完整的测试覆盖

### 12.2 修复总结

**已完成（✅）：**
1. `assignedMentorId` 字段写入和查询功能
2. `mentorScreening` 字段移除（采用方案 B）
3. 按导师查询功能（复用 search 方法）
4. `resultDate` 字段移除，改用 `updated_at`
5. 权限验证设计（采用方案 C - 调用方验证）
6. 当前设计文档更新

**待完成（📝）：**
7. 导师身份验证（调用方实现）
8. 上级设计文档更新（内推设计文档、代投设计文档）

### 12.3 风险评估

| 风险 | 严重性 | 可能性 | 影响 | 缓解措施 |
|------|--------|--------|------|----------|
| 导师身份伪造 | 🔴 高 | 🟡 中 | 数据篡改、业务流程破坏 | 调用方验证导师身份 |
| 未授权状态变更 | 🟡 中 | 🟡 中 | 业务流程混乱 | 调用方验证权限（方案 C） |
| 并发更新冲突 | 🟢 低 | 🟢 低 | 状态覆盖 | 添加乐观锁 |

---

**文档版本：** v1.3
**创建日期：** 2025-12-02
**更新日期：** 2025-12-02
**审查人：** Claude
**下次审查：** 后续修复完成后
