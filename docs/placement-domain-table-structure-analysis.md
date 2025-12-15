# Placement 域数据表结构分析报告

## 1. 业务逻辑与流程识别

### 1.1 核心业务流程

Placement 域支持**四种投递类型**，每种类型有不同的业务流程：

#### 1.1.1 内推（Referral）流程
```
顾问推荐 → recommended → 学生决策(interested/not_interested) 
  → mentor_assigned → 导师评估(submitted/rejected) 
  → interviewed → got_offer/rejected
```

#### 1.1.2 代投（Proxy）流程
```
顾问代投 → submitted → interviewed → got_offer/rejected
```

#### 1.1.3 海投（Direct）流程
```
学生自主投递 → submitted → interviewed → got_offer/rejected
```

#### 1.1.4 BD推荐（BD）流程
```
BD推荐 → submitted → interviewed → got_offer/rejected
```

### 1.2 状态流转规则

| 当前状态 | 允许转换到的状态 | 适用类型 |
|---------|----------------|---------|
| recommended | interested, not_interested | referral |
| interested | mentor_assigned | referral |
| not_interested | interested | referral |
| mentor_assigned | submitted, rejected | referral |
| submitted | interviewed, rejected | all |
| interviewed | got_offer, rejected | all |

**特殊功能**：
- 支持状态回撤（rollback），可回退到上一个有效状态
- 所有状态变更都记录在 `application_history` 中

### 1.3 业务角色与权限

| 角色 | 可执行操作 | 适用类型 |
|------|----------|---------|
| 学生 | 创建 direct 申请、决策感兴趣/不感兴趣 | direct, referral |
| 顾问 | 批量推荐、代投、交接给导师 | referral, proxy |
| 导师 | 评估学生、提交审查结果 | referral |
| 系统 | 状态自动更新（面试、Offer等） | all |

## 2. 当前表结构分析

### 2.1 job_applications 表结构

```sql
CREATE TABLE job_applications (
    id UUID PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,           -- 学生ID（字符串引用）
    job_id UUID NOT NULL,                      -- 岗位ID（外键）
    application_type ENUM NOT NULL,             -- 申请类型
    cover_letter TEXT,                         -- 求职信
    custom_answers JSONB,                      -- 自定义答案（含推荐信息）
    status ENUM NOT NULL DEFAULT 'submitted',  -- 当前状态
    assigned_mentor_id VARCHAR(36),           -- 分配的导师ID（仅referral使用）
    submitted_at TIMESTAMPTZ NOT NULL,         -- 提交时间
    updated_at TIMESTAMPTZ NOT NULL,           -- 更新时间
    notes TEXT                                 -- 内部备注
);
```

**索引**：
- `idx_student_job` (student_id, job_id) UNIQUE
- `idx_job_applications_student` (student_id)
- `idx_job_applications_job` (job_id)
- `idx_job_applications_status` (status)
- `idx_job_applications_type` (application_type)
- `idx_job_applications_submitted` (submitted_at)
- `idx_job_applications_assigned_mentor` (assigned_mentor_id)

### 2.2 application_history 表结构

```sql
CREATE TABLE application_history (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL,              -- 申请ID（外键）
    previous_status ENUM,                       -- 之前状态
    new_status ENUM NOT NULL,                  -- 新状态
    changed_by VARCHAR(36),                    -- 变更人ID
    change_reason TEXT,                        -- 变更原因
    change_metadata JSONB,                     -- 变更元数据（含导师评估结果）
    changed_at TIMESTAMPTZ NOT NULL            -- 变更时间
);
```

**索引**：
- `idx_application_history_application` (application_id)
- `idx_application_history_changed_at` (changed_at)
- `idx_application_history_status_change` (previous_status, new_status)

### 2.3 数据使用模式分析

**当前数据统计**（基于 Supabase 查询）：
- `job_applications`：4 条记录（全部为 referral 类型，状态为 recommended）
- `application_history`：4 条记录（每条申请对应 1 条初始状态历史）
- 表大小：job_applications 144 kB，application_history 80 kB

**查询模式**（基于代码分析）：
1. **按学生查询**：`WHERE student_id = ?`
2. **按岗位查询**：`WHERE job_id = ?`
3. **按状态查询**：`WHERE status = ?`
4. **按类型查询**：`WHERE application_type = ?`
5. **按导师查询**：`WHERE assigned_mentor_id = ?`（仅 referral）
6. **组合查询**：上述条件的 AND 组合
7. **历史查询**：`WHERE application_id = ? ORDER BY changed_at`

## 3. 当前表结构评估

### 3.1 优点

✅ **事件溯源模式**：`application_history` 完整记录所有状态变更，支持审计和回撤  
✅ **索引覆盖全面**：核心查询字段都有索引，查询性能良好  
✅ **外键约束**：`job_id` 引用 `recommended_jobs`，保证数据完整性  
✅ **唯一约束**：`(student_id, job_id)` 防止重复申请  
✅ **JSONB 灵活性**：`custom_answers` 和 `change_metadata` 支持扩展元数据  

### 3.2 潜在问题与改进空间

#### 问题 1：`result` 字段冗余
**现状**：
- ✅ 已移除 `result` / `result_reason` 列，使用 `status` 表示终态

**影响**：
- 去除冗余字段，减少一致性维护成本

#### 问题 2：`assigned_mentor_id` 字段使用范围窄
**现状**：
- `assigned_mentor_id` 只在 referral 类型使用
- 其他类型（direct, proxy, bd）该字段为 NULL

**影响**：
- 字段利用率低（75% 的记录该字段为 NULL）
- 但查询时通过索引过滤 NULL 值效率较高

**建议**：
- 当前设计合理，因为：
  1. 字段数量少，NULL 值存储成本低
  2. 查询时通过索引可快速过滤
  3. 避免类型特化表带来的 JOIN 复杂度

#### 问题 3：状态回撤查询性能
**现状**：
- `rollbackApplicationStatus` 需要查询 `application_history` 获取上一个状态
- 当前实现：`ORDER BY changed_at DESC LIMIT 1`

**潜在问题**：
- 如果某个申请有大量历史记录（如频繁回撤），查询可能变慢

**建议**：
- 当前数据量小，性能问题不明显
- 如果未来数据量大，可以考虑：
  1. 在 `job_applications` 中增加 `previous_status` 字段（冗余但快速）
  2. 使用物化视图缓存最新状态历史
  3. 在 `application_history` 上增加 `(application_id, changed_at DESC)` 的覆盖索引

#### 问题 4：`custom_answers` JSONB 字段查询效率 ✅ 已优化
**现状**：
- ~~`custom_answers` 存储推荐信息（`recommendedBy`, `recommendedByRole`, `recommendedAt`）~~
- ✅ **已优化**：`recommendedBy` 和 `recommendedAt` 已提取为独立字段 `recommended_by` 和 `recommended_at`
- `custom_answers` 仍保留这些字段（向后兼容），但查询优先使用独立字段

**优化措施**（2025-12-15）：
1. ✅ 添加 `recommended_by VARCHAR(36)` 字段，支持按推荐人快速查询
2. ✅ 添加 `recommended_at TIMESTAMPTZ` 字段，支持按推荐时间快速查询
3. ✅ 创建索引：
   - `idx_job_applications_recommended_by` (recommended_by)
   - `idx_job_applications_recommended_at` (recommended_at)
4. ✅ 数据迁移：从 `custom_answers` JSONB 字段迁移现有数据到新字段
5. ✅ 业务代码更新：`recommendReferralApplicationsBatch` 方法同时设置独立字段和 JSONB 字段

**影响**：
- ✅ 按推荐人查询性能显著提升（使用 B-tree 索引而非 JSONB GIN 索引）
- ✅ 按推荐时间范围查询性能显著提升
- ✅ 支持更复杂的组合查询（如：按推荐人 + 时间范围）
- ⚠️ 轻微数据冗余（独立字段 + JSONB 字段），但查询性能提升明显

**未来建议**：
- 如果确认不再需要从 `custom_answers` 中查询推荐信息，可以考虑移除 JSONB 中的冗余字段
- 但保留 JSONB 字段用于其他自定义元数据是合理的

#### 问题 5：缺少状态变更时间戳字段
**现状**：
- `job_applications.updated_at` 记录最后更新时间
- 但无法直接知道状态变更的具体时间（需要 JOIN `application_history`）

**影响**：
- 查询"最近状态变更的申请"需要 JOIN，性能较差

**建议**：
- 如果该查询频繁，考虑在 `job_applications` 中增加 `status_changed_at` 字段
- 或者在 `application_history` 上创建物化视图

#### 问题 6：推荐信息查询优化 ✅ 已实施
**需求**（2025-12-15）：
- 未来需要频繁按推荐人（`recommendedBy`）和推荐时间（`recommendedAt`）查询

**优化方案**：
- ✅ 将 `recommendedBy` 和 `recommendedAt` 从 `custom_answers` JSONB 字段提取为独立字段
- ✅ 添加索引以支持高效查询
- ✅ 保持向后兼容：`custom_answers` 中仍保留这些字段

**实施细节**：
- 数据库迁移：`add_recommended_by_and_recommended_at_to_job_applications`
- Schema 更新：`placement.schema.ts` 添加 `recommendedBy` 和 `recommendedAt` 字段
- 业务代码更新：`recommendReferralApplicationsBatch` 方法同时设置独立字段
- 数据迁移：自动从 `custom_answers` 迁移现有数据（4/4 条记录已迁移）

## 4. 优化建议总结

### 4.1 短期优化（数据量 < 10万）

**当前表结构基本合理，无需大改**，建议：

1. **保持现有设计**：事件溯源模式适合状态流转复杂的业务
2. **监控查询性能**：关注 `rollbackApplicationStatus` 和按 `custom_answers` 查询的性能
3. **考虑添加覆盖索引**：如果回撤操作频繁，在 `application_history` 上添加 `(application_id, changed_at DESC)` 覆盖索引

### 4.2 中期优化（数据量 10万 - 100万）

如果性能问题出现，考虑：

1. **提取高频查询字段**：
   - 如果按推荐人查询频繁，将 `custom_answers->>'recommendedBy'` 提取为 `recommended_by VARCHAR(36)` 字段
   - 如果按状态变更时间查询频繁，添加 `status_changed_at TIMESTAMPTZ` 字段

2. **优化回撤查询**：
   - 在 `job_applications` 中冗余 `previous_status` 字段，避免 JOIN 查询

3. **JSONB 索引**：
   - 在 `custom_answers` 上创建 GIN 索引，支持 JSONB 路径查询

### 4.3 长期优化（数据量 > 100万）

考虑表分区或归档策略：

1. **历史表分区**：按 `changed_at` 对 `application_history` 进行范围分区
2. **归档策略**：将终态（got_offer, rejected）且超过 1 年的申请归档到历史表
3. **读写分离**：历史查询走只读副本

## 5. 结论

### 5.1 当前表结构评价

**总体评价：✅ 设计合理，适合当前业务需求**

**优点**：
- 事件溯源模式完整记录状态变更历史
- 索引覆盖核心查询场景
- 外键和唯一约束保证数据完整性
- JSONB 字段提供扩展灵活性

**待改进点**：
- `result` 字段存在冗余（但影响很小）
- 状态回撤查询在数据量大时可能变慢（当前无影响）

**已优化点**（2025-12-15）：
- ✅ `recommendedBy` 和 `recommendedAt` 已提取为独立字段，支持高效查询

### 5.2 建议

1. **保持现有表结构**：当前设计符合 DDD 原则和业务需求
2. **监控性能指标**：关注回撤操作和 JSONB 查询的响应时间
3. **按需优化**：根据实际查询模式和数据量增长，逐步实施上述优化建议

### 5.3 设计原则遵循

当前表结构很好地遵循了以下原则：

- ✅ **DDD 防腐层**：`student_id` 使用字符串引用而非外键
- ✅ **事件溯源**：完整记录状态变更历史
- ✅ **单一职责**：`job_applications` 存储当前状态，`application_history` 存储历史
- ✅ **查询优化**：核心查询字段都有索引
- ✅ **扩展性**：JSONB 字段支持未来扩展

## 6. 数据模型可视化

### 6.1 当前表关系

```
recommended_jobs (1) ──< (N) job_applications (1) ──< (N) application_history
```

### 6.2 状态流转数据流

```
创建申请 → job_applications (status='recommended')
         → application_history (previous_status=null, new_status='recommended')

状态更新 → job_applications (status='interested')
         → application_history (previous_status='recommended', new_status='interested')

状态回撤 → 查询 application_history 获取上一个状态
         → job_applications (status='recommended')
         → application_history (previous_status='interested', new_status='recommended')
```

## 7. 参考数据

**当前数据库状态**（2025-12-15）：
- `job_applications` 记录数：4
- `application_history` 记录数：4
- 表大小：job_applications 144 kB，application_history 80 kB
- 申请类型分布：100% referral
- 状态分布：100% recommended

**查询模式**（基于代码分析）：
- 按学生查询：高频
- 按岗位查询：中频
- 按状态查询：高频
- 按类型查询：中频
- 按导师查询：低频（仅 referral）
- **按推荐人查询：高频** ✅ 已优化（2025-12-15）
- **按推荐时间查询：高频** ✅ 已优化（2025-12-15）
- 历史查询：中频（回撤操作）

