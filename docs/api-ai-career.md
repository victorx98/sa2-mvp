# AI Career API 接口文档

## 基本信息

- **基础路径**: `/api/counselor/ai-career`
- **认证方式**: Bearer Token (JWT)
- **所需角色**: Counselor

---

## 接口列表

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/ai-career` | 创建AI职业评估会话 | 201 |
| GET | `/api/counselor/ai-career` | 获取会话列表 | 200 |
| GET | `/api/counselor/ai-career/:id` | 获取会话详情 | 200 |
| PATCH | `/api/counselor/ai-career/:id` | 更新会话信息 | 200 |
| POST | `/api/counselor/ai-career/:id/cancel` | 取消会话 | 200 |
| DELETE | `/api/counselor/ai-career/:id` | 删除会话（软删除） | 200 |

