# Placement域与Services域关联整改方案

## 0. 决策清单
- D1：采用共享主键方案（`job_applications.id` == `service_references.id`），不新增 `service_reference_id` 字段
- D2：新增集成事件 `placement.application.submitted`，事件 payload 需包含 Service Registry 登记所需字段，避免 Services 域反查 Placement 表
  - `id`：job_application.id（共享主键）
  - `service_type`：固定为 `job_application`
  - `student_user_id`：job_applications.studentId
  - `provider_user_id`：服务提供者用户ID（优先使用导师/推荐人/操作者，保证为 UUID 字符串）
  - `consumed_units`：固定为 1
  - `unit_type`：固定为 `count`
  - `completed_time`：提交时间（以状态进入 submitted 的时间为准）
  - `title`：可选（建议传岗位标题，便于对账）

## 1. 整改目标
- 将placement域的job_applications表通过services域的service_references表纳入统一管理体系
- 保持各域独立性和内聚性，不违反DDD领域边界原则
- 确保跨域数据一致性

## 2. 核心问题
- placement域缺乏与services域的标准化关联机制
- 服务完成记录分散，无法统一管理和查询
- 跨域数据一致性难以保障

## 3. 解决方案

### 3.1 共享主键设计
- 使用共享主键技术，job_applications.id作为service_references.id
- 避免额外外键依赖，保持各域独立性

### 3.2 事件驱动机制
- 新增`placement.application.submitted`事件，当job_application状态达到提交状态时发布事件
- Services域监听该事件，使用job_application.id作为service_reference.id创建记录

### 3.3 数据模型扩展
- 移除job_applications表的`service_reference_id`字段（通过id关联）

### 3.4 业务逻辑优化
- JobApplicationService增强状态更新逻辑，检测提交状态并发布事件
- ServiceRegistryService使用共享主键，确保1:1关联

## 4. 实施步骤

### 4.1 阶段1：基础设施准备
1. 更新service-references.schema.ts，添加源跟踪字段
2. 确认job_applications不新增service_reference_id字段（继续使用共享主键）
3. 新增placement-application-submitted事件定义（含payload字段）

### 4.2 阶段2：事件处理实现
1. 实现PlacementApplicationSubmittedListener
2. 增强JobApplicationService的updateApplicationStatus方法
3. 扩展ServiceRegistryService的幂等性处理

### 4.3 阶段3：测试验证
1. 单元测试各组件
2. 验证事件重复投递不会导致重复登记
3. 验证数据一致性

## 5. 验证方法
- 检查job_application提交后是否生成对应service_reference记录
- 验证重复事件不会导致重复注册
- 确认各域边界保持清晰