# 合并产品项管理API到产品更新API

## 1. 需求分析

需要将以下三个API接口的功能合并到`/api/admin/products/:id`的API接口中：
- `DELETE /api/admin/products/items/:itemId` - 删除产品项
- `PATCH /api/admin/products/items/sort` - 更新产品项排序
- `POST /api/admin/products/:id/items` - 添加产品项

## 2. 实现方案

### 2.1 DTO扩展

扩展`UpdateProductDto`，添加产品项相关的操作字段：

```typescript
export class UpdateProductDto {
  // 现有字段...
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddProductItemDto)
  addItems?: AddProductItemDto[]; // 添加产品项
  
  @IsOptional()
  @IsArray()
  @IsUUID({ each: true })
  removeItems?: string[]; // 删除产品项ID数组
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductItemSortDto)
  sortItems?: ProductItemSortDto[]; // 更新产品项排序
}

class ProductItemSortDto {
  @IsNotEmpty()
  @IsUUID()
  itemId: string;
  
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}
```

### 2.2 服务层实现

更新`ProductService.update()`方法，添加产品项相关的操作逻辑：

1. 如果请求体中包含`addItems`字段，则添加产品项
2. 如果请求体中包含`removeItems`字段，则删除产品项
3. 如果请求体中包含`sortItems`字段，则更新产品项排序
4. 使用事务确保所有操作的原子性

### 2.3 应用层实现

更新`UpdateProductCommand.execute()`方法，支持处理产品项相关的操作：

- 调用`ProductService.update()`方法，传递包含产品项操作的更新DTO

### 2.4 API层实现

1. 保留`@Patch(':id')`路由，用于处理产品基本信息和产品项的更新
2. 删除以下路由：
   - `@Delete('items/:itemId')`
   - `@Patch('items/sort')`
   - `@Post(':id/items')`

## 3. 实现步骤

1. 扩展`UpdateProductDto`，添加产品项操作字段
2. 创建`ProductItemSortDto`用于产品项排序
3. 更新`ProductService.update()`方法，添加产品项操作逻辑
4. 更新`UpdateProductCommand.execute()`方法，支持处理产品项操作
5. 更新`AdminProductsController`，移除旧的产品项操作路由
6. 编写单元测试，验证合并后的功能
7. 运行测试，确保实现正确

## 4. 优势

- 减少API请求次数，提高性能
- 简化API接口设计，降低客户端复杂度
- 确保产品基本信息和产品项更新的原子性
- 更好地符合RESTful API设计原则，将相关资源的操作合并到同一个端点

## 5. 注意事项

- 需要确保所有产品项操作都在同一个事务中执行，以保证数据一致性
- 需要验证产品项操作的合法性，如产品项是否属于指定产品
- 需要保持向后兼容性，确保现有客户端不会受到影响
- 需要更新API文档，说明合并后的API用法