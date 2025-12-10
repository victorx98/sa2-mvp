# Class & Class Session API 接口文档

## 基本信息

- **基础路径**: `/api/counselor/class`
- **认证方式**: Bearer Token (JWT)
- **所需角色**: Counselor

---

## 一、班课管理接口 (Class)

### 1.1 班课基本操作

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/class` | 创建班课 | 201 |
| GET | `/api/counselor/class` | 获取班课列表 | 200 |
| GET | `/api/counselor/class/:id` | 获取班课详情 | 200 |
| PATCH | `/api/counselor/class/:id` | 更新班课信息 | 200 |
| PATCH | `/api/counselor/class/:id/status` | 更新班课状态 | 200 |

### 1.2 班课导师管理

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/class/:id/mentors` | 添加导师到班课 | 201 |
| DELETE | `/api/counselor/class/:id/mentors/:mentorId` | 移除班课导师 | 200 |
| PATCH | `/api/counselor/class/:id/mentors/:mentorId/price` | 更新导师课时费 | 200 |
| GET | `/api/counselor/class/:id/mentors` | 获取班课导师列表 | 200 |

### 1.3 班课学生管理

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/class/:id/students` | 添加学生到班课 | 201 |
| DELETE | `/api/counselor/class/:id/students/:studentId` | 移除班课学生 | 200 |
| GET | `/api/counselor/class/:id/students` | 获取班课学生列表 | 200 |

### 1.4 班课顾问管理

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/class/:id/counselors` | 添加顾问到班课 | 201 |
| DELETE | `/api/counselor/class/:id/counselors/:counselorId` | 移除班课顾问 | 200 |
| GET | `/api/counselor/class/:id/counselors` | 获取班课顾问列表 | 200 |

---

## 二、班课会话接口 (Class Session)

### 2.1 会话基本操作

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| POST | `/api/counselor/class-session` | 创建班课会话 | 201 |
| GET | `/api/counselor/class-session/:id` | 获取会话详情 | 200 |
| PATCH | `/api/counselor/class-session/:id` | 更新会话信息 | 200 |
| POST | `/api/counselor/class-session/:id/cancel` | 取消会话 | 200 |
| DELETE | `/api/counselor/class-session/:id` | 删除会话（软删除） | 200 |

### 2.2 会话查询

| 方法 | 路径 | 功能描述 | 状态码 |
|------|------|----------|--------|
| GET | `/api/counselor/class/:classId/sessions` | 获取指定班课的会话列表 | 200 |
| GET | `/api/counselor/mentor/:mentorId/sessions` | 获取指定导师的会话列表 | 200 |

