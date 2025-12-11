# 统一会话 API

## 概述

新增了统一的 API 端点,用于简化不同会话类型(Regular Mentoring、Gap Analysis、AI Career)的管理。

## 架构设计

```
┌─────────────────────────┐
│  SessionController      │  ← 统一 API 层
│  /api/services/sessions │
└───────────┬─────────────┘
            │
┌───────────▼─────────────────┐
│ SessionOrchestratorService  │  ← 编排层 (策略模式)
└───────────┬─────────────────┘
            │
   ┌────────┴────────┬────────────────┐
   │                 │                │
┌──▼──────────┐ ┌───▼──────────┐ ┌──▼─────────┐
│ RegularMent │ │ GapAnalysis  │ │ AiCareer   │  ← Application 层服务
│ oringService│ │ Service      │ │ Service    │
└──┬──────────┘ └───┬──────────┘ └──┬─────────┘
   │                │                │
   └────────┬───────┴────────┬───────┘
            │                │
    [Domain 层服务]  [Repository]
            │                │
    [3 张独立数据表]
```

## API 端点

### 统一端点 (新)

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| POST   | `/api/services/sessions` | 创建会话 (任意类型) |
| GET    | `/api/services/sessions?sessionType=xxx` | 获取会话列表 |
| GET    | `/api/services/sessions/:id?sessionType=xxx` | 获取会话详情 |
| PATCH  | `/api/services/sessions/:id?sessionType=xxx` | 更新会话 |
| POST   | `/api/services/sessions/:id/cancel?sessionType=xxx` | 取消会话 |
| DELETE | `/api/services/sessions/:id?sessionType=xxx` | 删除会话 |

### 旧版端点 (向后兼容)

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| POST   | `/api/services/regular-mentoring` | 创建常规辅导 |
| POST   | `/api/services/gap-analysis` | 创建 Gap Analysis |
| POST   | `/api/services/ai-career` | 创建 AI Career |
| ... | ... | (所有 CRUD 操作均保留) |

## 会话类型

- `regular_mentoring` - 常规辅导会话
- `gap_analysis` - Gap Analysis 会话  
- `ai_career` - AI Career 评估会话

## 使用示例

### 创建会话

```typescript
POST /api/services/sessions

请求体:
{
  "sessionType": "regular_mentoring",  // 必填
  "studentId": "uuid",
  "mentorId": "uuid",
  "sessionTypeId": "uuid",
  "title": "简历辅导",
  "description": "可选描述",
  "scheduledAt": "2025-12-03T06:00:00Z",
  "duration": 60,
  "meetingProvider": "feishu"
}

响应:
{
  "sessionId": "uuid",
  "status": "pending_meeting",
  "scheduledAt": "2025-12-03T06:00:00Z",
  "holdId": "uuid"
}
```

### 获取会话列表

```typescript
// 获取所有常规辅导会话
GET /api/services/sessions?sessionType=regular_mentoring

// 按学生筛选
GET /api/services/sessions?sessionType=gap_analysis&studentId=xxx

// 按导师和学生筛选
GET /api/services/sessions?sessionType=ai_career&mentorId=xxx&studentId=yyy
```

### 获取会话详情

```typescript
GET /api/services/sessions/{sessionId}?sessionType=regular_mentoring
```

### 更新会话

```typescript
PATCH /api/services/sessions/{sessionId}?sessionType=gap_analysis

请求体:
{
  "title": "更新后的标题",
  "scheduledAt": "2025-12-04T06:00:00Z",
  "duration": 90
}
```

### 取消会话

```typescript
POST /api/services/sessions/{sessionId}/cancel?sessionType=ai_career

请求体:
{
  "reason": "学生不可用"
}
```

### 删除会话

```typescript
DELETE /api/services/sessions/{sessionId}?sessionType=regular_mentoring
```

## 迁移指南

### 前端迁移

**之前 (多个端点):**
```typescript
// 必须根据 sessionType 切换不同的端点
if (sessionType === 'regular_mentoring') {
  await api.post('/api/services/regular-mentoring', data);
} else if (sessionType === 'gap_analysis') {
  await api.post('/api/services/gap-analysis', data);
} else if (sessionType === 'ai_career') {
  await api.post('/api/services/ai-career', data);
}
```

**之后 (统一端点):**
```typescript
// 单一端点, sessionType 在请求体中
await api.post('/api/services/sessions', {
  sessionType: sessionType,
  ...data
});
```

### 迁移策略

1. **阶段 1**: 新的统一 API 可用,旧版 API 仍然工作
2. **阶段 2**: 前端逐步迁移到统一 API
3. **阶段 3**: 旧版 API 可以废弃 (可选)

## 优势

### 前端优势
- ✅ 所有会话类型使用单一 API 端点
- ✅ 无需根据 sessionType 切换端点
- ✅ 更易于维护和扩展
- ✅ 使用单一 DTO 接口,类型安全

### 后端优势
- ✅ 代码改动最小 (仅新增编排层)
- ✅ Application 层和 Domain 层完全不变
- ✅ 易于添加新的会话类型
- ✅ 保持关注点分离
- ✅ 向后兼容

## 技术细节

### 新增组件

1. **SessionOrchestratorService** (`src/application/commands/services/session-orchestrator.service.ts`)
   - 充当外观/策略协调器
   - 根据 sessionType 将请求路由到相应的服务
   - 无业务逻辑,纯编排功能

2. **SessionController** (`src/api/controllers/services/session.controller.ts`)
   - 统一的 REST API 端点
   - 验证 sessionType 参数
   - 委托给 SessionOrchestratorService

### 保留的组件

- ✅ 所有 3 个 Application 服务 (RegularMentoringService, GapAnalysisService, AiCareerService)
- ✅ 所有 Domain 服务和 Repository  
- ✅ 所有 3 张数据库表
- ✅ 所有旧版 Controller (向后兼容)

## 注意事项

- 所有统一端点都**必须**提供 `sessionType` 参数 (除了 POST /api/services/sessions 在请求体中)
- 旧版端点保持不变且完全可用
- 添加新的会话类型只需:
  1. 创建新的 Application Service
  2. 在 SessionOrchestratorService 策略映射中注册
  3. Controller 和前端无需改动

## 设计模式

- **外观模式 (Facade Pattern)**: SessionOrchestratorService 为多个子系统提供统一接口
- **策略模式 (Strategy Pattern)**: 根据 sessionType 动态选择处理策略
- **开闭原则**: 对扩展开放(新增会话类型),对修改关闭(现有代码不变)

## 扩展示例

假设未来需要添加新的会话类型 `mock_interview`:

1. 创建 `MockInterviewService` (Application 层)
2. 在 `SessionOrchestratorService.getServiceByType()` 中添加:
   ```typescript
   [SessionType.MOCK_INTERVIEW]: this.mockInterviewService,
   ```
3. 完成! 前端和 Controller 无需任何改动

## 问题排查

### sessionType 参数缺失
**错误**: `sessionType query parameter is required`
**解决**: 确保在 GET/PATCH/DELETE/CANCEL 请求中添加 `?sessionType=xxx` 查询参数

### 不支持的会话类型
**错误**: `Unsupported session type: xxx`
**解决**: 检查 sessionType 是否为以下之一: `regular_mentoring`, `gap_analysis`, `ai_career`
