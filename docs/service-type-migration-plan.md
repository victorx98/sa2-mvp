# ServiceType统一迁移实施方案

## 概述

本文档描述了将项目中所有serviceType统一迁移为仅使用数据表来源的实施方案。当前项目中存在两种serviceType来源：枚举类型和数据表，这种双重来源导致了数据一致性和维护性问题。

## ServiceType来源分析

### 1. 枚举类型来源

- **位置**: `/src/infrastructure/database/schema/services.schema.ts`
- **定义**: `serviceTypeEnum` 枚举
- **值**: GAP_ANALYSIS、RESUME_REVIEW、MOCK_INTERVIEW、CLASS_SESSION、INTERNAL_REFERRAL等12个服务类型
- **使用场景**: 被多个数据库表直接引用作为字段类型

### 2. 数据表来源

- **位置**: `/src/infrastructure/database/schema/service-types.schema.ts`
- **定义**: `service_types` 表
- **字段**: id、code、name、requiredEvaluation等
- **使用场景**: 部分表通过 `serviceTypeCode` 字段引用此表

## 影响范围评估

### 1. 数据库层面影响

**直接受影响的表**:
- `services` 表：使用 `serviceTypeEnum` 定义 `service_type` 字段
- `contract_service_entitlements` 表：使用 `serviceTypeEnum` 定义 `service_type` 字段
- `service_ledgers` 和 `service_ledgers_archive` 表：使用 `serviceTypeEnum` 定义 `service_type` 字段
- `service_holds` 表：使用 `serviceTypeEnum` 定义 `service_type` 字段

**间接受影响的表**:
- `mentor_prices` 表：使用 `serviceTypeCode` 字段引用 `service_types.code`
- `mentor_payable_ledgers` 表：使用 `serviceTypeCode` 字段引用 `service_types.code`
- `product_items` 表：通过 `referenceId` 字段间接关联服务类型

### 2. 应用代码层面影响

**领域模型影响**:
- **Catalog领域**: `IService` 接口使用 `ServiceType` 枚举类型
- **Contract领域**: 多个事件类型和DTO使用 `ServiceType` 枚举类型
- **Financial领域**: `SessionCompletedEvent` 和 `SessionEvaluatedEvent` 使用 `serviceTypeCode` 字段

**服务接口影响**:
- 合同服务中的 `IServiceLedgerService` 接口方法使用 `serviceType: string` 参数
- 各种DTO类（如 `RecordConsumptionDto`、`RecordAdjustmentDto`）使用 `serviceType: string` 字段

### 3. 查询和业务逻辑影响

**查询逻辑变化**:
- 当前部分表使用枚举值进行查询，迁移后需要改为关联查询或字符串比较
- 需要更新所有涉及服务类型的查询条件和索引

**业务逻辑变化**:
- 服务类型验证逻辑需要从枚举值验证改为数据库记录存在性验证
- 服务类型相关的业务规则可能需要调整

### 4. API和外部接口影响

**事件系统影响**:
- 跨领域事件中服务类型的表示方式需要统一
- 事件序列化和反序列化逻辑需要调整

**API响应影响**:
- 返回给客户端的服务类型表示需要保持一致
- API文档需要更新

## 迁移方案优势

1. **数据一致性**: 所有服务类型信息集中存储，避免枚举值与数据库记录不一致
2. **灵活性**: 可以动态添加新的服务类型，无需修改代码和部署
3. **扩展性**: 服务类型可以包含更多属性（如描述、图标、元数据等）
4. **国际化支持**: 可以轻松支持多语言服务类型名称

## 迁移方案风险

1. **性能影响**: 从枚举比较改为字符串比较或关联查询可能影响性能
2. **数据完整性**: 迁移过程中需要确保数据完整性和一致性
3. **兼容性**: 需要确保迁移过程中系统持续可用
4. **复杂度增加**: 部分业务逻辑可能变得更复杂

## 迁移策略

采用**渐进式迁移**策略，确保系统在整个迁移过程中保持稳定运行。迁移分为三个阶段：准备阶段、实施阶段和验证阶段。

## 准备阶段

### 步骤1：数据准备和验证

1. **确保service_types表数据完整性**
   ```sql
   -- 检查service_types表是否包含所有枚举值
   SELECT unnest(enum_range(NULL::serviceTypeEnum)) AS enum_value
   EXCEPT
   SELECT code FROM service_types;
   ```

2. **补充缺失的服务类型记录**
   ```sql
   -- 为任何缺失的枚举值创建记录
   INSERT INTO service_types (code, name, requiredEvaluation, created_by, updated_by)
   SELECT 
     enum_value,
     -- 首字母大写作为默认名称
     INITCAP(REPLACE(enum_value, '_', ' ')),
     false, -- 默认不需要评估
     'system',
     'system'
   FROM (
     SELECT unnest(enum_range(NULL::serviceTypeEnum)) AS enum_value
     EXCEPT
     SELECT code FROM service_types
   ) AS missing_types;
   ```

### 步骤2：创建兼容性视图和函数

1. **创建服务类型兼容性视图**
   ```sql
   -- 创建视图，提供与枚举兼容的接口
   CREATE OR REPLACE VIEW service_type_enum_view AS
   SELECT code AS service_type_value FROM service_types;
   ```

2. **创建服务类型验证函数**
   ```sql
   -- 创建函数验证服务类型是否存在
   CREATE OR REPLACE FUNCTION is_valid_service_type(service_type_code VARCHAR)
   RETURNS BOOLEAN AS $$
   BEGIN
     RETURN EXISTS (SELECT 1 FROM service_types WHERE code = service_type_code);
   END;
   $$ LANGUAGE plpgsql;
   ```

## 实施阶段

### 步骤3：数据库表结构迁移

1. **创建新表结构（使用外键引用）**
   ```sql
   -- 为每个使用serviceTypeEnum的表创建新版本
   CREATE TABLE services_new (
     -- 其他字段...
     service_type_code VARCHAR(50) NOT NULL REFERENCES service_types(code),
     -- 添加约束确保与原枚举值兼容
     CONSTRAINT chk_service_type_code 
       CHECK (is_valid_service_type(service_type_code))
   );
   ```

2. **数据迁移脚本**
   ```sql
   -- 迁移数据
   INSERT INTO services_new (SELECT *, service_type::VARCHAR AS service_type_code FROM services);
   ```

3. **切换表结构**
   ```sql
   -- 在低峰期执行切换
   BEGIN;
     ALTER TABLE services RENAME TO services_old;
     ALTER TABLE services_new RENAME TO services;
     -- 重新创建索引和约束
     CREATE INDEX idx_services_service_type ON services(service_type_code);
   COMMIT;
   ```

### 步骤4：应用代码迁移

1. **更新数据库Schema文件**
   - 修改 `services.schema.ts`：将 `serviceTypeEnum` 改为 `varchar` 引用 `service_types.code`
   - 修改其他相关schema文件：`contract-service-entitlements.schema.ts`、`service-ledgers.schema.ts` 等

2. **更新领域模型**
   - 修改 `IService` 接口：将 `serviceType: ServiceType` 改为 `serviceTypeCode: string`
   - 更新相关类型定义和验证逻辑

3. **更新服务层**
   - 修改所有使用服务类型的服务方法
   - 添加服务类型验证逻辑
   - 更新查询方法，使用关联查询替代枚举比较

4. **更新事件系统**
   - 修改事件类型定义，确保服务类型字段一致性
   - 更新事件发布和订阅逻辑

### 步骤5：API层适配

1. **更新DTO类**
   - 修改所有包含serviceType的DTO类
   - 添加服务类型验证装饰器

2. **更新控制器**
   - 修改控制器方法，处理新的服务类型格式
   - 确保API响应格式一致

## 验证阶段

### 步骤6：全面测试

1. **单元测试**
   - 更新所有涉及服务类型的单元测试
   - 确保测试覆盖率达到80%以上

2. **集成测试**
   - 测试跨领域服务流程
   - 验证事件系统完整性

3. **性能测试**
   - 比较迁移前后的查询性能
   - 优化关键查询路径

### 步骤7：灰度发布和监控

1. **灰度发布**
   - 先在测试环境全面验证
   - 生产环境分批次发布，逐步扩大范围

2. **监控和回滚计划**
   - 监控关键指标：错误率、响应时间、数据一致性
   - 准备回滚脚本，确保可以快速恢复

## 风险点和应对措施

### 风险1：数据不一致
- **应对措施**: 迁移前进行完整数据校验，迁移后进行数据一致性检查

### 风险2：性能下降
- **应对措施**: 优化查询，添加适当索引，考虑缓存热点服务类型

### 风险3：应用兼容性问题
- **应对措施**: 创建兼容层，确保新旧系统可以共存，逐步迁移

### 风险4：迁移过程中的系统中断
- **应对措施**: 采用蓝绿部署或滚动更新，确保系统持续可用

## 实施时间表

1. **准备阶段**: 2-3天
   - 数据准备和验证：1天
   - 创建兼容性视图和函数：1天
   - 测试环境验证：1天

2. **实施阶段**: 5-7天
   - 数据库表结构迁移：2天
   - 应用代码迁移：3天
   - API层适配：2天

3. **验证阶段**: 3-4天
   - 全面测试：2天
   - 灰度发布和监控：2天

## 成功标准

1. 所有服务类型引用统一使用数据表来源
2. 系统功能完整，性能不低于迁移前
3. 数据一致性得到保证
4. 可以动态添加新的服务类型而无需修改代码

## 总结

本迁移方案旨在解决项目中serviceType双重来源的问题，通过统一使用数据表来源，提高数据一致性、系统灵活性和扩展性。采用渐进式迁移策略，确保系统在整个迁移过程中保持稳定运行。通过详细的实施步骤、风险控制措施和验证计划，为项目的顺利迁移提供全面指导。