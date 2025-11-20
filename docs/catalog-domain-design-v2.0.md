# Catalog Domain 设计文档

## 1. 领域概览

Catalog 领域负责管理平台的产品目录体系，采用简化设计只包含产品(Product)、产品项(ProductItem)和服务类型(ServiceType)三个核心概念。该领域为平台提供标准化的产品定义、灵活的产品组合能力和完整的产品生命周期管理功能。

## 2. 核心概念

### 2.1 产品 (Product)

- **定义**: 平台提供的可销售单元，由服务类型的数量组成
- **关键特性**: 包含价格、目标用户群等属性
- **状态管理**: 支持草稿(DRAFT)、激活(ACTIVE)、停用(INACTIVE)、删除(DELETED)状态
- **产品项**: 通过product_items记录包含的各类服务类型及其数量

### 2.2 产品项 (ProductItem)

- **定义**: 产品中各类服务类型的数量记录
- **关键特性**: 由productId、serviceTypeId、quantity和sortOrder组成
- **组合规则**: 一个产品可包含多个不同服务类型的产品项，每项记录特定服务类型的使用数量
- **排序功能**: 通过sortOrder控制产品项的显示顺序

### 2.3 服务类型 (ServiceType)

- **定义**: 服务的分类标准，用于管理服务的基本属性和行为
- **配置功能**: 包含基本配置和行为特性
- **状态管理**: 支持激活(ACTIVE)等状态

## 3. 实体关系模型

### 3.1 数据表关系

```
service_types ────────┐
        ▲             │
        │             │
        │             │
        └─────────────┼───────────► product_items
                      │
                      │
                      ▼
                  products
```

### 3.2 核心实体属性

#### Products
- **基本信息**: id, name, code, description, coverImage
- **销售属性**: price, currency, targetUserPersona, marketingLabels
- **状态管理**: status, publishedAt, unpublishedAt
- **元数据**: metadata (features, faqs, deliverables, duration, prerequisites)

#### Product Items
- **关联信息**: productId, serviceTypeId
- **数量记录**: quantity
- **排序功能**: sortOrder

#### Service Types
- **基本信息**: id, code, name, description
- **状态管理**: status

### 3.3 详细表结构设计

#### 3.3.1 service_types表

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | 服务类型ID |
| `code` | `VARCHAR(50)` | `NOT NULL` | - | 服务类型编码（与status字段组成复合唯一约束） |
| `name` | `VARCHAR(255)` | `NOT NULL` | - | 服务类型名称 |
| `description` | `TEXT` | `NULL` | - | 服务类型描述 |
| `status` | `VARCHAR(20)` | `NOT NULL` | 'ACTIVE' | 服务类型状态（与code字段组成复合唯一约束） |
| `created_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 更新时间（通过触发器自动更新） |

**唯一约束**: code 必须唯一，确保服务类型编码在整个系统中不重复

#### 3.3.2 products表

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | 产品ID |
| `name` | `VARCHAR(255)` | `NOT NULL` | - | 产品名称 |
| `code` | `VARCHAR(100)` | `UNIQUE NOT NULL` | - | 产品编码 |
| `description` | `TEXT` | `NULL` | - | 产品描述 |
| `cover_image` | `VARCHAR(500)` | `NULL` | - | 封面图片URL |
| `price` | `DECIMAL(12,2)` | `NOT NULL CHECK (price > 0)` | - | 产品价格 |
| `currency` | `VARCHAR(3)` | `NOT NULL` | 'CNY' | 货币类型 |
| `target_user_persona` | `TEXT[]` | `NULL` | - | 目标用户画像数组 |
| `marketing_labels` | `TEXT[]` | `NULL` | - | 营销标签数组 |
| `status` | `VARCHAR(20)` | `NOT NULL` | 'DRAFT' | 产品状态(DRAFT/ACTIVE/INACTIVE/DELETED) |
| `published_at` | `TIMESTAMP` | `NULL` | - | 发布时间 |
| `unpublished_at` | `TIMESTAMP` | `NULL` | - | 下线时间 |
| `metadata` | `JSONB` | `NULL` | - | 元数据(JSON格式，包含features、faqs等) |
| `created_by` | `UUID` | `NULL` | - | 创建者ID |
| `updated_by` | `UUID` | `NULL` | - | 更新者ID |
| `created_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 更新时间（通过触发器自动更新） |
| `deleted_at` | `TIMESTAMP` | `NULL` | - | 软删除时间 |

#### 3.3.3 product_items表

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | 产品项ID |
| `product_id` | `UUID` | `NOT NULL REFERENCES products(id) ON DELETE CASCADE` | - | 关联的产品ID |
| `service_type_id` | `UUID` | `NOT NULL REFERENCES service_types(id)` | - | 关联的服务类型ID |
| `quantity` | `INTEGER` | `NOT NULL CHECK (quantity > 0)` | - | 服务类型的数量 |
| `sort_order` | `INTEGER` | `NOT NULL` | 0 | 排序序号 |
| `created_by` | `UUID` | `NULL` | - | 创建者ID |
| `updated_by` | `UUID` | `NULL` | - | 更新者ID |
| `created_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | `CURRENT_TIMESTAMP` | 更新时间（通过触发器自动更新） |
| | | `UNIQUE(product_id, service_type_id)` | - | 确保同一产品中服务类型不重复 |

### 3.3.4 PostgreSQL创建表SQL语句

#### 创建service_types表
```sql
CREATE TABLE IF NOT EXISTS service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 唯一约束
    CONSTRAINT unique_service_type_code UNIQUE (code)
);

-- 创建触发器函数，自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_service_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_service_types_updated_at_trigger
BEFORE UPDATE ON service_types
FOR EACH ROW EXECUTE FUNCTION update_service_types_updated_at();
```

#### 创建products表
```sql
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image VARCHAR(500),
    price DECIMAL(12,2) NOT NULL CHECK (price > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
    target_user_persona TEXT[],
    marketing_labels TEXT[],
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMP,
    unpublished_at TIMESTAMP,
    metadata JSONB,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT unique_product_code UNIQUE (code)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- 创建触发器函数，自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_products_updated_at_trigger
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();
```

#### 创建product_items表
```sql
CREATE TABLE IF NOT EXISTS product_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    service_type_id UUID NOT NULL REFERENCES service_types(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_product_service_type UNIQUE (product_id, service_type_id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON product_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_items_service_type_id ON product_items(service_type_id);
CREATE INDEX IF NOT EXISTS idx_product_items_sort_order ON product_items(sort_order);

-- 创建触发器函数，自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_product_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_product_items_updated_at_trigger
BEFORE UPDATE ON product_items
FOR EACH ROW EXECUTE FUNCTION update_product_items_updated_at();
```

## 4. 业务规则

### 4.1 产品生命周期规则
- **草稿状态**: 仅允许在DRAFT状态下修改产品内容和产品项
- **激活规则**: 产品必须至少包含一个产品项才能激活
- **删除限制**: 已激活产品需先停用(INACTIVE)才能删除
- **数量约束**: 产品价格必须为正数

### 4.2 产品项规则
- **唯一性约束**: 同一产品中不能包含重复的serviceTypeId
- **一致性保障**: 添加产品项时需开启事务，确保数据一致性
- **排序管理**: 支持批量更新产品项的显示顺序

### 4.3 服务行为规则
- **服务规则**: 服务类型可关联到产品项，支持对不同服务类型进行组合配置

## 5. 数据流转流程

### 5.1 产品创建流程
1. **创建草稿产品**: 设置基本信息、价格、目标用户等
2. **添加产品项**: 添加服务类型ID(serviceTypeId)到产品中，设置使用数量
3. **调整排序**: 设置产品项的显示顺序
4. **发布产品**: 将产品状态从DRAFT改为ACTIVE
5. **管理生命周期**: 后续可根据需要停用或删除产品

### 5.2 服务类型管理流程
1. **创建服务类型**: 设置基本信息（code、name）、配置属性和状态
2. **更新服务类型**: 根据业务需求调整服务类型配置和状态

## 6. 关键功能模块划分

### 6.1 Product Module
- **产品生命周期管理**: 创建、更新、发布、停用、删除产品
- **产品项管理**: 添加、删除、调整产品项顺序
- **产品查询**: 支持按状态、关键词、目标用户等条件查询产品
- **产品详情**: 获取产品完整信息，包括关联的产品项及其详情

### 6.2 Service Type Module
- **服务类型管理**: 创建、更新、删除、查询服务类型
- **会议配置**: 管理服务类型的会议需求设置
- **状态管理**: 控制服务类型的启用状态

## 7. 接口定义

### 7.1 Product Service Interface

```typescript
interface IProductService {
  // 产品生命周期管理
  create(dto: CreateProductDto): Promise<IProduct>;
  update(id: string, dto: UpdateProductDto): Promise<IProduct>;
  activate(id: string): Promise<IProduct>; // 将产品状态从DRAFT改为ACTIVE
  deactivate(id: string): Promise<IProduct>; // 将产品状态从ACTIVE改为INACTIVE
  delete(id: string): Promise<void>;
  
  // 产品项管理
  addItem(productId: string, dto: AddProductItemDto): Promise<void>; // dto包含serviceTypeId和quantity
  removeItem(productId: string, itemId: string): Promise<void>;
  updateItemSortOrder(productId: string, items: Array<{ itemId: string; sortOrder: number }>): Promise<void>;
  
  // 查询功能
  search(filter: ProductFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<IProduct>>;
  findOne(where: FindOneProductDto): Promise<IProductDetail | null>;
}
```

### 7.2 Service Type Service Interface

```typescript
interface IServiceTypeService {
  // 服务类型管理
  // CreateServiceTypeDto 应包含: code(必填), name(必填), description(可选), 
  // status(可选，默认'ACTIVE')等字段
  create(dto: CreateServiceTypeDto): Promise<IServiceType>;
  
  // UpdateServiceTypeDto 应包含可选的更新字段，注意code字段在创建后通常不应修改
  // 可选更新字段：name, description, status
  update(id: string, dto: UpdateServiceTypeDto): Promise<IServiceType>;
  delete(id: string): Promise<void>;
  
  // 查询功能
  findOne(id: string): Promise<IServiceType | null>;
  findById(id: string): Promise<IServiceType>;
  search(pagination?: PaginationDto): Promise<PaginatedResult<IServiceType>>;
}
```

## 8. 技术实现要点

- **数据访问**: 使用Drizzle ORM进行数据库操作，采用事务确保数据一致性
- **状态管理**: 严格的状态机控制，确保实体状态转换符合业务规则
- **关联完整性**: 通过外键约束和业务逻辑验证确保实体间关联的完整性
- **查询优化**: 为常用查询条件建立索引，支持复杂查询和分页
- **模块化设计**: 采用DDD风格的模块化设计，领域边界清晰，职责单一

## 9. 待决策项

> 本章节记录设计中尚未确定的决策点，需要在实现过程中逐步明确

### 9.1 接口定义决策

#### D01: IProductDetail接口的定义
- **问题**: `IProductDetail`接口需要包含哪些字段？是否应该包含完整的items详情？
- **影响范围**: ProductService.findOne()方法的返回类型
- **决策**: **选项1** - 只包含基础信息+items数组
  - `IProductDetail`继承自`IProduct`并添加`items`属性
  - `items`数组仅包含product_items表字段: id, productId, serviceTypeId, quantity, createdAt, updatedAt
  - **不**包含serviceType的详细信息（保持接口简洁，按需查询）
- **理由**: 保持接口简洁，避免过度获取数据；serviceType详情可以通过单独的查询获取
- **决策状态**: ✅ 已确定（2025-11-19）
- **相关代码**: `src/domains/catalog/product/services/product.service.ts:373`

#### D02: IProductItem接口的定义
- **问题**: `IProductItem`接口应该包含哪些字段？是否需要包含service_type的详细信息？
- **影响范围**: ProductItem的数据传输和验证逻辑
- **决策**: **选项2** - 仅包含业务字段
  - 必需字段：id, serviceTypeId, quantity
  - 可选字段：productId(查询时), sortOrder(排序), createdAt, updatedAt(审计)
  - **不**包含：createdBy, updatedBy(审计字段不在接口层暴露)
  - **不**包含serviceType详细信息（按需查询）
- **理由**: 接口聚焦于业务核心字段，避免冗余信息；审计字段不应暴露给前端
- **依赖关系**: 依赖D03决策，如需要sortOrder则需在数据库添加相应字段
- **决策状态**: ✅ 已确定（2025-11-19）
- **相关代码**: `src/domains/catalog/product/services/product.service.ts:548,574`

#### D03: 产品项排序机制
- **问题**: 产品项(product_items)是否需要sort_order字段来支持自定义排序？
  - 选项A: 添加sort_order字段，支持任意排序（需修改schema）
  - 选项B: 使用created_at字段排序，按创建时间排序（无需修改schema）
- **影响范围**: product_items表结构、updateItemSortOrder方法实现
- **决策**: **选项A** - 添加sort_order字段
  - 在`product_items`表中添加`sort_order`字段（INTEGER类型，NOT NULL，默认值0）
  - 实现`updateItemSortOrder`方法，支持批量更新排序
  - 产品项排序规则：
    - 数值小的排在前面
    - 支持负数、0、正数
    - 相同sort_order时按created_at排序
- **理由**: 支持灵活的产品项展示顺序，方便运营调整展示逻辑
- **实施步骤**:
  1. 修改数据库schema，添加sort_order字段
  2. 执行migration更新数据库
  3. 实现updateItemSortOrder方法的实际逻辑
- **决策状态**: ✅ 已确定（2025-11-19）
- **相关代码**: `src/domains/catalog/product/services/product.service.ts:258`

### 9.2 数据库字段决策

#### D04: 已发布状态检查机制
- **问题**: 检查产品是否可编辑应该使用哪个字段？
  - 选项A: 使用`status`字段（DRAFT状态可编辑）
  - 选项B: 使用`published_at`字段（published_at为null可编辑）
  - 选项C: 同时使用两个字段进行双重检查
- **影响范围**: ProductService.update()、addItem()、removeItem()等业务逻辑
- **决策**: **选项A** - 使用status字段
  - **可编辑条件**: `product.status === ProductStatus.DRAFT`
  - **已发布条件**: `product.status === ProductStatus.ACTIVE`
  - **已停用条件**: `product.status === ProductStatus.INACTIVE`
  - **一致性要求**: 统一所有业务方法使用status字段检查，移除published_at的检查逻辑
  - 注意：`published_at`字段仅用于记录发布时间，不作为业务逻辑判断依据
- **理由**:
  - 符合DDD状态机思想，状态转换明确
  - 避免字段间的不一致（如status=DRAFT但publishedAt有值）
  - 代码简洁，易于理解和维护
- **实施步骤**:
  1. 修改ProductService.update()方法，使用status字段检查
  2. 统一addItem()、removeItem()等业务方法的检查逻辑
- **决策状态**: ✅ 已确定（2025-11-19）
- **相关代码**: `src/domains/catalog/product/services/product.service.ts:131`

### 9.3 API兼容性决策

#### D05: 不存在的字段处理方式
- **问题**: 对于接口定义中有但数据库不存在的字段（如validityDays、sortOrder、scheduledPublishAt），应该如何处理？
  - 选项A: 从接口定义中移除这些字段，保持接口与数据库一致
  - 选项B: 在mapToProductInterface中返回undefined或默认值，保留API兼容性
  - 选项C: 在数据库中添加这些字段，实现完整功能
- **影响范围**: IProduct接口定义、mapToProductInterface方法
- **决策**: **选项A** - 从接口移除
  - **移除字段**: validityDays, scheduledPublishAt（sortOrder已通过D03决策添加）
  - **处理方式**: 从IProduct接口定义中完全移除这些字段
  - **理由**: 保持接口与数据库的完全一致性，避免混淆和误解
  - **实施步骤**:
    1. 从IProduct接口移除validityDays, scheduledPublishAt字段
    2. 更新mapToProductInterface方法，移除对这些字段的处理
    3. 更新相关DTO（如CreateProductDto, UpdateProductDto），移除相应字段
- **决策状态**: ✅ 已确定（2025-11-19）
- **相关代码**: `src/domains/catalog/product/services/product.service.ts:612,616,618`

## 10. 总结

简化后的Catalog领域设计保留了核心的产品管理功能，同时移除了Service和Service Package的复杂层级结构，使整个系统更加简洁直观。产品被明确定义为由服务类型的数量组成的可销售单元，通过ProductItem表记录产品中包含的各类服务类型及其数量。这种设计可以实现灵活的产品配置能力，同时降低系统的维护复杂度。

**补充说明**: 本设计文档将根据第9章节的决策结果持续更新，所有接口定义和实现细节将以最终决策为准。