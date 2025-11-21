---
trigger: always_on
---

# 代码风格规范

- **注释规范**: 使用英文+中文双语注释（格式：英文注释(中文注释)）
- **异常处理**: 所有异常消息和错误文本必须使用英文
- **文档语言**: Markdown 文件必须使用中文编写
- **代码导入**: 禁止未使用的 import 语句，保持代码整洁
- **导入路径规范**: 必须使用别名路径导入模块，禁止使用相对路径
- **代码质量**: 所有代码必须通过 ESLint 检查（`npm run lint`）
- **代码格式**: 所有代码必须通过 Prettier 格式化（`npm run format`）
- **规范遵循**: 所有文件必须遵循项目代码规范

# 事件管理规范

## 事件定义规范

- **统一存放**: 所有事件(Event)的定义必须统一存放于项目目录 `src/shared/events` 路径下
- **集中管理**: 确保事件定义的集中管理与复用，避免重复定义
- **命名规范**: 事件名称必须遵循 `domain.entity.action` 格式（如：`contract.session.completed`）
- **类型定义**: 每个事件必须明确定义其数据载荷(payload)的TypeScript类型

## 事件订阅规范

- **订阅位置**: 事件订阅需在各自业务域内的 `events/listeners` 目录中实现
- **业务关联**: 保证事件处理逻辑与业务域的关联性和内聚性
- **订阅方式**: 使用 `@OnEvent()` 装饰器或 `EventEmitter2` 的 `on()` 方法订阅事件
- **错误处理**: 事件监听器必须包含适当的错误处理逻辑，防止单个事件处理失败影响整个系统

## 事件发布规范

- **发布方式**: 事件发布必须直接使用 `EventEmitter2` 提供的 `emit` 函数
- **标准格式**: 所有事件发布必须遵循以下标准格式：
  ```typescript
  this.eventEmitter.emit(SESSION_BOOKED_EVENT, bookResult);
  ```
- **参数说明**:
  - 第一个参数: 事件名称常量（必须从 `src/shared/events` 中导入）
  - 第二个参数: 事件携带的数据 payload（必须符合事件定义的类型）
- **一致性**: 确保所有事件触发机制的一致性，禁止使用其他发布方式

## 事件生命周期管理

- **事件溯源**: 重要事件应记录到数据库事件表中，便于追踪和审计
- **幂等性**: 事件处理器应设计为幂等操作，确保重复处理不会产生副作用
- **事务一致性**: 事件发布应与业务操作在同一事务中，或使用可靠事件发布模式

# 代码所有权管理

- **代码识别**: 使用 `git blame` 命令查看代码作者和修改时间
- **历史查询**: 使用 `git log --follow <文件名>` 查看文件完整修改历史
- **责任范围**: 仅对自己拥有的代码负责质量与格式（参考 `.github/CODEOWNERS` 文件）
- **代码审查**: 修改他人代码前应先联系代码所有者
- **权限管理**: 可通过修改 `.github/CODEOWNERS` 文件调整代码所有权分配

# 测试代码规范

## 单元测试规范

- **文件命名**: 单元测试文件必须与被测试文件同名，添加 `.spec.ts` 后缀（如：`contract.service.ts` 的测试文件为 `contract.service.spec.ts`）
- **存储位置**: 单元测试文件必须与被测试文件存放在同一目录下
- **数据要求**: 单元测试必须使用 mock 数据，禁止连接真实数据库
- **测试框架**: 使用 Jest 作为单元测试框架
- **模拟依赖**: 使用 `jest.mock()` 或 `@golevelup/ts-jest` 模拟外部依赖
- **测试覆盖率**: 每个单元测试覆盖率应达到 80% 以上

### Mock数据生成规范

- **ID属性规范**: 所有包含id属性的测试数据，其值必须严格使用UUID格式生成，确保符合RFC 4122标准定义的UUID格式规范
  ```typescript
  // 正确示例
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000', // 标准UUID格式
    name: 'Test User'
  };
  
  // 错误示例
  const mockUser = {
    id: 'user-123', // 非UUID格式
    name: 'Test User'
  };
  ```

- **枚举类型规范**: 对于枚举类型的测试数据，必须严格匹配项目中对应枚举类型的定义，确保所有生成的枚举值均为该枚举类型的有效值之一，不允许出现未定义的枚举值
  ```typescript
  // 假设项目中有以下枚举定义
  enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    PENDING = 'pending'
  }
  
  // 正确示例 - 使用枚举中定义的值
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: UserStatus.ACTIVE // 使用枚举定义的值
  };
  
  // 错误示例 - 使用未定义的枚举值
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'deleted' // 未在枚举中定义的值
  };
  ```

## 集成测试规范

- **文件命名**: 集成测试文件使用 `.e2e-spec.ts` 后缀（如：`contract-flow.e2e-spec.ts`）
- **存储位置**: 集成测试文件必须存放在 `test/[模块名称]/` 目录下（如：`test/contract/`）
- **数据要求**: 集成测试必须使用真实数据，连接测试数据库
- **数据库连接**: 使用 `TestDatabaseHelper` 类管理测试数据库连接，通过 NestJS TestingModule 初始化，依赖 `DATABASE_CONNECTION` 注入获取数据库实例
- **测试隔离**: 每个集成测试前后必须清理测试数据，确保测试间相互独立，清理时不得影响数据库中已有的非测试数据
- **测试范围**: 集成测试应覆盖跨模块的业务流程和数据库交互

# 数据库操作规范

## 数据库连接方案

- **连接字符串获取**: 使用 `createEnhancedDatabaseUrl()` 函数从 `drizzle.config.ts` 创建增强的数据库URL，默认使用环境变量 `POSTGRES_URL` 或硬编码的Supabase连接字符串
- **测试环境检测**: 通过 `process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined` 检测测试环境
- **DNS解析**: 自动解析主机名为IPv4地址，提高连接稳定性
- **连接池配置**: 
  - 测试环境: 最大5个连接，最小1个连接，空闲超时30秒
  - 生产环境: 最大20个连接，最小2个连接，空闲超时5分钟
  - 连接超时: 10秒
- **SSL配置**: 设置 `rejectUnauthorized: false` 以支持Supabase连接
- **错误处理**: 实现连接池和客户端错误处理，防止未处理的错误事件
- **连接测试**: 初始化时测试数据库连接，失败时清理连接池
- **测试数据库助手**: 使用 `TestDatabaseHelper` 类管理测试中的数据库连接和清理

## 数据库迁移管理

- **禁止手动创建迁移脚本**: 所有数据库结构变更必须通过 Supabase MCP 工具直接更新
- **使用 Supabase MCP 工具**: 依据 schema 文件更新数据表结构
- **禁止生成数据库迁移脚本**: 不允许手动编写或生成迁移文件

## 数据库操作规范

- **查询优化**: 使用 Drizzle ORM 进行类型安全的数据库操作
- **事务处理**: 对于涉及多个表的操作，使用数据库事务确保数据一致性
- **错误处理**: 所有数据库操作必须包含适当的错误处理和日志记录
- **连接管理**: 使用连接池管理数据库连接，避免频繁创建和销毁连接
- **索引优化**: 为经常查询的字段添加适当的索引，提高查询性能

# 模块导入别名路径规范

## 别名路径命名规则

- **命名格式**: 所有别名路径必须以 `@` 符号开头，后跟模块名称和通配符 `/*`
- **模块名称**: 使用小写字母和连字符 `-` 分隔单词，避免使用驼峰命名
- **一致性**: 同一模块的别名路径在整个项目中必须保持一致

## 别名路径映射关系

- **@core/\***: 映射到 `src/core/*` - 核心功能模块（邮件、通知、日历等）
- **@domains/\***: 映射到 `src/domains/*` - 业务领域模块（财务、合同、目录等）
- **@application/\***: 映射到 `src/application/*` - 应用层模块（命令、查询等）
- **@infrastructure/\***: 映射到 `src/infrastructure/*` - 基础设施模块（数据库、认证等）
- **@api/\***: 映射到 `src/api/*` - API层模块（控制器、DTO等）
- **@shared/\***: 映射到 `src/shared/*` - 共享模块（事件、异常、类型等）
- **@telemetry/\***: 映射到 `src/telemetry/*` - 遥测模块（指标、日志等）

## 别名路径使用规范

- **导入语句**: 所有模块导入必须使用别名路径，禁止使用相对路径
- **正确示例**:
  ```typescript
  import { MentorAppealService } from '@domains/financial/services/mentor-appeal.service';
  import { DatabaseModule } from '@infrastructure/database/database.module';
  import { SessionCreatedEvent } from '@shared/events/session.events';
  ```
- **错误示例**:
  ```typescript
  import { MentorAppealService } from '../financial/services/mentor-appeal.service';
  import { DatabaseModule } from '../../infrastructure/database/database.module';
  import { SessionCreatedEvent } from '../../../shared/events/session.events';
  ```

## 环境配置方法

- **开发环境**: 在 `tsconfig.json` 中配置 `paths` 属性，确保 TypeScript 编译器能正确解析别名路径
- **测试环境**: 在 `jest.config.js` 中配置 `moduleNameMapper` 属性，确保 Jest 测试框架能正确解析别名路径
- **生产环境**: 确保构建工具（如 Webpack）正确配置别名路径解析，与开发环境保持一致

## 违规处理

- **错误提示**: ESLint 检查应配置相应规则，对使用相对路径的导入语句发出警告或错误
- **代码审查**: 代码审查过程中必须检查导入语句是否符合别名路径规范
- **修复建议**: 发现违规导入时，应立即替换为对应的别名路径
- **自动化修复**: 可配置 ESLint 自动修复功能，将相对路径导入自动转换为别名路径导入

## 特殊情况处理

- **第三方库导入**: 第三方库导入继续使用标准导入方式，不受别名路径规范约束
- **类型定义导入**: 类型定义导入也应遵循别名路径规范，确保类型定义的一致性
- **动态导入**: 动态导入语句也应使用别名路径，保持导入方式的一致性

# 禁止事项

- **文档创建**: 禁止创建任何形式的总结文档
- **代码备份**: 禁止创建代码备份文件
- **提交语言**: 生成提交内容时，必须使用英文，禁止使用中文