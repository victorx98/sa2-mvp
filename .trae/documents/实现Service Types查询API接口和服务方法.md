# 实现Service Types查询API接口和服务方法

## 1. 需求分析

需要为service types添加一个查询API接口，支持：
- 筛选功能
- 分页功能
- 排序功能

## 2. 实现方案

### 2.1 领域层实现

#### 2.1.1 接口定义
创建 `src/domains/catalog/service-type/interfaces/service-type.interface.ts` 文件，定义Service Type相关接口：
- `IServiceType` - 服务类型基本接口
- `IServiceTypeFilter` - 服务类型筛选条件接口

#### 2.1.2 DTO定义
创建 `src/domains/catalog/service-type/dto/` 目录，包含：
- `service-type-filter.dto.ts` - 服务类型筛选DTO
- `service-type-sort.dto.ts` - 服务类型排序DTO（可选，可复用现有SortDto）

#### 2.1.3 服务实现
创建 `src/domains/catalog/service-type/services/service-type.service.ts` 文件，实现：
- `search(filter: ServiceTypeFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<IServiceType>>` - 服务类型查询方法

#### 2.1.4 仓库实现
创建 `src/domains/catalog/service-type/service-type.repository.ts` 文件，实现数据库操作：
- `findMany(filter: ServiceTypeFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<ServiceType[]>` - 查询多个服务类型
- `count(filter: ServiceTypeFilterDto): Promise<number>` - 统计服务类型数量

### 2.2 应用层实现

#### 2.2.1 查询实现
创建 `src/application/queries/service-type/get-service-types.query.ts` 文件，实现应用层查询逻辑。

### 2.3 API层实现

#### 2.3.1 控制器实现
创建 `src/api/controllers/admin/service-types.controller.ts` 文件，实现API接口：
- `@Get('api/admin/service-types')` - 服务类型查询接口

## 3. 实现细节

### 3.1 筛选功能
支持按以下字段筛选：
- `code` - 服务类型编码（模糊匹配）
- `name` - 服务类型名称（模糊匹配）
- `status` - 服务类型状态（精确匹配）
- `includeDeleted` - 是否包含已删除的服务类型（默认不包含）

### 3.2 分页功能
支持：
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

### 3.3 排序功能
支持按以下字段排序：
- `code`
- `name`
- `createdAt`
- `updatedAt`

## 4. 代码规范

- 遵循项目现有的代码规范
- 使用英文+中文双语注释
- 确保没有未使用的import语句
- 使用别名路径导入模块
- 实现单元测试

## 5. 实现步骤

1. 创建领域层文件结构
2. 实现仓库层
3. 实现服务层
4. 实现应用层查询
5. 实现API控制器
6. 添加单元测试
7. 运行测试验证实现

## 6. 预期效果

- 可以通过 `/api/admin/service-types` 接口查询服务类型
- 支持通过查询参数进行筛选、分页和排序
- 返回符合预期的JSON格式数据
- 代码符合项目规范
- 单元测试通过率100%