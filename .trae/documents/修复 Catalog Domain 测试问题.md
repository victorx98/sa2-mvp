# 修复 Catalog Domain 测试问题

## 1. 删除无效的测试数据脚本

**问题**：`scripts/setup-test-data.ts` 脚本存在导入错误，无法正常运行，且单元测试不依赖此脚本创建的数据。

**修复方案**：删除 `scripts/setup-test-data.ts` 文件。

**理由**：
- 脚本无法导入 `db` 和 `ServiceStatus`
- 单元测试使用模拟数据，不依赖此脚本
- 集成测试可以直接创建测试数据

## 2. 修复 ProductService 单元测试

**问题**：ProductService 单元测试中的模拟数据库实现有问题，导致部分测试失败。

**修复方案**：
- 确保所有测试用例的模拟数据库调用返回正确的格式
- 修复 `getOrderBy` 方法的模拟
- 确保事务处理的模拟正确

## 3. 修复集成测试

**问题**：集成测试存在超时和导入问题。

**修复方案**：
- 确保所有导入路径正确
- 增加测试超时时间
- 优化测试数据清理逻辑
- 确保应用程序能正确启动和关闭

## 4. 运行测试验证修复效果

**修复方案**：
- 运行单元测试：`npm run test -- --testPathPatterns=src/domains/catalog/product/services/product.service.spec.ts`
- 运行集成测试：`npm run test -- --testPathPatterns=test/domains/catalog/product.service.e2e-spec.ts`
- 验证所有测试通过

## 5. 验证业务功能正确性

**修复方案**：
- 确保 ProductService 的所有方法都有对应的测试
- 确保 ServiceTypeService 的所有方法都有对应的测试
- 验证测试覆盖率

## 6. 修复应用代码中的导入问题

**问题**：`src/application/commands/booking/book-session.command.ts` 中的导入路径错误。

**修复方案**：
- 修复 `FEISHU_DEFAULT_HOST_USER_ID` 的导入路径
- 确保所有导入都使用正确的别名

## 7. 修复 Jest 配置

**问题**：Jest 配置中缺少 `@telemetry` 别名映射。

**修复方案**：
- 确保 Jest 配置中的别名映射与 tsconfig.json 一致
- 添加缺失的别名映射

通过以上步骤，我将修复 Catalog Domain 中的测试问题，确保业务功能的正确性以及代码的正确性。