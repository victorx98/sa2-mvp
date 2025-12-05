## 问题分析

根据错误信息和代码分析，`/api/admin/products` API 调用失败，原因是 `validateProductItemReferences` 方法抛出了 `SERVICE_TYPE_NOT_FOUND` 异常。

### 错误原因

1. **示例数据中的 serviceTypeId 不存在**：示例数据中使用的 UUID（如 `550e8400-e29b-41d4-a716-446655440000`）在 `serviceTypes` 表中不存在
2. **服务类型必须处于 ACTIVE 状态**：即使 serviceTypeId 存在，它的 `status` 字段必须是 `ACTIVE`
3. **UUID 格式验证**：serviceTypeId 必须是有效的 UUID 格式

### 解决方案

以下是获取有效 `serviceTypeId` 并修复示例数据的完整方案：

## 方案一：通过 API 获取有效 serviceTypeId

### 1. 获取所有服务类型

使用以下命令调用 `/api/admin/service-types` 接口，获取所有 ACTIVE 状态的服务类型：

```bash
# 使用 curl 调用 API
export TOKEN="<your_admin_token>"
curl -X GET "http://localhost:3000/api/admin/service-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 2. 从响应中提取有效 serviceTypeId

从 API 响应中选择 `status` 为 `ACTIVE` 的服务类型，提取它们的 `id` 作为有效的 `serviceTypeId`。

## 方案二：直接查询数据库

### 1. 使用 drizzle-kit studio 查看数据

项目中配置了 drizzle-kit，你可以使用以下命令启动数据库可视化工具：

```bash
npm run db:studio
```

然后在浏览器中访问显示的 URL，查询 `serviceTypes` 表，获取 ACTIVE 状态的服务类型 ID。

### 2. 使用 psql 命令行工具

如果直接访问数据库，可以使用以下 psql 命令：

```sql
-- 查询所有 ACTIVE 状态的服务类型
SELECT id, name, code, status FROM service_types WHERE status = 'ACTIVE';
```

## 方案三：创建新的服务类型

如果数据库中没有 ACTIVE 状态的服务类型，你需要先创建一些：

### 1. 检查是否存在创建服务类型的 API

查看代码库中是否存在创建服务类型的 API 端点：

```bash
grep -r "POST.*service-type" /home/gene/github/sa2-mvp/src/api/
```

### 2. 如果存在 API，使用 curl 创建服务类型

```bash
export TOKEN="<your_admin_token>"
curl -X POST "http://localhost:3000/api/admin/service-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "留学咨询服务", "code": "CONSULT-001", "status": "ACTIVE"}'
```

### 3. 如果不存在 API，直接插入数据库

使用 drizzle-kit studio 或 psql 直接插入服务类型：

```sql
INSERT INTO service_types (id, name, code, status, created_at, updated_at) 
VALUES 
  (gen_random_uuid(), '留学咨询服务', 'CONSULT-001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), '文书撰写服务', 'ESSAY-001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), '签证申请服务', 'VISA-001', 'ACTIVE', NOW(), NOW());
```

## 修复后的示例数据

使用从数据库中获取的有效 serviceTypeId，更新示例数据：

```json
{
  "name": "留学申请全程服务",
  "code": "SA-FULL-2024",
  "description": "提供全方位的留学申请服务，包括选校、文书、签证等",
  "coverImage": "https://example.com/cover.jpg",
  "targetUserPersonas": ["undergraduate", "graduate", "working"],
  "price": 12999.00,
  "currency": "CNY",
  "marketingLabels": ["hot", "recommended"],
  "metadata": {
    "features": ["全程服务", "专业指导", "一对一咨询"]
  },
  "items": [
    {
      "serviceTypeId": "<有效_serviceTypeId_1>",
      "quantity": 10,
      "sortOrder": 1
    },
    {
      "serviceTypeId": "<有效_serviceTypeId_2>",
      "quantity": 5,
      "sortOrder": 2
    },
    {
      "serviceTypeId": "<有效_serviceTypeId_3>",
      "quantity": 3,
      "sortOrder": 3
    }
  ]
}
```

## 验证修复结果

1. **替换示例数据中的 serviceTypeId**：使用从数据库中获取的实际 ACTIVE 状态的 serviceTypeId
2. **调用 API 验证**：使用修复后的示例数据调用 `/api/admin/products` API
3. **检查响应**：应该返回 `201 Created` 状态码和新创建的产品信息

## 额外建议

1. **使用真实数据**：始终使用数据库中实际存在的数据进行测试
2. **检查服务类型状态**：确保使用的 serviceTypeId 状态为 ACTIVE
3. **验证 UUID 格式**：确保 serviceTypeId 是有效的 UUID 格式
4. **使用 API 文档**：参考生成的 Swagger 文档，了解完整的 API 规范

通过以上方案，你可以成功修复 `SERVICE_TYPE_NOT_FOUND` 错误，使用有效的 serviceTypeId 创建产品。