# 标准化API设计方案（更新版）

## 1. 业务域边界与职责

### 1.1 Catalog (目录) 域
- **边界**：产品管理、产品项管理、产品快照管理
- **职责**：
  - 产品创建、更新、发布、取消发布、查询
  - 产品项管理（添加、删除、排序）
  - 产品快照生成
  - 产品搜索与过滤

### 1.2 Contract (合同) 域
- **边界**：合同管理、服务持有管理、服务台账管理
- **职责**：
  - 合同创建、更新、查询
  - 服务持有管理
  - 服务台账记录
  - 合同状态管理

### 1.3 Financial (财务) 域
- **边界**：财务管理、支付处理、费用核算
- **职责**：
  - 财务记录管理
  - 支付处理
  - 费用核算
  - 财务报表生成

### 1.4 Placement (配置) 域
- **边界**：配置管理、服务匹配、资源分配
- **职责**：
  - 配置管理
  - 服务匹配
  - 资源分配
  - 配置规则管理

## 2. API架构设计

### 2.1 分层架构
```
┌────────────────────┐
│     API Layer      │  (HTTP, Auth, Routing, Trace, Exception)
└─────────┬──────────┘
          ↓
┌────────────────────┐
│  Application Layer │  (Business Use Case Orchestration, Frontend Adaption, DTO Mapping)
└─────────┬──────────┘
          ↓
┌────────────────────┐
│    Domain Layer    │  (Business Rules & Models)
└────────────────────┘
```

### 2.2 API Layer 职责
- 处理HTTP请求、路由和参数提取
- 使用Guards执行认证和授权
- 保持控制器"薄"，将所有业务逻辑委托给Application Layer
- 使用OpenAPI/Swagger装饰器定义API契约

### 2.3 Application Layer 职责
- 编排业务用例
- 写入操作：协调多个Domain服务，确保业务规则得到执行
- 读取操作：从domain高效获取数据，并从实体/DTO转换为特定的客户端响应DTO
- 管理跨域事务，确保数据一致性
- 保持角色无关，返回可被多个BFF重用的业务数据

## 3. API命名规范

### 3.1 URL命名规范
```
/api/{role}/{resource}/{action}
```
- **role**：用户角色（student, mentor, admin, counselor）
- **resource**：资源名称（sessions, products, contracts）
- **action**：操作名称（可选，如search, publish）

### 3.2 HTTP方法规范
| 操作类型 | HTTP方法 | 示例URL |
|---------|---------|--------|
| 列表查询 | GET | /api/student/sessions |
| 详情查询 | GET | /api/student/sessions/{id} |
| 创建资源 | POST | /api/student/sessions |
| 更新资源 | PUT | /api/student/sessions/{id} |
| 部分更新 | PATCH | /api/student/sessions/{id} |
| 删除资源 | DELETE | /api/student/sessions/{id} |
| 特殊操作 | POST | /api/admin/products/{id}/publish |

### 3.3 目录结构规范
```
src/api/controllers/{role}/{resource}.controller.ts
// e.g., src/api/controllers/student/sessions.controller.ts
// e.g., src/api/controllers/admin/products.controller.ts
```

## 4. CQRS实现策略

### 4.1 命令（Write Path）
- **目标**：确保业务规则和数据一致性得到严格执行
- **方法**：必须通过Domain Layer操作
- **实现**：Command handlers加载Aggregates，执行业务逻辑，保存更改
- **目录结构**：
  ```
  src/application/commands/{feature}/{do-something.command.ts, dto/}
  ```

### 4.2 查询（Read Path）
- **目标**：最大化数据检索的性能和灵活性
- **方法**：可以绕过完整的Domain模型，直接使用ORM或原生SQL
- **实现**：Query handlers使用ORM构建优化的JOIN操作，返回针对特定UI需求的扁平DTO
- **目录结构**：
  ```
  src/application/queries/{feature}/{get-something.query.ts, dto/}
  ```

### 4.3  saga（复杂事务）
- **目标**：处理跨多个Domain的复杂写操作
- **方法**：通过Domain Layer操作，确保一致性
- **目录结构**：
  ```
  src/application/sagas/{feature}/{orchestrate-something.saga.ts, dto/}
  ```

## 5. 请求/响应格式

### 5.1 请求格式
- 使用JSON格式
- 统一的分页参数：
  ```json
  {
    "page": 1,
    "pageSize": 20
  }
  ```
- 统一的排序参数：
  ```json
  {
    "sort": {
      "field": "createdAt",
      "order": "desc"
    }
  }
  ```
- 统一的过滤参数：
  ```json
  {
    "filter": {
      "status": "ACTIVE",
      "keyword": "test"
    }
  }
  ```

### 5.2 响应格式
- 统一使用JSON格式
- 标准响应结构：
  ```json
  {
    "data": {},
    "meta": {
      "total": 100,
      "page": 1,
      "pageSize": 20,
      "totalPages": 5
    }
  }
  ```
- 错误响应结构：
  ```json
  {
    "statusCode": 404,
    "message": "Product not found",
    "error": "Not Found"
  }
  ```

## 6. 认证授权机制

### 6.1 认证方式
- 使用JWT令牌进行认证
- 令牌通过Authorization头传递：`Authorization: Bearer {token}`
- 支持刷新令牌机制

### 6.2 授权机制
- 基于角色的访问控制（RBAC）
- 使用Guards实现授权：
  ```typescript
  @Controller('api/admin/users')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  export class UsersController {
    // ...
  }
  ```

### 6.3 用户上下文
- 使用装饰器获取当前用户信息：
  ```typescript
  @Post()
  async bookSession(
    @CurrentUser() user: JwtUser,
    @Body() body: BookSessionRequestDto,
  ) {
    // ...
  }
  ```

## 7. 错误处理策略

### 7.1 错误类型
- **业务异常**：Domain/Application层抛出特定业务异常（如 `InsufficientBalanceException`）
- **系统异常**：系统内部故障导致的异常
- **认证异常**：认证失败导致的异常
- **授权异常**：授权失败导致的异常
- **参数异常**：请求参数无效导致的异常

### 7.2 异常处理流程
1. Domain/Application层抛出特定业务异常
2. API层的全局异常过滤器捕获这些异常
3. 将异常映射到适当的HTTP状态码和错误响应格式
4. 返回给客户端

### 7.3 HTTP状态码映射
| 状态码 | 含义 | 适用场景 |
|-------|------|----------|
| 200 | OK | 成功请求 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 资源删除成功 |
| 400 | Bad Request | 参数错误 |
| 401 | Unauthorized | 认证失败 |
| 403 | Forbidden | 授权失败 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 500 | Internal Server Error | 系统内部错误 |

## 8. API文档

### 8.1 文档生成
- 使用NestJS Swagger模块自动生成OpenAPI文档
- 文档访问地址：`/api/docs`

### 8.2 文档内容
- API端点描述
- 请求/响应示例
- 参数说明
- 错误码列表
- 认证授权要求

### 8.3 文档装饰器
```typescript
@Controller('api/student/sessions')
@ApiTags('Student Sessions')
export class StudentSessionsController {
  @Post()
  @ApiOperation({ summary: 'Book a new session' })
  @ApiResponse({ status: 201, description: 'Session booked successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async bookSession(/* ... */) {
    // ...
  }
}
```

## 9. 监控与日志

### 9.1 日志记录
- 在Application services（Sagas, Commands）中注入Logger服务
- 记录关键操作的入口、出口和执行时长
- 使用结构化日志（JSON格式），便于在Datadog或ELK等工具中搜索和分析

### 9.2 API监控
- 监控API响应时间
- 监控错误率
- 监控请求量
- 监控关键业务指标

## 10. 缓存策略

### 10.1 缓存位置
- **Application Layer Queries**：对昂贵且频繁访问的查询进行缓存

### 10.2 缓存实现
- 使用`cache-manager`与Redis
- 使用装饰器简化缓存管理：
  ```typescript
  @Cacheable({ key: 'students', ttl: 300 })
  async findAllStudents(): Promise<StudentListItemDto[]> {
    // ...
  }
  ```

## 11. 代码示例

### 11.1 API Controller示例
```typescript
// src/api/controllers/admin/products.controller.ts
import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard, RolesGuard, Roles, CurrentUser } from '@shared/guards';
import { CreateProductCommand } from '@application/commands/product/create-product.command';
import { UpdateProductCommand } from '@application/commands/product/update-product.command';
import { PublishProductCommand } from '@application/commands/product/publish-product.command';
import { GetProductsQuery } from '@application/queries/product/get-products.query';
import { GetProductQuery } from '@application/queries/product/get-product.query';
import { CreateProductDto } from '@application/commands/product/dto/create-product.dto';
import { UpdateProductDto } from '@application/commands/product/dto/update-product.dto';
import { ProductFilterDto } from '@application/queries/product/dto/product-filter.dto';
import { PaginationDto } from '@shared/dto/pagination.dto';
import { SortDto } from '@shared/dto/sort.dto';

@Controller('api/admin/products')
@ApiTags('Admin Products')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AdminProductsController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly publishProductCommand: PublishProductCommand,
    private readonly getProductsQuery: GetProductsQuery,
    private readonly getProductQuery: GetProductQuery
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() createProductDto: CreateProductDto
  ) {
    return this.createProductCommand.execute({ ...createProductDto, userId: user.id });
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async findAll(
    @Query() filter: ProductFilterDto,
    @Query() pagination: PaginationDto,
    @Query() sort: SortDto
  ) {
    return this.getProductsQuery.execute({ filter, pagination, sort });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.getProductQuery.execute({ id });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string, 
    @Body() updateProductDto: UpdateProductDto
  ) {
    return this.updateProductCommand.execute({ id, ...updateProductDto });
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish product' })
  @ApiResponse({ status: 200, description: 'Product published successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async publish(@Param('id') id: string) {
    return this.publishProductCommand.execute({ id });
  }
}
```

### 11.2 Application Command示例
```typescript
// src/application/commands/product/create-product.command.ts
import { Injectable } from '@nestjs/common';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from '@domains/catalog/product/interfaces/product.interface';

@Injectable()
export class CreateProductCommand {
  constructor(private readonly productService: ProductService) {}

  async execute(input: CreateProductDto & { userId: string }): Promise<Product> {
    const { userId, ...productData } = input;
    return this.productService.create(productData, userId);
  }
}
```

### 11.3 Application Query示例
```typescript
// src/application/queries/product/get-products.query.ts
import { Injectable } from '@nestjs/common';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import { PaginationDto } from '@shared/dto/pagination.dto';
import { SortDto } from '@shared/dto/sort.dto';
import { PaginatedResult } from '@shared/types/paginated-result';
import { Product } from '@domains/catalog/product/interfaces/product.interface';

@Injectable()
export class GetProductsQuery {
  constructor(private readonly productService: ProductService) {}

  async execute(
    input: { 
      filter: ProductFilterDto; 
      pagination?: PaginationDto; 
      sort?: SortDto 
    }
  ): Promise<PaginatedResult<Product>> {
    return this.productService.search(input.filter, input.pagination, input.sort);
  }
}
```

## 12. 实施计划

### 12.1 阶段1：基础架构搭建
- 统一API模块设计
- 认证授权机制实现
- 错误处理框架搭建
- 日志监控系统集成
- Swagger文档配置

### 12.2 阶段2：Application Layer实现
- CQRS框架搭建
- Command/Query/Saga基类实现
- DTO映射机制实现
- 事务管理机制实现

### 12.3 阶段3：业务域API实现
- Catalog域API实现
- Contract域API实现
- Financial域API实现
- Placement域API实现

### 12.4 阶段4：测试与优化
- 单元测试
- 集成测试
- 性能测试
- 安全测试
- API文档完善

## 13. 结论

本API设计方案基于现有的架构设计文档，旨在建立一套标准化、可扩展、可维护、安全可靠的API体系。通过实施该方案，可以实现：

1. 清晰的分层架构，各层职责明确
2. 基于角色的API设计，提供精细化的访问控制
3. CQRS实现，优化读写性能
4. 统一的错误处理和日志记录
5. 完善的API文档和监控
6. 高效的缓存策略

该方案将确保系统的可扩展性和可维护性，为系统的长期发展奠定坚实的基础。