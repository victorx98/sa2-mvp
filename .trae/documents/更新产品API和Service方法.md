## 1. 问题分析

- **当前情况**：
  - `findOne` 方法返回 `IProductDetail`，已包含 `items` 字段
  - `search` 方法返回 `PaginatedResult<IProduct>`，`IProduct` 接口不包含 `items` 字段
  - 控制器使用 `field` 和 `order` 作为排序参数

- **需求**：
  - `/api/admin/products` 返回的产品数据需要包含 `product items`
  - 将查询参数中的 `field` 改为 `orderField`
  - 重命名 `order` 字段

## 2. 修改计划

### 2.1 更新接口定义

1. **更新 `IProduct` 接口**：
   - 路径：`src/domains/catalog/product/interfaces/product.interface.ts`
   - 添加 `items` 字段，类型为 `IProductItem[]`

2. **更新 `SortDto` 接口**：
   - 路径：`src/domains/catalog/common/dto/sort.dto.ts`
   - 将 `field` 改为 `orderField`
   - 将 `order` 改为 `orderDirection`

### 2.2 更新服务实现

1. **修改 `search` 方法**：
   - 路径：`src/domains/catalog/product/services/product.service.ts`
   - 为每个产品获取 `items` 数据
   - 使用 `Promise.all` 批量查询产品项，提高性能
   - 返回的产品包含完整的 `items` 字段

### 2.3 更新控制器

1. **修改 `findAll` 方法**：
   - 路径：`src/api/controllers/admin/products.controller.ts`
   - 将排序参数 `field` 改为 `orderField`
   - 将 `order` 改为 `orderDirection`

### 2.4 更新查询服务

1. **检查 `GetProductsQuery`**：
   - 路径：`src/application/queries/product/get-products.query.ts`
   - 确保参数传递正确

### 2.5 更新Swagger文档

1. **更新API文档**：
   - 确保生成的Swagger文档反映了新的参数名称

## 3. 实现细节

### 3.1 更新接口定义

- **`IProduct` 接口**：添加 `items?: IProductItem[]` 字段
- **`SortDto` 接口**：
  ```typescript
  export class SortDto {
    @IsOptional()
    @IsString()
    orderField?: string;
    
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    orderDirection?: string;
  }
  ```

### 3.2 修改 `search` 方法

- 使用 `Promise.all` 批量查询产品项：
  ```typescript
  const productsWithItems = await Promise.all(
    data.map(async (product) => {
      const items = await this.db
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, product.id))
        .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);
      
      return {
        ...this.mapToProductInterface(product),
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          serviceTypeId: item.serviceTypeId,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      };
    })
  );
  ```

### 3.3 修改控制器

- 更新参数提取逻辑：
  ```typescript
  const sort = {
    orderField: query.orderField,
    orderDirection: query.orderDirection
  } as SortDto;
  ```

## 4. 预期结果

- `/api/admin/products` 返回的产品数据包含完整的 `items` 字段
- 查询参数使用 `orderField` 和 `orderDirection` 代替 `field` 和 `order`
- 保持向后兼容性，确保现有API调用不会立即失败
- 生成的Swagger文档反映了新的参数名称

## 5. 测试计划

1. **单元测试**：测试 `search` 方法返回的产品包含 `items`
2. **集成测试**：测试 `/api/admin/products` API 返回正确的数据格式
3. **参数测试**：测试使用新的排序参数名称能够正确排序
4. **性能测试**：确保批量查询产品项不会导致性能问题

## 6. 风险评估

- **性能风险**：批量查询产品项可能导致性能问题，使用 `Promise.all` 可以缓解
- **兼容性风险**：更改参数名称可能影响现有客户端，建议添加向后兼容处理
- **接口一致性**：确保所有返回产品的方法都返回一致的数据结构

通过以上修改，可以实现需求，确保 `/api/admin/products` 返回的产品数据包含 `product items`，并使用新的排序参数名称。