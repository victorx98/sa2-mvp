# NestJS + Supabase Auth 用户认证与API鉴权系统架构设计方案 

## 一、方案背景与核心问题

### 1.1 业务场景
- 需要支持三种用户角色：学生(student)、导师(mentor)、咨询师(counselor)
- 每个角色有独立的扩展信息表
- 用户基础信息(gender、country等)需要灵活扩展
- 要求架构简单、依赖少

### 1.2 技术选型
**使用 Supabase Auth 而非自主实现的原因：**
- ✅ 开箱即用的安全功能(密码哈希、JWT管理、会话处理)
- ✅ 内置邮箱验证、密码重置、OAuth、MFA等功能
- ✅ Row Level Security (RLS) 可在数据库层控制权限
- ✅ 减少70%以上的认证相关开发工作
- ✅ 安全补丁由 Supabase 维护,降低安全风险

### 1.3 核心架构挑战
**最关键问题：跨系统事务一致性**

Supabase Auth 通过 HTTP API 操作，无法与业务数据库操作在同一事务中。本方案采用同步补偿模式来应对此挑战。

```
问题场景：
1. 调用 Supabase Auth API 创建用户 → 成功 ✅
2. 创建业务表记录(users, students) → 失败 ❌
3. 结果：auth.users 有记录，但业务表没有 → 数据不一致
```

本方案通过在步骤2失败后，对步骤1进行补偿（删除用户）来解决该问题。

---

## 二、架构设计理念

### 2.1 核心设计原则

#### 原则 1：关注点分离
- **Supabase Auth (auth.users)**：只负责认证（密码验证、token管理）。
- **业务表 (public.users)**：负责所有业务数据存储和查询。
- **角色表 (students/mentors/counselors)**：存储角色特定信息。

#### 原则 2：同步补偿
- 采用同步工作流处理用户注册，保证操作的即时性。
- 当分布式操作的后续步骤失败时，对已成功的前置步骤执行补偿操作（回滚）。
- 例如，业务用户创建失败时，立即调用API删除已创建的Auth用户。

#### 原则 3：风险认知
- **明确接受补偿失败的风险**。在极少数情况下（如网络中断、服务崩溃），补偿操作本身可能失败，这将导致`auth.users`中存在孤儿数据，需要监控和手动清理机制。

---

## 三、数据架构设计

### 3.1 表关系设计

```
auth.users (Supabase管理)
    │
    │ (1对1, 强关联)
    ↓
public.user (业务主表)
    ├─ id (主键, 与auth.users.id完全相同)
    └─ 基础字段(email, role, gender, country...)
        ↓ (1对1)
    ┌───┴────┬────────┬───────────┐
student  mentor  counselor
(角色扩展表)
```

### 3.2 关键设计要点

#### 1. 统一用户ID
- **`public.user`表的主键 `id` 直接使用 `auth.users` 表的 `id` (UUID)**。
- **`public.student``public.mentor``public.counselor`表的主键 `id` 直接使用 `public.user` 表的 `id` (UUID)**。
- 两个系统的用户ID保持严格一致，简化了关联查询。
- 注册时，必须先成功创建Auth用户，才能获得ID用于创建业务用户。

#### 2. 移除异步组件
- **无 `is_auth_synced` 状态标记**：由于流程是同步的，用户要么创建成功（同时存在于Auth和业务库），要么失败，不存在中间状态。
- **无 `auth_sync_queue` 同步队列表**：所有操作在单次请求中完成，无需后台任务和队列。

---

## 四、业务流程设计

### 4.1 用户注册流程

```
┌─────────────────────────────────────────────────────────────┐
│                    用户提交注册信息                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   Step 1: 业务数据验证         │
         │   - 邮箱唯一性检查             │
         │   - 密码强度验证               │
         │   - 角色(student/mentor/counselor)│
         └───────────┬───────────────────┘
                     │
                     ▼
         ┌───────────────────────────────┐
         │  Step 2: 创建 Auth 用户        │
         │  - 调用 Supabase Auth API     │
         │    admin.createUser()         │
         └───────────┬───────────────────┘
                     │
            ┌────────┴────────┐
        失败 ▼                ▼ 成功 (获得 auth_user_id，user/student/mentor/counselor用同1个id)
┌────────────────┐      ┌──────────────────────────────────┐
│ 返回注册失败   │      │   Step 3: 尝试创建业务用户、user-role │
│                │      │   student/mentor/counselor       |
|                |      |      (try...catch)               │
└────────────────┘      └──────────┬───────────────────────┘
                                   │
                          ┌────────┴────────┐
                      失败 ▼                ▼ 成功
            ┌──────────────────┐      ┌──────────────────┐
            │ Step 4a: 补偿   │       │ Step 4b:         │
            │ 删除 Auth 用户   │       │ 返回注册成功     │
            │ admin.deleteUser()│      └──────────────────┘
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ 返回注册失败     │
            └──────────────────┘
```

**关键点：**
- 整个流程在一次API请求中同步完成，用户需等待所有步骤结束。
- 业务数据库的写入操作被包裹在`try...catch`块中，失败后触发补偿逻辑。

### 4.2 用户登录流程

```
┌────────────────────────────────┐
│   用户提交邮箱和密码             │
└───────────┬────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Step 1: 调用 Supabase Auth    │
│  - signInWithPassword()        │
└───────────┬───────────────────┘
            │
      ┌─────┴──────┐
      │            │
  失败 ▼        ▼ 成功
┌──────────┐  ┌────────────────────┐
│ 返回错误  │  │ Step 2: 获取完整信息│
│ 邮箱或    │  │ - 从JWT获取用户ID  │
│ 密码错误  │  │ - 使用ID查询业务表 │
└──────────┘  │   (users, roles)   │
              └────────┬───────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Step 3: 返回   │
              │ - access_token │
              │ - user profile │
              └────────────────┘
```

**关键点：**
- 登录流程简化，无需检查同步状态。
- 认证完全委托给 Supabase，成功后使用返回的ID查询业务数据。

### 4.3 受保护路由访问流程

```
┌────────────────────────────────┐
│  用户请求受保护的 API            │
│  Header: Authorization: Bearer  │
│          <access_token>         │
└───────────┬────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Auth Guard 拦截               │
│  - 提取 Bearer token           │
└───────────┬───────────────────┘
            │
      ┌─────┴──────┐
      │            │
  无token ▼       ▼ 有token
┌──────────┐  ┌────────────────────┐
│ 返回 401 │  │ 调用 Supabase Auth │
│ 未授权   │  │ getUser(token)     │
└──────────┘  └────────┬───────────┘
                       │
                 ┌─────┴──────┐
                 │            │
             无效 ▼          ▼ 有效 (获得 user object)
        ┌──────────┐  ┌──────────────────────────┐
        │ 返回 401 │  │ Step 3: 挂载业务用户信息 │
        │ 无效令牌  │  │ - 使用 user.id 查询业务库 │
        └──────────┘  │ - 将完整 profile 挂载到  │
                      │   request.user           │
                      └──────────┬───────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ 执行业务逻辑    │
                        └────────────────┘
```

**关键点：**
- Guard在验证Token成功后，需要执行一次数据库查询，以获取完整的业务用户信息。

---

## 五、异常场景处理

### 5.1 注册阶段异常

#### 场景 1：邮箱已在 Supabase 中存在
**检测点**：`admin.createUser()` API 调用返回错误。
**处理策略**：直接向用户返回 409 Conflict，提示“邮箱已被注册”。

#### 场景 2：业务数据库写入失败
**可能原因**：数据库连接中断、约束冲突等。
**处理策略**：
1.  捕获数据库操作异常。
2.  在 `catch` 块中，调用 `admin.deleteUser()`，传入之前创建成功的 Auth 用户 ID 进行补偿。
3.  向用户返回 500 错误，提示“注册失败，请重试”。

#### 场景 3：补偿操作（删除Auth用户）失败
**这是本方案的核心风险点**。
**可能原因**：在执行补偿操作时，发生网络中断、Supabase服务不可用或应用进程崩溃。
**处理策略**：
- **无自动处理机制**：一旦发生，将导致 `auth.users` 中存在孤儿数据。
- **缓解措施**：
    - **记录严重错误日志**：在补偿操作的 `catch` 块中，必须记录包含用户ID和错误信息的严重级别日志。
    - **建立监控告警**：通过日志监控系统（如Datadog, Sentry）设置告警规则，一旦捕获到“补偿失败”的日志，立即通知开发人员。
    - **准备手动清理脚本**：提供一个安全的、可根据用户ID或邮箱清理Supabase孤儿用户的管理脚本，供开发人员手动执行。

### 5.2 并发场景异常

#### 场景 1：同一邮箱并发注册
**问题**：两个请求可能都通过了业务数据库的初始检查（如果有时）。
**解决方案**：
- `Supabase Auth` 的 `users` 表对 `email` 字段有唯一约束。第二个 `admin.createUser()` API 调用会失败。
- 这将自然地阻止重复用户的创建，无需在业务数据库层面增加额外约束。
---

## 六、授权(Authorization)设计

认证（Authentication）解决了“你是谁”的问题，而授权（Authorization）解决了“你有什么权限”的问题。本系统采用基于角色的访问控制（RBAC）模型。

### 6.1 授权数据模型
为了支持灵活的角色分配（例如，一个用户未来可能同时是mentor和counselor），我们引入`roles`和`user_roles`表。

```
public.users
    │
    ├─ id (PK)
    └─ ...
    ▲
    │
(1对多)
    │
public.user_roles
    ├─ user_id (FK to users.id)
    └─ role_id (FK to roles.id)
                                ▲
                                │
                            (多对1)
                                │
                            public.roles
                                ├─ id (PK)
                                └─ name (VARCHAR, e.g., 'student', 'mentor')
```

- **`roles`**: 角色定义表，存储所有可用的角色名称。
- **`user_roles`**: 用户和角色之间的关联表（Pivot Table），实现多对多关系。

### 6.2 核心组件

#### 1. `@Roles()` 装饰器
一个自定义装饰器，用于在控制器或路由处理器上声明访问该端点所需的角色。

**示例 (`/src/shared/decorators/roles.decorator.ts`):**
```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**使用方法:**
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../shared/decorators/roles.decorator';
import { AuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';

@Controller('mentors')
@UseGuards(AuthGuard, RolesGuard) // 先认证，后授权
export class MentorController {
  @Get('profile')
  @Roles('mentor') // 声明只有 'mentor' 角色的用户才能访问
  getProfile() {
    // ...
  }
}
```

#### 2. `RolesGuard`
一个实现了`CanActivate`接口的NestJS Guard，负责执行授权逻辑。

**示例 (`/src/shared/guards/roles.guard.ts`):**
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // 如果没有设置角色要求，则默认允许访问
    }
    const { user } = context.switchToHttp().getRequest();
    // user.roles 应该在 AuthGuard 中被查询并附加
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

### 6.3 授权流程

```
┌───────────────────────────────────────────────────────────┐
│  用户请求 @Roles('mentor') 的受保护 API                     │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 1. AuthGuard 成功执行                                     │
│    - Token有效                                            │
│    - 从数据库查询用户profile和roles                       │
│    - request.user = { id: '...', roles: ['student'] }     │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 2. RolesGuard 执行                                        │
│    - 使用 Reflector 获取元数据: requiredRoles = ['mentor']  │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 比较角色                                               │
│    - 用户角色: user.roles = ['student']                   │
│    - 所需角色: requiredRoles = ['mentor']                 │
│    - ['student'].some(role => ['mentor'].includes(role))  │
│    - 结果: false                                          │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 访问被拒绝                                             │
│    - RolesGuard.canActivate() 返回 false                  │
│    - NestJS 抛出 403 ForbiddenException                   │
└───────────────────────────────────────────────────────────┘
```

### 6.4 `AuthGuard` 职责扩展
为了让`RolesGuard`能正常工作，`AuthGuard`的职责需要扩展。在`4.3 受保护路由访问流程`的基础上，`AuthGuard`在验证Token并获取`user object`后，**必须**执行以下操作：

1.  **查询角色**：使用`user.id`查询`user_roles`和`roles`表，获取该用户拥有的所有角色名称列表（例如 `['student']`）。
2.  **附加到`request.user`**：将查询到的角色列表附加到`request.user`对象上。

最终，挂载到`request`上的`user`对象应该如下所示：
```json
{
  "id": "user-uuid-from-supabase",
  "email": "user@example.com",
  "roles": ["student"],
  // ... 其他业务字段
}
```
这样，下游的`RolesGuard`才能获取到用户的角色并进行有效的权限判断。
---

## 七、业务用户信息获取策略

在`AuthGuard`验证Token成功后，如何获取当前用户的详细业务信息（特别是角色信息）是一个关键决策点。这关系到系统的性能和数据一致性。

### 7.1 方案对比

#### 方案一：每次请求实时查询 (Per-Request Real-time Query)
- **流程**: `AuthGuard`在验证Token成功后，立即使用`user.id`查询业务数据库（`public.users`, `user_roles`等），获取完整的、最新的用户信息和角色，然后将其挂载到`request.user`上。
- **优点**:
    - **数据强一致性**: `request.user`中的信息永远是最新的，不存在因缓存或数据同步延迟导致的“脏数据”问题。
    - **架构清晰**: 业务数据库是用户信息的唯一真实来源（Single Source of Truth），更新和读取逻辑都更简单直接。
- **缺点**:
    - **性能开销**: 每个受保护的API请求都会至少增加一次数据库查询。在高并发场景下，这会增加数据库的负载和API的响应延迟。

#### 方案二：将业务数据存入JWT (Embed Business Data in JWT)
- **流程**: 在用户注册或更新角色等业务信息时，除了写入业务数据库，还额外调用一次Supabase API，将角色等关键信息存入`user_metadata`。Supabase会自动将`user_metadata`打包进JWT。在`AuthGuard`中，直接从解码后的JWT载荷中读取业务信息，无需查询数据库。
- **优点**:
    - **读取性能高**: API请求无需额外查询数据库，响应速度更快。
- **缺点**:
    - **数据冗余与一致性风险**: 这是此方案最主要的风险。数据被复制到了Supabase的`user_metadata`中，如果业务数据库更新后，同步`user_metadata`失败或被遗漏，JWT中的用户信息将会是过期的，可能引发严重的安全漏洞（例如，已被降权的用户仍然持有高权限的Token）。
    - **写操作复杂化**: 更新用户信息的逻辑变得更复杂，需要处理对两个独立系统（业务数据库和Supabase）的写入，增加了失败点。

### 7.2 当前选择

**本项目当前选择【方案一：每次请求实时查询】。**

**理由如下**:
1.  **优先保证数据一致性**: 对于权限和用户角色这类关键数据，任何不一致都可能导致安全问题。方案一从根本上避免了数据同步失败带来的风险。
2.  **简化核心逻辑**: 保证了用户资料更新等“写操作”的逻辑足够简单和原子化，降低了引入Bug的可能性。
3.  **性能开销可接受**: 在现代数据库中，一次索引化的主键查询性能非常高（通常在1-5毫秒内），对于绝大多数应用场景，这个开销是完全可以接受的。未来如果遇到性能瓶颈，还可以通过引入应用层缓存（如Redis）来进一步优化，而无需改变现有架构。

---
