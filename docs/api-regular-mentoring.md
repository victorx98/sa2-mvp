# Regular Mentoring API 接口文档

## 基本信息

- **基础路径**: `/api/counselor/regular-mentoring`
- **认证方式**: Bearer Token (JWT)
- **所需角色**: Counselor

---

## 接口列表

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/regular-mentoring` | 创建常规辅导会话 | 201 |
| GET | `/api/counselor/regular-mentoring` | 获取会话列表 | 200 |
| GET | `/api/counselor/regular-mentoring/:id` | 获取会话详情 | 200 |
| PATCH | `/api/counselor/regular-mentoring/:id` | 更新会话信息 | 200 |
| POST | `/api/counselor/regular-mentoring/:id/cancel` | 取消会话 | 200 |
| DELETE | `/api/counselor/regular-mentoring/:id` | 删除会话（软删除） | 200 |

---

## 接口详情

### 1. 创建常规辅导会话

**请求**

```http
POST /api/counselor/regular-mentoring
Authorization: Bearer {token}
Content-Type: application/json
```

**请求参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 | 示例 |
|------|------|------|--------|------|------|
| studentId | string | 是 | - | 学生ID | `9e50af7d-5f08-4516-939f-7f765ce131b8` |
| mentorId | string | 是 | - | 导师ID | `4903b94b-67cc-42a1-9b3e-91ebc51bcefc` |
| sessionTypeId | string | 是 | - | 会话类型ID | `uuid-session-type-id` |
| title | string | 是 | - | 会话标题 | `Resume Coaching` |
| description | string | 否 | - | 会话描述 | `Session description` |
| scheduledAt | string | 是 | - | 预定开始时间 (ISO 8601) | `2025-12-03T06:00:00Z` |
| duration | number | 否 | 60 | 会话时长（分钟） | `60` |
| meetingProvider | string | 否 | - | 会议提供商 | `feishu` |

**响应参数**

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话唯一标识符 |
| status | string | 会话状态（PENDING_MEETING：会议创建中；SCHEDULED：已安排） |
| scheduledAt | string | 预定开始时间 |
| holdId | string | 预留ID（可选） |

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 201 | 会话创建成功 |
| 400 | 请求参数无效或余额不足 |
| 403 | 无权为该学生预订 |
| 409 | 时间冲突（导师或学生已有预约） |

**说明**

- 该接口采用异步流程：
  1. **同步流程**（立即返回）：创建日历槽位、创建会话记录（状态为 PENDING_MEETING）
  2. **异步流程**（后台执行）：通过第三方 API 创建会议链接、更新会话状态为 SCHEDULED、发布 SESSION_BOOKED_EVENT
- 客户端应轮询 `GET /api/counselor/regular-mentoring/:id` 接口以检查状态并获取 meetingUrl

---

### 2. 获取会话列表

**请求**

```http
GET /api/counselor/regular-mentoring
Authorization: Bearer {token}
```

**查询参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码 |
| limit | number | 否 | 每页数量 |
| status | string | 否 | 会话状态筛选 |

**响应参数**

返回 `RegularMentoringSessionResponseDto` 数组

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 会话ID |
| sessionType | string | 会话类型 |
| studentUserId | string | 学生用户ID |
| mentorUserId | string | 导师用户ID |
| title | string | 会话标题 |
| description | string | 会话描述（可选） |
| status | string | 会话状态 |
| scheduledAt | string | 预定时间 |
| completedAt | string | 完成时间（可选） |
| cancelledAt | string | 取消时间（可选） |
| deletedAt | string | 删除时间（可选） |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 获取成功 |

---

### 3. 获取会话详情

**请求**

```http
GET /api/counselor/regular-mentoring/:id
Authorization: Bearer {token}
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话ID |

**响应参数**

返回 `RegularMentoringSessionResponseDto` 对象（字段同上）

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 获取成功 |
| 404 | 会话未找到 |

---

### 4. 更新会话信息

**请求**

```http
PATCH /api/counselor/regular-mentoring/:id
Authorization: Bearer {token}
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话ID |

**请求参数**

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| title | string | 否 | 会话标题 | `Resume Coaching` |
| description | string | 否 | 会话描述 | `Session description` |
| scheduledAt | string | 否 | 预定开始时间 (ISO 8601) | `2025-12-03T06:00:00Z` |

**响应参数**

返回 `RegularMentoringSessionResponseDto` 对象

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 更新成功 |
| 404 | 会话未找到 |
| 409 | 检测到时间冲突 |

---

### 5. 取消会话

**请求**

```http
POST /api/counselor/regular-mentoring/:id/cancel
Authorization: Bearer {token}
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话ID |

**请求参数**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| reason | string | 否 | `Cancelled by counselor` | 取消原因 |

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 取消成功 |
| 404 | 会话未找到 |

---

### 6. 删除会话（软删除）

**请求**

```http
DELETE /api/counselor/regular-mentoring/:id
Authorization: Bearer {token}
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话ID |

**响应状态码**

| 状态码 | 说明 |
|--------|------|
| 200 | 删除成功 |
| 404 | 会话未找到 |

---

## 通用说明

### 认证

所有接口都需要在请求头中携带 JWT Token：

```
Authorization: Bearer {your_jwt_token}
```

### 错误响应格式

```json
{
  "statusCode": 400,
  "message": "错误描述",
  "error": "Bad Request"
}
```

### 日期时间格式

所有日期时间字段使用 ISO 8601 格式，例如：`2025-12-03T06:00:00Z`

