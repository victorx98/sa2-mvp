
## 项目架构

本项目采用 DDD (Domain-Driven Design) 架构模式，遵循 CQRS 模式：

```
src/
├── api/                         # API层（外部接口）
│   ├── controllers/             # RESTful 控制器
│   ├── dto/                     # 数据传输对象
│   │   ├── request/             # 请求 DTO
│   │   └── response/            # 响应 DTO
│   └── transformers/            # 数据转换器
├── application/                 # 应用服务层
│   ├── commands/                # 命令服务（CQRS - Write Side）
│   │   └── auth-command/        # 认证命令
│   └── queries/                 # 查询服务（CQRS - Read Side）
├── domains/                     # 领域层（业务规则核心）
│   └── identity/                # 身份域
│       └── user/                # 用户领域模型和仓储接口
├── infrastructure/              # 基础设施层
│   ├── database/                # 数据库配置和实体
│   └── repositories/            # 仓储实现
├── shared/                      # 共享模块
│   ├── guards/                  # 守卫（认证、权限）
│   │   └── strategies/          # Passport策略
│   ├── decorators/              # 装饰器
│   ├── types/                   # 共享类型定义
│   ├── utils/                   # 工具函数
│   └── constants/               # 常量定义
└── main.ts                      # 应用入口
```

### 架构层次说明

| 层次 | 职责 | 特点 |
|-----|------|------|
| **API层** | 接收和响应HTTP请求 | 薄层，不含业务逻辑 |
| **Application层** | 实现业务用例 | 无状态，可复用，分离读写 |
| **Domain层** | 封装业务规则 | 纯粹的领域逻辑 |
| **Infrastructure层** | 技术基础设施 | 可替换实现 |
| **Shared层** | 跨模块通用功能 | 工具类和装饰器 |

## 技术栈

- **框架**: NestJS 10.x
- **数据库**: Supabase PostgreSQL
- **ORM**: TypeORM
- **认证**: JWT (JSON Web Token)
- **密码加密**: bcrypt
- **验证**: class-validator

## 安装和配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@db.gexkpohuuqewswljbguf.supabase.co:5432/postgres

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h

# 应用配置
PORT=3000
NODE_ENV=development
```

### 3. 运行应用

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

服务将在 `http://localhost:3000` 启动。

## API 文档

### 认证接口

#### 注册用户

```http
POST /auth/register
Content-Type: application/json

{
  "account": "testuser",
  "password": "password123",
  "email": "user@example.com",
  "nickname": "Test User",
  "cnNickname": "测试用户",
  "gender": "male",
  "country": "China"
}
```

响应:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123",
    "account": "testuser",
    "email": "user@example.com",
    "nickname": "Test User",
    "cnNickname": "测试用户",
    "status": "active"
  }
}
```

#### 用户登录

```http
POST /auth/login
Content-Type: application/json

{
  "account": "testuser",
  "password": "password123"
}
```

响应:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123",
    "account": "testuser",
    "email": "user@example.com",
    "nickname": "Test User",
    "cnNickname": "测试用户",
    "status": "active"
  }
}
```

### 用户接口

所有用户接口需要在请求头中携带 JWT token：

```http
Authorization: Bearer <accessToken>
```

#### 获取当前用户信息

```http
GET /users/me
Authorization: Bearer <accessToken>
```

响应:

```json
{
  "id": "abc123",
  "account": "testuser",
  "email": "user@example.com",
  "nickname": "Test User",
  "cnNickname": "测试用户",
  "gender": "male",
  "country": "China",
  "status": "active",
  "createdTime": "2024-01-01T00:00:00.000Z",
  "modifiedTime": "2024-01-01T00:00:00.000Z"
}
```

#### 根据ID获取用户信息

```http
GET /users/:id
Authorization: Bearer <accessToken>
```

响应格式同上。

## 错误处理

API 使用标准 HTTP 状态码：

- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未授权或 token 无效
- `404 Not Found` - 资源不存在
- `409 Conflict` - 资源冲突（如账号已存在）
- `500 Internal Server Error` - 服务器错误

错误响应格式：

```json
{
  "statusCode": 400,
  "message": "Account already exists",
  "error": "Conflict"
}
```

## 开发指南

### 核心目录说明

#### API层
- `api/controllers/` - REST API 控制器，处理HTTP请求和响应
- `api/dto/request/` - 请求数据传输对象，用于验证前端输入
- `api/dto/response/` - 响应数据传输对象，定义返回给前端的数据格式
- `api/transformers/` - 数据转换器，将领域对象转换为响应DTO

#### Application层（CQRS模式）
- `application/commands/` - 命令服务，处理写操作（创建、更新、删除）
  - `auth-command/` - 认证命令（注册、登录）
- `application/queries/` - 查询服务，处理读操作（查询、聚合）
  - `user-query.service.ts` - 用户查询服务

#### Domain层
- `domains/identity/user/` - 用户身份域
  - `user.interface.ts` - 用户领域模型接口
  - `user-repository.interface.ts` - 用户仓储接口

#### Infrastructure层
- `infrastructure/database/` - 数据库配置和实体定义
  - `entities/` - TypeORM实体
  - `database.config.ts` - 数据库连接配置
- `infrastructure/repositories/` - 仓储实现，连接领域层和数据层

#### Shared层
- `shared/guards/` - NestJS守卫，用于认证和授权
  - `strategies/` - Passport策略（JWT等）
- `shared/decorators/` - 自定义装饰器（@Public, @CurrentUser等）
- `shared/types/` - 共享类型定义
- `shared/utils/` - 工具函数
- `shared/constants/` - 常量定义

### 认证流程

1. 用户注册/登录成功后，服务器返回 JWT token
2. 前端将 token 存储在本地（localStorage/sessionStorage）
3. 后续请求在 Authorization 头中携带 `Bearer <token>`
4. 服务器通过 JWT 策略验证 token 有效性
5. 验证通过后，将用户信息注入到 request.user

## 待实现功能

根据数据库设计，后续需要实现的功能包括：

- 学生(Student)管理
- 导师(Mentor)管理
- 顾问(Counselor)管理
- 会员(Membership)管理
- 服务(Service)管理
- 职位类别和职位管理
- 角色和权限管理
- 社交网络账号关联
