# Communication Session API 接口文档

## 基本信息

- **基础路径**: `/api/counselor/comm-session`
- **认证方式**: Bearer Token (JWT)
- **所需角色**: Counselor

---

## 接口列表

### 1. 会话基本操作

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/comm-session` | 创建沟通会话（非计费） | 201 |
| GET | `/api/counselor/comm-session/:id` | 获取会话详情 | 200 |
| PATCH | `/api/counselor/comm-session/:id` | 更新会话信息 | 200 |
| POST | `/api/counselor/comm-session/:id/cancel` | 取消会话 | 200 |
| DELETE | `/api/counselor/comm-session/:id` | 删除会话（软删除） | 200 |

### 2. 会话查询

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| GET | `/api/counselor/mentor/:mentorId/comm-sessions` | 获取指定导师的沟通会话列表 | 200 |
| GET | `/api/counselor/student/:studentId/comm-sessions` | 获取指定学生的沟通会话列表 | 200 |

