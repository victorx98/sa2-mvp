# 项目架构文档

本文档说明了 SA2-MVP 项目的架构设计和目录结构，遵循 [mvp-booking-billing-plan.md](./mvp-booking-billing-plan.md) 中定义的规范。

## 架构概览

项目采用 **DDD (Domain-Driven Design)** 架构模式，结合 **CQRS (Command Query Responsibility Segregation)** 模式，实现清晰的职责分离。

### 架构分层

```
┌─────────────────────────────────────────┐
│          API Layer (HTTP)               │  外部接口层
│  Controllers → DTOs → Transformers      │
├─────────────────────────────────────────┤
│       Application Layer (业务协调)       │  应用服务层
│  Commands (Write) | Queries (Read)      │
├─────────────────────────────────────────┤
│        Domain Layer (业务规则)          │  领域层
│  Entities → Value Objects → Services    │
├─────────────────────────────────────────┤
│      Infrastructure Layer (技术实现)     │  基础设施层
│  Database → Repositories → Events       │
└─────────────────────────────────────────┘
           ↕ Shared Layer (共享)
```

## 目录结构

```
src/
├── api/                              # API层（外部接口）
│   ├── controllers/                  # RESTful控制器
│   │   ├── auth.controller.ts       # 认证控制器
│   │   └── user.controller.ts       # 用户控制器
│   ├── dto/                         # 数据传输对象
│   │   ├── request/                 # 请求DTO
│   │   │   ├── register.dto.ts
│   │   │   └── login.dto.ts
│   │   └── response/                # 响应DTO
│   │       ├── auth-response.dto.ts
│   │       └── user-response.dto.ts
│   └── transformers/                # 数据转换器
│       └── user.transformer.ts
│
├── application/                      # 应用服务层
│   ├── commands/                    # 命令服务（写操作）
│   │   └── auth-command/
│   │       ├── auth-command.service.ts
│   │       └── auth-command.module.ts
│   └── queries/                     # 查询服务（读操作）
│       ├── user-query.service.ts
│       └── user-query.module.ts
│
├── domains/                         # 领域层
│   └── identity/                    # 身份域
│       └── user/                    # 用户子域
│           ├── user.interface.ts           # 用户实体接口
│           └── user-repository.interface.ts # 仓储接口
│
├── infrastructure/                  # 基础设施层
│   ├── database/                    # 数据库
│   │   ├── database.config.ts
│   │   └── entities/                # TypeORM实体
│   │       └── user.entity.ts
│   └── repositories/                # 仓储实现
│       └── user.repository.ts
│
├── shared/                          # 共享模块
│   ├── guards/                      # 守卫
│   │   ├── jwt-auth.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   ├── decorators/                  # 装饰器
│   │   ├── public.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── types/                       # 类型定义
│   ├── utils/                       # 工具函数
│   └── constants/                   # 常量
│
├── app.module.ts                    # 根模块
└── main.ts                          # 应用入口
```

## 各层职责

### 1. API层

**职责**: 处理HTTP请求和响应

**特点**:
- 薄层，不包含业务逻辑
- 负责参数验证和响应格式化
- 调用Application层服务

**包含**:
- Controllers: 定义路由和处理请求
- DTOs: 定义输入输出契约
- Transformers: 领域对象 → 响应DTO

### 2. Application层 (CQRS)

**职责**: 实现业务用例，协调领域对象

**特点**:
- 无状态服务
- 分离读写操作
- 事务管理

**分类**:

#### Commands (写操作)
- 处理创建、更新、删除操作
- 调用领域模型验证业务规则
- 发布领域事件

#### Queries (读操作)
- 处理查询和数据聚合
- 可以跨域查询
- 性能优化（缓存、并行查询）

### 3. Domain层

**职责**: 封装核心业务规则和领域逻辑

**特点**:
- 纯粹的业务逻辑
- 不依赖外部框架
- 领域驱动设计

**包含**:
- Entities: 领域实体
- Value Objects: 值对象
- Domain Services: 领域服务
- Repository Interfaces: 仓储接口

### 4. Infrastructure层

**职责**: 提供技术实现

**特点**:
- 可替换的实现
- 与外部系统交互
- 数据持久化

**包含**:
- Database: 数据库配置和实体映射
- Repositories: 仓储实现
- External Services: 第三方服务集成

### 5. Shared层

**职责**: 跨模块的通用功能

**包含**:
- Guards: 认证和授权守卫
- Decorators: 自定义装饰器
- Utils: 工具函数
- Types: 共享类型
- Constants: 常量定义

## 数据流

### 写操作流程 (Command)

```
HTTP Request
    ↓
Controller (API Layer)
    ↓
Command Service (Application Layer)
    ↓
Domain Model (Domain Layer)
    ↓
Repository Implementation (Infrastructure Layer)
    ↓
Database
```

### 读操作流程 (Query)

```
HTTP Request
    ↓
Controller (API Layer)
    ↓
Query Service (Application Layer)
    ↓
Repository (Infrastructure Layer)
    ↓
Database
    ↓
Transformer (API Layer)
    ↓
HTTP Response
```

## CQRS模式优势

1. **职责分离**: 读写操作分离，代码更清晰
2. **独立优化**: 读写可以独立优化性能
3. **可扩展性**: 可以独立扩展读写服务
4. **简化复杂性**: 查询不受写模型约束

## 依赖规则

遵循依赖倒置原则（DIP）：

```
API Layer          → Application Layer
Application Layer  → Domain Layer
Infrastructure     → Domain Layer (实现接口)

Domain Layer       → 不依赖任何层
```

## 路径别名配置

在 `tsconfig.json` 中配置：

```json
{
  "paths": {
    "@api/*": ["src/api/*"],
    "@application/*": ["src/application/*"],
    "@domains/*": ["src/domains/*"],
    "@infrastructure/*": ["src/infrastructure/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

## 模块组织

每个功能域包含：

1. **Module**: NestJS模块定义
2. **Service**: 业务逻辑实现
3. **Controller**: HTTP接口（在API层）
4. **DTOs**: 数据传输对象（在API层）
5. **Domain Models**: 领域模型（在Domain层）

## 最佳实践

1. **单一职责**: 每个类只负责一件事
2. **依赖注入**: 使用接口和DI容器
3. **不可变性**: 优先使用不可变对象
4. **领域模型优先**: 业务逻辑放在领域层
5. **薄控制器**: 控制器只做路由和参数验证
6. **富领域模型**: 领域对象包含业务逻辑
7. **仓储模式**: 数据访问通过仓储接口

## 已实现的功能

✅ 用户注册 (POST /auth/register)
✅ 用户登录 (POST /auth/login)
✅ 获取当前用户信息 (GET /users/me)
✅ 根据ID获取用户 (GET /users/:id)
✅ JWT认证机制
✅ 密码加密 (bcrypt)
✅ 输入验证 (class-validator)

## 后续扩展方向

根据 [mvp-booking-billing-plan.md](./mvp-booking-billing-plan.md)，后续需要实现：

### Week 2-3: 档案和合同
- Profile Domain (student, mentor, counselor)
- Service Provider Domain
- Contract Domain

### Week 4: 预约功能
- Services Domain (Session)
- Booking Saga
- Availability Query Service
- Pricing Query Service

### Week 5: 完成和计费
- Service Ledger
- Finance Domain (APLedger)
- Completion Saga
- Balance Query Service

## 参考文档

- [mvp-booking-billing-plan.md](./mvp-booking-billing-plan.md) - MVP计划详细说明
- [README.md](./README.md) - 项目使用说明
- [NestJS Documentation](https://docs.nestjs.com/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
