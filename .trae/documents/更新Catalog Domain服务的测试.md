## 1. 问题分析

- **当前情况**：
  - Catalog Domain 包含 ServiceTypeService 和 ProductService 两个服务
  - ServiceTypeService 提供了 search 方法
  - ProductService 提供了 11 个方法
  - 现有测试覆盖率很低，甚至没有找到测试文件
  - 缺少集成测试
  - 没有合适的测试数据

- **需求**：
  - 更新单元测试和集成测试
  - 确保测试覆盖率
  - 确保测试代码的正确性
  - 使用 supabase mcp 工具设置正确的测试数据
  - 确保测试数据符合项目中的数据约束

## 2. 测试计划

### 2.1 单元测试

#### 2.1.1 ServiceTypeService 单元测试

**路径**：`src/domains/catalog/service-type/services/service-type.service.spec.ts`

**测试方法**：
1. `search` 方法：
   - 测试正常搜索，返回分页结果
   - 测试无数据时返回空结果
   - 测试不同筛选条件
   - 测试不同排序参数
   - 测试不同分页参数

#### 2.1.2 ProductService 单元测试

**路径**：`src/domains/catalog/product/services/product.service.spec.ts`

**测试方法**：
1. `create` 方法：
   - 测试正常创建产品
   - 测试创建产品时添加产品项
   - 测试创建产品时的验证

2. `update` 方法：
   - 测试正常更新产品
   - 测试添加产品项
   - 测试移除产品项
   - 测试排序产品项

3. `search` 方法：
   - 测试正常搜索，返回包含产品项的结果
   - 测试不同筛选条件
   - 测试不同排序参数
   - 测试不同分页参数

4. `findOne` 方法：
   - 测试根据ID查找产品
   - 测试根据Code查找产品
   - 测试查找不存在的产品

5. `updateStatus` 方法：
   - 测试更新产品状态
   - 测试无效的状态转换

6. `createSnapshot` 方法：
   - 测试创建产品快照

### 2.2 集成测试

**路径**：`test/domains/catalog/product.service.e2e-spec.ts`

**测试场景**：
1. 产品完整生命周期：
   - 创建产品
   - 更新产品
   - 添加产品项
   - 移除产品项
   - 排序产品项
   - 更新产品状态
   - 创建产品快照

2. 批量操作：
   - 批量创建产品
   - 批量查询产品
   - 批量更新产品

### 2.3 测试数据设置

1. **创建测试数据脚本**：
   - 路径：`scripts/setup-test-data.ts`
   - 使用 supabase mcp 工具创建测试数据
   - 确保测试数据符合项目中的数据约束

2. **测试数据内容**：
   - 服务类型数据
   - 产品数据
   - 产品项数据

### 2.4 测试覆盖率目标

- **单元测试覆盖率**：
  - ServiceTypeService：100%
  - ProductService：100%

- **集成测试覆盖率**：
  - 覆盖主要业务流程
  - 覆盖所有服务方法

## 3. 实现步骤

### 3.1 创建测试数据脚本

1. **创建脚本**：`scripts/setup-test-data.ts`
2. **使用 supabase mcp 工具**：连接数据库，创建测试数据
3. **数据类型**：
   - 服务类型（ServiceType）：创建 5 个 ACTIVE 状态的服务类型
   - 产品（Product）：创建 3 个不同状态的产品
   - 产品项（ProductItem）：为每个产品添加 2-5 个产品项

### 3.2 更新单元测试

1. **ServiceTypeService 单元测试**：
   - 模拟 ServiceTypeRepository
   - 测试各种情况

2. **ProductService 单元测试**：
   - 模拟数据库连接
   - 测试各种情况

### 3.3 创建集成测试

1. **设置测试环境**：
   - 使用 TestDatabaseHelper 管理测试数据库连接
   - 测试前清理数据
   - 测试后清理数据

2. **实现测试场景**：
   - 产品完整生命周期
   - 批量操作

### 3.4 运行测试

1. **运行单元测试**：
   ```bash
   npm run test -- --testPathPatterns=src/domains/catalog
   ```

2. **运行集成测试**：
   ```bash
   npm run test -- --testPathPatterns=test/domains/catalog
   ```

3. **检查测试覆盖率**：
   ```bash
   npm run test:cov -- --testPathPatterns=src/domains/catalog
   ```

## 4. 预期结果

- ✅ 所有单元测试通过
- ✅ 所有集成测试通过
- ✅ 测试覆盖率达到 100%
- ✅ 测试数据符合项目中的数据约束
- ✅ 测试代码结构清晰，易于维护

## 5. 风险评估

- **数据冲突**：使用独立的测试数据库，避免影响生产数据
- **测试环境问题**：确保测试环境配置正确
- **测试数据不一致**：使用脚本管理测试数据，确保每次测试使用相同的测试数据
- **性能问题**：优化测试代码，避免长时间运行

通过以上测试计划，我将确保 Catalog Domain 服务的测试覆盖率和测试代码的正确性，为项目提供可靠的测试保障。