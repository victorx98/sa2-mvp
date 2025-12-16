# 依赖倒置架构 - 目录结构

## 完整目录结构

```
src/
├── api/
│   └── controllers/
│       └── services/
│           ├── regular-mentoring.controller.ts
│           ├── gap-analysis.controller.ts
│           └── ai-career.controller.ts
│
├── application/
│   ├── commands/
│   │   └── services/
│   │       ├── regular-mentoring.service.ts
│   │       ├── regular-mentoring-event.handler.ts
│   │       ├── gap-analysis.service.ts
│   │       ├── gap-analysis-event.handler.ts
│   │       ├── ai-career.service.ts
│   │       └── ai-career-event.handler.ts
│   │
│   └── queries/
│       └── services/
│           ├── regular-mentoring-query.service.ts
│           ├── gap-analysis-query.service.ts
│           └── ai-career-query.service.ts
│
├── domains/
│   └── services/
│       └── sessions/
│           ├── regular-mentoring/
│           │   ├── types/
│           │   │   ├── regular-mentoring.types.ts
│           │   │   └── index.ts
│           │   ├── rules/
│           │   │   ├── session-lifecycle.rules.ts
│           │   │   ├── session-calculation.rules.ts
│           │   │   └── index.ts
│           │   ├── ports/
│           │   │   ├── regular-mentoring.data-access.ts
│           │   │   └── index.ts
│           │   ├── dto/
│           │   │   ├── create-regular-mentoring.dto.ts
│           │   │   └── update-regular-mentoring.dto.ts
│           │   ├── exceptions/
│           │   │   └── regular-mentoring.exceptions.ts
│           │   ├── mappers/
│           │   │   └── regular-mentoring.mapper.ts
│           │   ├── __tests__/
│           │   │   ├── session-lifecycle.rules.spec.ts
│           │   │   └── session-calculation.rules.spec.ts
│           │   ├── regular-mentoring.module.ts
│           │   └── index.ts
│           │
│           ├── gap-analysis/
│           │   ├── types/
│           │   │   ├── gap-analysis.types.ts
│           │   │   └── index.ts
│           │   ├── rules/
│           │   │   ├── gap-analysis-lifecycle.rules.ts
│           │   │   ├── gap-analysis-scoring.rules.ts
│           │   │   └── index.ts
│           │   ├── ports/
│           │   │   ├── gap-analysis.data-access.ts
│           │   │   └── index.ts
│           │   ├── dto/
│           │   ├── exceptions/
│           │   ├── mappers/
│           │   ├── __tests__/
│           │   ├── gap-analysis.module.ts
│           │   └── index.ts
│           │
│           └── ai-career/
│               ├── types/
│               │   ├── ai-career.types.ts
│               │   └── index.ts
│               ├── rules/
│               │   ├── career-session-lifecycle.rules.ts
│               │   ├── career-recommendation.rules.ts
│               │   └── index.ts
│               ├── ports/
│               │   ├── ai-career.data-access.ts
│               │   └── index.ts
│               ├── dto/
│               ├── exceptions/
│               ├── mappers/
│               ├── __tests__/
│               ├── ai-career.module.ts
│               └── index.ts
│
└── infrastructure/
    ├── database/
    │   ├── schema/
    │   │   ├── regular-mentoring-sessions.schema.ts
    │   │   ├── ai-career-sessions.schema.ts
    │   │   ├── gap-analyses.schema.ts
    │   │   ├── meetings.schema.ts
    │   │   └── ...
    │   └── migrations/
    │
    └── persistence/
        └── services/
            └── sessions/
                ├── regular-mentoring/
                │   ├── regular-mentoring.data-access.impl.ts
                │   ├── regular-mentoring.mapper.ts
                │   └── index.ts
                │
                ├── gap-analysis/
                │   ├── gap-analysis.data-access.impl.ts
                │   ├── gap-analysis.mapper.ts
                │   └── index.ts
                │
                └── ai-career/
                    ├── ai-career.data-access.impl.ts
                    ├── ai-career.mapper.ts
                    └── index.ts
```

## 层级说明

### API Layer (Controllers)
- 接收 HTTP 请求
- 参数验证、DTO 转换
- 注入 Application 层的 Service

### Application Layer (Commands/Queries)
- 业务流程编排
- 事务管理
- 跨域协调
- 注入 Domain 层的数据访问接口

### Domain Layer (纯净核心)
- **types/**: 纯类型定义（零依赖）
- **rules/**: 业务规则（纯函数）
- **ports/**: 数据访问接口定义（端口）
- **dto/**: 数据传输对象
- **exceptions/**: 领域异常
- **mappers/**: API 响应映射
- **__tests__/**: 单元测试

### Infrastructure Layer (技术实现)
- **database/schema/**: 集中管理数据库表结构
- **persistence/services/sessions/**: 实现 Domain 层的数据访问接口
  - `*.data-access.impl.ts`: Drizzle ORM 实现
  - `*.mapper.ts`: DB 字段映射（snake_case ↔ camelCase）

## 依赖方向

```
API Layer
    ↓
Application Layer
    ↓
Domain Layer (接口定义)
    ↑ (依赖倒置)
Infrastructure Layer (接口实现)
```

