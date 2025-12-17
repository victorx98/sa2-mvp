# 分页查询规范

## 1. 概述

本规范定义了项目中所有业务域的分页查询功能的统一入参规范和出参规范，确保系统内分页查询功能的一致性和可维护性。

## 2. 入参规范

### 2.1 基本参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 | 边界条件 |
|--------|------|------|--------|------|----------|
| page | number | 否 | 1 | 当前页码 | 最小值：1 |
| pageSize | number | 否 | 20 | 每页条数 | 最小值：1，最大值：100 |

### 2.2 参数验证规则

1. **页码验证**：
   - 若 `page` 为 `null` 或 `undefined`，使用默认值 `1`
   - 若 `page` 小于 `1`，直接返回 `400 Bad Request`
   - 若 `page` 为非数字，直接返回 `400 Bad Request`

2. **每页条数验证**：
   - 若 `pageSize` 为 `null` 或 `undefined`，使用默认值 `20`
   - 若 `pageSize` 小于 `1`，直接返回 `400 Bad Request`
   - 若 `pageSize` 大于 `100`，直接返回 `400 Bad Request`
   - 若 `pageSize` 为非数字，直接返回 `400 Bad Request`

### 2.3 入参数据传输对象 (DTO)

所有分页查询的请求参数必须继承或包含以下 `PaginationQueryDto`：

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: '当前页码，默认值：1',
    type: Number,
    minimum: 1,
    example: 1
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数，默认值：20，最大值：100',
    type: Number,
    minimum: 1,
    maximum: 100,
    example: 20
  })
  pageSize?: number = 20;
}
```


## 3. 出参规范

### 3.1 响应格式

所有分页查询的响应必须返回以下格式的 `PaginatedResult` 对象：

| 字段名 | 类型 | 描述 |
|--------|------|------|
| data | Array<T> | 数据列表 |
| total | number | 总记录数 |
| page | number | 当前页码 |
| pageSize | number | 每页条数 |
| totalPages | number | 总页数 |

### 3.2 响应数据传输对象 (DTO)

所有分页查询的响应必须使用以下 `PaginatedResponseDto`：

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '数据列表' })
  data: T[];

  @ApiProperty({ description: '总记录数', type: Number })
  total: number;

  @ApiProperty({ description: '当前页码', type: Number })
  page: number;

  @ApiProperty({ description: '每页条数', type: Number })
  pageSize: number;

  @ApiProperty({ description: '总页数', type: Number })
  totalPages: number;
}
```

### 3.3 响应示例

```json
{
  "data": [
    {
      "id": "123",
      "name": "示例数据"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

## 4. 实现规范

### 4.1 分页查询实现模式

所有业务域的分页查询必须遵循以下实现模式：

1. **控制器层**：
   - 接收分页参数和查询条件
   - 验证和转换分页参数
   - 调用查询服务
   - 返回标准化的分页响应

2. **服务层**：
   - 接收分页参数和查询条件
   - 计算 `offset` 和 `limit`
   - 调用数据访问层执行查询
   - 构造标准化的分页响应

3. **数据访问层**：
   - 接收 `limit` 和 `offset` 参数
   - 执行数据库查询
   - 返回查询结果和总记录数

### 4.2 分页参数转换

在服务层中，必须将 `page` 和 `pageSize` 转换为数据库查询所需的 `limit` 和 `offset`：

```typescript
const limit = pageSize;
const offset = (page - 1) * pageSize;
```

### 4.3 总页数计算

总页数必须使用以下公式计算：

```typescript
const totalPages = Math.ceil(total / pageSize);
```

### 4.4 实现示例

```typescript
// 服务层实现示例
async search(
  filters: any,
  paginationQuery: PaginationQuery,
  ... // 排序
): Promise<IPaginatedResult<Item>> {
  const { page, pageSize } = paginationQuery;
  
      // 参数验证
      // - 非法参数直接抛出 400（由 ValidationPipe / class-validator 负责）
      // - 合法但缺省使用默认值（由 DTO 默认值负责）
  
  // 执行查询
  ...
  
  // 计算总页数
      const totalPages = Math.ceil(total / pageSize);
  
  // 构造响应
  return {
    data: items,
    total,
        page,
        pageSize,
    totalPages
  };
}
```

## 5. 错误处理

### 5.1 参数验证错误

当分页参数不符合规范时，应返回标准的错误响应：

```json
{
  "statusCode": 400,
  "message": [
    "page must be a positive integer",
    "pageSize must be between 1 and 100"
  ],
  "error": "Bad Request"
}
```

### 5.2 数据访问错误

当分页查询过程中发生数据库访问错误时，应返回标准的服务器错误响应：

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## 6. 最佳实践

1. **使用统一的分页参数 DTO**：所有分页查询必须使用 `PaginationQueryDto` 或其扩展类
2. **统一的响应格式**：所有分页查询响应必须使用 `PaginatedResponseDto`
3. **参数验证**：在控制器层或服务层进行分页参数验证
4. **性能优化**：
   - 对频繁分页查询的字段建立索引
   - 使用 `count(*)` 或更高效的计数方式
   - 考虑使用游标分页（Cursor-based Pagination）处理大数据量场景
5. **避免深度分页**：限制最大页码或提供合理的分页策略
6. **文档化**：在 API 文档中明确说明分页参数和响应格式

## 7. 各业务域实现指南

### 7.1 Catalog 域

- 产品列表查询必须支持分页
- 服务类型列表查询必须支持分页
- 使用统一的分页参数和响应格式

### 7.2 Contract 域

- 合同列表查询必须支持分页
- 合同服务权益列表查询必须支持分页
- 使用统一的分页参数和响应格式

### 7.3 Financial 域

- 交易记录查询必须支持分页
- 发票列表查询必须支持分页
- 使用统一的分页参数和响应格式

### 7.4 Placement 域

- 推荐岗位列表查询必须支持分页
- 岗位申请记录查询必须支持分页
- 使用统一的分页参数和响应格式

### 7.5 Query 域

- 跨域查询结果必须支持分页
- 报表查询必须支持分页
- 使用统一的分页参数和响应格式

## 8. 版本控制

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2025-12-17 | Gene | 初始版本 |

## 9. 附录

### 9.1 相关类型定义

```typescript
// 分页查询参数类型
export interface IPaginationQuery {
  page: number;
  pageSize: number;
}

// 分页结果类型
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### 9.2 工具函数

```typescript
// 分页参数验证工具函数
export function validatePaginationQuery(
  paginationQuery: Partial<IPaginationQuery>
): IPaginationQuery {
  const page = Math.max(1, paginationQuery.page || 1);
  const pageSize = Math.min(100, Math.max(1, paginationQuery.pageSize || 20));
  return { page, pageSize };
}

// 分页参数转换工具函数
export function convertToLimitOffset(
  paginationQuery: IPaginationQuery
): { limit: number; offset: number } {
  const { page, pageSize } = validatePaginationQuery(paginationQuery);
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
}
```

## 10. 决策清单（待讨论）

1. **非法分页参数处理策略**：已决策为 **直接返回 400**；第2.2/4.4节已按此更新。
2. **分页响应的统一外层结构**：部分接口使用业务统一包装（例如 `{ success, data: { items, total, page, pageSize, totalPages } }`），与本规范第3.1节 `PaginatedResult`（顶层 `data` 为数组）不一致；需要明确是否允许包装层，或要求所有分页接口强制使用统一结构。
