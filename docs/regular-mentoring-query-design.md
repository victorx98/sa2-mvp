# 课时信息查询 API 设计方案

## 概述
本文档对比两种课时信息查询设计方案：
- **方案1**：基于角色的查询路由（带权限校验）
- **方案2**：基于参数的查询（简化版，无权限校验）

---

## API 端点
```
GET /api/services/regular-mentoring
```

**认证**：JWT Token（必需）

**通用查询参数**（两种方案都适用）：
- `status` - 按课时状态过滤（如 SCHEDULED, COMPLETED, CANCELLED）
- `startDate` / `endDate` - 按日期范围过滤
- `page` / `limit` - 分页参数
- 其他业务相关过滤条件

---

## 方案1：基于角色的查询路由

### 设计理念
- 后端从 JWT token 中提取用户角色
- 根据角色路由查询逻辑
- 按角色强制安全限制
- 参数使用权限取决于角色

### 各角色参数权限表

| 角色 | counselorId | studentId | mentorId | 说明 |
|------|-------------|-----------|----------|------|
| **顾问** | ✅ 可选 | ✅ 可选 | ✅ 可选 | 可查询任意组合 |
| **导师** | ❌ 不允许 | ✅ 可选 | ❌ 强制为 `user.id` | 只能查询自己的课时 |
| **学生** | ❌ 不允许 | ❌ 强制为 `user.id` | ❌ 不允许 | 只能查询自己的课时 |

### 各角色查询场景

#### 1️⃣ 顾问角色查询场景

| 场景 | URL 参数 | 查询逻辑 |
|------|---------|---------|
| 查询自己所有学生的课时 | 无参数 | `counselorId=user.id` → 获取学生列表 → 查询所有课时 |
| 查询其他顾问的学生课时 | `?counselorId=B` | 获取顾问B的学生列表 → 查询课时 |
| 查询指定学生的课时 | `?studentId=xxx` | 直接查询该学生的所有课时 |
| 查询指定导师的课时 | `?mentorId=xxx` | 查询该导师的所有课时 |
| 查询学生+导师组合 | `?studentId=xxx&mentorId=yyy` | 查询该学生与该导师的课时 |
| 查询其他顾问的指定学生 | `?counselorId=B&studentId=xxx` | 查询顾问B的指定学生课时 |
| 复杂组合查询 | `?counselorId=B&studentId=xxx&mentorId=yyy` | 应用所有过滤条件 |

**请求示例：**
```http
# 顾问查询自己的所有学生
GET /api/services/regular-mentoring
Authorization: Bearer <counselor-token>

# 顾问查询其他顾问的学生
GET /api/services/regular-mentoring?counselorId=other-counselor-id
Authorization: Bearer <counselor-token>

# 顾问查询指定学生
GET /api/services/regular-mentoring?studentId=student-id
Authorization: Bearer <counselor-token>

# 顾问查询指定导师
GET /api/services/regular-mentoring?mentorId=mentor-id
Authorization: Bearer <counselor-token>

# 顾问带过滤条件查询
GET /api/services/regular-mentoring?studentId=xxx&status=SCHEDULED&startDate=2025-01-01
Authorization: Bearer <counselor-token>
```

#### 2️⃣ 导师角色查询场景

| 场景 | URL 参数 | 查询逻辑 |
|------|---------|---------|
| 查询自己的所有课时 | 无参数 | `mentorId=user.id` → 查询所有课时 |
| 查询与指定学生的课时 | `?studentId=xxx` | `mentorId=user.id & studentId=xxx` → 查询课时 |
| ❌ 查询其他导师的课时 | `?mentorId=xxx` | **参数被忽略** - 强制使用 `user.id` |

**请求示例：**
```http
# 导师查询自己的所有课时
GET /api/services/regular-mentoring
Authorization: Bearer <mentor-token>

# 导师查询与指定学生的课时
GET /api/services/regular-mentoring?studentId=student-id
Authorization: Bearer <mentor-token>

# 导师带过滤条件查询
GET /api/services/regular-mentoring?studentId=xxx&status=COMPLETED
Authorization: Bearer <mentor-token>
```

#### 3️⃣ 学生角色查询场景

| 场景 | URL 参数 | 查询逻辑 |
|------|---------|---------|
| 查询自己的所有课时 | 无参数 | `studentId=user.id` → 查询所有课时 |
| ❌ 查询其他学生的课时 | `?studentId=xxx` | **参数被忽略** - 强制使用 `user.id` |
| ❌ 按导师查询 | `?mentorId=xxx` | **不允许** - 参数被忽略 |

**请求示例：**
```http
# 学生查询自己的课时
GET /api/services/regular-mentoring
Authorization: Bearer <student-token>

# 学生带过滤条件查询（mentorId 会被忽略）
GET /api/services/regular-mentoring?status=SCHEDULED&startDate=2025-01-01
Authorization: Bearer <student-token>
```

### 优缺点对比

| 优点 ✅ | 缺点 ❌ |
|--------|--------|
| 安全边界清晰 | 实现复杂度较高 |
| 基于角色的访问控制 | 需要从 JWT 提取角色 |
| 防止未授权查询 | 代码维护量较大 |
| 业务逻辑在 API 层强制执行 | - |

---

## 方案2：基于参数的简化查询

### 设计理念
- 不进行角色路由
- 完全基于参数进行查询
- 前端控制查询范围
- 后端只负责执行查询

### 参数组合查询矩阵

所有8种可能的参数组合：

| # | counselorId | studentId | mentorId | 查询逻辑 | 使用场景 |
|---|-------------|-----------|----------|---------|----------|
| 1 | ❌ | ❌ | ❌ | 查询所有课时 | ⚠️ 不推荐（数据量过大） |
| 2 | ✅ | ❌ | ❌ | 获取顾问的学生列表 → 查询课时 | 顾问查看所有学生 |
| 3 | ❌ | ✅ | ❌ | 按 `student_user_id` 查询 | 查看指定学生的课时 |
| 4 | ❌ | ❌ | ✅ | 按 `mentor_user_id` 查询 | 查看指定导师的课时 |
| 5 | ✅ | ✅ | ❌ | 获取顾问学生列表 → 按学生过滤 | 顾问查看指定学生 |
| 6 | ✅ | ❌ | ✅ | 获取顾问学生列表 → 按导师过滤 | 顾问查看导师的课时 |
| 7 | ❌ | ✅ | ✅ | 按学生和导师 AND 查询 | 学生-导师课时 |
| 8 | ✅ | ✅ | ✅ | 获取顾问学生 → 按学生+导师过滤 | 完整组合查询 |

### 常见场景

#### 顾问视角

| 场景 | URL 参数 | 说明 |
|------|---------|------|
| 查询自己的学生课时 | `?counselorId={user.id}` | 传入当前用户 ID |
| 查询其他顾问的学生 | `?counselorId={other-id}` | 传入目标顾问 ID |
| 查询指定学生 | `?studentId={student-id}` | 直接查询学生 |
| 查询指定导师 | `?mentorId={mentor-id}` | 直接查询导师 |
| 组合查询 | `?counselorId=A&studentId=B&mentorId=C` | 所有过滤条件应用 |

**请求示例：**
```http
# 查询自己的学生
GET /api/services/regular-mentoring?counselorId=current-user-id

# 查询其他顾问的学生
GET /api/services/regular-mentoring?counselorId=other-counselor-id

# 查询指定学生
GET /api/services/regular-mentoring?studentId=student-id

# 复杂查询
GET /api/services/regular-mentoring?counselorId=A&studentId=B&mentorId=C&status=SCHEDULED
```

#### 导师视角

| 场景 | URL 参数 | 说明 |
|------|---------|------|
| 查询自己的课时 | `?mentorId={user.id}` | 传入当前用户 ID |
| 查询与指定学生的课时 | `?mentorId={user.id}&studentId={student-id}` | 按学生过滤 |

**请求示例：**
```http
# 查询自己的课时
GET /api/services/regular-mentoring?mentorId=current-user-id

# 查询与指定学生的课时
GET /api/services/regular-mentoring?mentorId=current-user-id&studentId=student-id
```

#### 学生视角

| 场景 | URL 参数 | 说明 |
|------|---------|------|
| 查询自己的课时 | `?studentId={user.id}` | 传入当前用户 ID |

**请求示例：**
```http
# 查询自己的课时
GET /api/services/regular-mentoring?studentId=current-user-id

# 带过滤条件查询
GET /api/services/regular-mentoring?studentId=current-user-id&status=SCHEDULED
```

### 实现伪代码

```typescript
async getSessionsList(filters) {
  const { counselorId, studentId, mentorId, ...otherFilters } = filters;
  
  // 第1步：如果提供了 counselorId，获取学生列表
  let studentIds = null;
  if (counselorId) {
    studentIds = await getStudentIdsByCounselor(counselorId);
  }
  
  // 第2步：构建查询条件
  const queryConditions = {
    studentIds,      // 学生 ID 数组（如果提供了 counselorId）
    studentId,       // 单个学生 ID（如果提供了）
    mentorId,        // 导师 ID（如果提供了）
    ...otherFilters  // status、dates 等其他条件
  };
  
  // 第3步：执行查询
  return await querySessions(queryConditions);
}
```

### 优缺点对比

| 优点 ✅ | 缺点 ❌ |
|--------|--------|
| 实现简单 | 无权限控制 |
| 参数组合灵活 | 安全性需依赖前端 |
| 无需角色逻辑 | 可能存在数据泄露风险 |
| 易于测试 | 需要前端严格按规范传参 |
| 代码维护量少 | - |

---

## 方案对比表

| 维度 | 方案1（基于角色） | 方案2（基于参数） |
|-----|------------------|-------------------|
| **安全性** | ✅ 强 - 角色强制执行 | ⚠️ 弱 - 无校验 |
| **复杂度** | 🟡 中等 - 角色路由逻辑 | ✅ 简单 - 参数解析 |
| **灵活性** | 🟡 中等 - 受角色限制 | ✅ 高 - 任意组合 |
| **前端工作量** | ✅ 少 - 后端处理逻辑 | 🟡 中 - 需传入正确参数 |
| **可维护性** | 🟡 代码较多 | ✅ 代码较少 |
| **出错风险** | ✅ 低 - 服务端校验 | ⚠️ 高 - 依赖前端 |
| **业务逻辑** | ✅ 在 API 层强制 | ⚠️ 依赖前端实现 |
| **测试难度** | 🟡 测试用例多 | ✅ 测试用例少 |
| **性能** | ✅ 相同 | ✅ 相同 |

---

## 推荐方案

### 选项A：使用方案1（基于角色）- 生产环境推荐 ⭐⭐⭐⭐⭐

**适用场景：**
- ✅ 安全性是首要考虑
- ✅ 需要强制执行业务规则
- ✅ 要求清晰的访问边界
- ✅ 有足够的实现时间

**实现工作量**：中等

---

### 选项B：使用方案2（基于参数）- MVP/快速原型 ⭐⭐⭐

**适用场景：**
- ✅ 快速原型 / MVP 阶段
- ✅ 内部工具（用户可信任）
- ✅ 追求简单性而非安全性
- ✅ 后续计划补充权限层

**实现工作量**：少

---

### 混合方案（最优）⭐⭐⭐⭐⭐ 推荐

**策略：**
1. 先使用方案2（简单参数查询）
2. 在查询前添加权限校验中间件
3. 保持查询逻辑简单，权限校验独立

**示例：**
```typescript
async getSessionsList(user, filters) {
  // 第1步：根据角色校验权限
  await validateQueryPermissions(user, filters);
  
  // 第2步：执行简单参数查询
  return await simpleParameterQuery(filters);
}
```

**优势：**
- ✅ 查询逻辑简单
- ✅ 权限控制独立
- ✅ 易于修改/扩展权限
- ✅ 后续容易升级安全性

---

## 决策矩阵

| 需求 | 选方案1 | 选方案2 | 选混合 |
|-----|--------|--------|--------|
| 立即需要安全性 | ✅ | ❌ | ✅ |
| MVP / 快速上线 | ❌ | ✅ | 🟡 |
| 复杂角色规则 | ✅ | ❌ | ✅ |
| 简单实现 | ❌ | ✅ | 🟡 |
| 未来可扩展性 | 🟡 | 🟡 | ✅ |
| 内部可信工具 | 🟡 | ✅ | ✅ |
| 正式对外产品 | ✅ | ❌ | ✅ |

---

## 实现检查清单

### 方案1（基于角色）实现步骤：
- [ ] 在 Controller 中从 JWT token 提取角色
- [ ] 实现 `getSessionsByRole()` 方法
- [ ] 添加角色特定的查询路由
- [ ] 实现各角色参数验证逻辑
- [ ] 为每个角色编写安全测试
- [ ] 完善角色权限文档

### 方案2（基于参数）实现步骤：
- [ ] 接收 `counselorId`、`studentId`、`mentorId` 查询参数
- [ ] 实现参数组合查询逻辑
- [ ] 处理 counselorId → studentIds 转换
- [ ] 动态构建查询条件
- [ ] 基础参数验证
- [ ] 完善参数组合文档

### 混合方案实现步骤：
- [ ] 实现方案2的查询逻辑
- [ ] 添加权限验证中间件
- [ ] 定义各角色权限规则
- [ ] 编写权限安全测试
- [ ] 完善权限和参数文档
- [ ] 预留未来权限扩展点

---

## 讨论问题

1. **安全优先级**：防止未授权查询有多重要？
2. **时间约束**：需要快速上线（MVP）还是有充足时间做安全？
3. **用户信任度**：所有用户都可信任吗？还是需要角色边界？
4. **未来规划**：后期会加入更复杂的权限规则吗？
5. **数据敏感性**：课时信息的敏感程度如何？
6. **审计需求**：需要记录谁查询了什么吗？

---

## 附录：技术实现说明

### 数据库表结构

**涉及的表：**
- `regular_mentoring_sessions` - 课时主表
  - `student_user_id` - 学生 ID
  - `mentor_user_id` - 导师 ID
  - `created_by_counselor_id` - 顾问 ID
  - `status` - 课时状态
  - `scheduled_at` - 课时日期

- `student_counselor` - 学生-顾问关系表
  - `student_id` - 学生 ID
  - `counselor_id` - 顾问 ID

### 查询性能考虑

**两种方案都需要关注：**
- 顾问查询需要 JOIN 或两步查询（顾问→学生→课时）
- 考虑缓存顾问-学生关系表
- 在 `student_user_id`、`mentor_user_id`、`created_by_counselor_id` 上建立索引

**查询示例：**
```sql
-- 直接查询（学生/导师）
SELECT * FROM regular_mentoring_sessions 
WHERE student_user_id = ? AND status != 'deleted';

-- 顾问查询（需要先获取学生列表）
SELECT * FROM regular_mentoring_sessions 
WHERE student_user_id IN (?,?,?...) AND status != 'deleted';
```

---

## 总结建议

| 选项 | 适用场景 | 推荐度 |
|-----|--------|--------|
| **方案1** | 正式产品、需要安全性 | ⭐⭐⭐⭐⭐ |
| **方案2** | MVP/原型、内部工具 | ⭐⭐⭐ |
| **混合方案** | 兼顾快速和安全 | ⭐⭐⭐⭐⭐ |

**最终建议**：采用 **混合方案** - 既能快速实现，又能保证安全！

---

**文档版本**：1.0  
**日期**：2025-12-05  
**状态**：待评审  
**语言**：中文
