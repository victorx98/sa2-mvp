# 推荐信功能设计文档

## 1. 数据库设计

### 1.1 推荐信表 (recomm_letters)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | uuid | ✓ | 主键 |
| student_user_id | uuid | ✓ | 学生ID (FK: users.id) |
| letter_type_id | uuid | ✓ | Letter Type ID (FK: recomm_letter_types.id) |
| package_type_id | uuid | - | Package Type ID (FK: recomm_letter_types.id) |
| service_type | varchar(50) | ✓ | 服务类型 |
| description | varchar(1000) | - | 操作描述 |
| file_url | varchar(1000) | ✓ | 文件URL (S3) |
| file_name | varchar(500) | ✓ | 文件名 |
| status | varchar(20) | ✓ | 状态: uploaded/deleted |
| mentor_user_id | uuid | - | 导师ID (FK: users.id, NULL=未计费) |
| billed_at | timestamp | - | 计费时间 |
| uploaded_by | uuid | ✓ | 上传人ID (FK: users.id) |
| created_at | timestamp | ✓ | 创建时间 |
| updated_at | timestamp | ✓ | 更新时间 |

**索引**
- idx_recomm_letters_student_user_id (student_user_id)
- idx_recomm_letters_letter_type_id (letter_type_id)
- idx_recomm_letters_service_type (service_type)
- idx_recomm_letters_status (status)
- idx_recomm_letters_mentor_user_id (mentor_user_id)

---

## 2. API 层设计

### 2.1 Controller (RecommLetterController)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| uploadRecommLetter | POST /recomm-letters/upload | counselor | 上传推荐信 (仅顾问) |
| listRecommLettersByStudent | GET /recomm-letters/student/:studentUserId | counselor, mentor, student | 查询学生推荐信列表 |
| billRecommLetter | POST /recomm-letters/:letterId/bill | counselor | 给导师计费 |
| cancelBillRecommLetter | POST /recomm-letters/:letterId/cancel-bill | counselor | 取消计费 |
| deleteRecommLetter | DELETE /recomm-letters/:letterId | counselor | 软删除推荐信 (仅顾问) |

### 2.2 DTO 设计

#### UploadRecommLetterRequestDto
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentUserId | string | ✓ | 学生ID |
| letterTypeId | string | ✓ | Letter Type ID |
| packageTypeId | string | - | Package Type ID |
| serviceType | string | ✓ | 服务类型 |
| fileName | string | ✓ | 文件名 |
| fileUrl | string | ✓ | 文件URL |

#### BillRecommLetterRequestDto
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | ✓ | 学生ID |
| mentorId | string | ✓ | 导师ID |
| serviceType | string | - | 服务类型 |
| description | string | - | 计费描述 |

#### CancelBillRecommLetterRequestDto
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| serviceType | string | - | 服务类型 |
| description | string | - | 取消描述 |

#### RecommLetterResponseDto
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 推荐信ID |
| studentUserId | string | 学生ID |
| letterType | object | Letter Type信息 (id, code, name) |
| packageType | object? | Package Type信息 (id, code, name) |
| fileName | string | 文件名 |
| fileUrl | string | 文件URL |
| status | string | 状态 |
| mentorUserId | string? | 导师ID |
| billedAt | Date? | 计费时间 |
| description | string? | 描述 |
| uploadedBy | string | 上传人ID |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

---

## 3. Application 层设计

### 3.1 RecommLetterService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| billRecommLetter | letterId: string<br>params: { mentorId, description, studentId, serviceType }<br>userId: string | RecommLetterEntity | 计费推荐信<br>1. 创建service hold<br>2. 调用domain层计费逻辑 |
| cancelBillRecommLetter | letterId: string<br>params: { description, serviceType }<br>userId: string | RecommLetterEntity | 取消计费<br>1. 取消domain层计费<br>2. 释放service hold |

---

## 4. Domain 层设计

### 4.1 RecommLetterEntity

#### 属性
| 属性 | 类型 | 说明 |
|------|------|------|
| id | string | 推荐信ID |
| studentUserId | string | 学生ID |
| letterTypeId | string | Letter Type ID |
| packageTypeId | string? | Package Type ID |
| serviceType | string | 服务类型 |
| fileName | string | 文件名 |
| fileUrl | string | 文件URL |
| status | RecommLetterStatus | 状态枚举 |
| uploadedBy | string | 上传人ID |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |
| description | string? | 描述 |
| mentorUserId | string? | 导师ID |
| billedAt | Date? | 计费时间 |

#### 业务方法
| 方法 | 说明 |
|------|------|
| markAsDeleted() | 标记为删除 (仅未计费时可删除) |
| validateBilling() | 验证计费资格 (未计费 + 状态为uploaded) |
| markAsBilled() | 标记为已计费 |
| cancelBilling() | 取消计费 |

### 4.2 RecommLetterStatus (Value Object)

```typescript
enum RecommLetterStatus {
  UPLOADED = 'uploaded',
  DELETED = 'deleted'
}
```

### 4.3 RecommLetterDomainService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| upload | params: { studentUserId, letterTypeId, packageTypeId?, serviceType, fileName, fileUrl, uploadedBy } | RecommLetterEntity | 上传推荐信 |
| listByStudent | studentUserId: string | RecommLetterEntity[] | 查询学生推荐信列表 |
| delete | letterId: string, userId: string, tx? | void | 软删除 (仅未计费时) |
| findById | letterId: string, tx? | RecommLetterEntity? | 根据ID查询 |
| billRecommLetter | letterId: string<br>params: { mentorId, description }<br>userId: string<br>tx? | RecommLetterEntity | 计费推荐信<br>- 验证业务规则<br>- 更新计费信息<br>- 注册service reference<br>- 发布事件 |
| cancelBillRecommLetter | letterId: string<br>params: { description }<br>userId: string<br>tx? | RecommLetterEntity | 取消计费<br>- 清除计费信息<br>- 删除service reference<br>- 发布事件 |

### 4.4 IRecommLetterRepository

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| create | entity: RecommLetterEntity, tx? | RecommLetterEntity | 创建推荐信 |
| update | entity: RecommLetterEntity, tx? | RecommLetterEntity | 更新推荐信 |
| findById | id: string, tx? | RecommLetterEntity? | 根据ID查询 |
| findAllByStudent | studentUserId: string, tx? | RecommLetterEntity[] | 查询学生所有推荐信 |

---

## 5. 业务规则

### 5.1 权限规则
- ✅ **上传推荐信**：仅顾问 (counselor) 有权限
- ✅ **删除推荐信**：仅顾问 (counselor) 有权限
- ✅ **查询推荐信**：顾问、导师、学生均可查询
- ✅ **计费/取消计费**：仅顾问 (counselor) 有权限

### 5.2 上传规则
- ✅ 顾问选择 Letter Type (必填)
- ✅ 顾问选择 Package Type (可选，仅当Letter Type为Package类型时)
- ✅ 上传文件到S3，保存URL

### 5.3 删除规则
- ✅ 未计费：可以软删除
- ❌ 已计费：不能删除，只能取消计费

### 5.4 计费规则
- ✅ 只有 uploaded 状态可计费
- ✅ 未计费的推荐信才能计费
- ✅ 无job title约束，同一学生可多次计费
- ✅ 计费时创建 service hold
- ✅ 计费时注册 service reference

### 5.5 取消计费规则
- ✅ 只有已计费的推荐信才能取消
- ✅ 取消时释放 service hold
- ✅ 取消时删除 service reference

---

## 6. 事件设计

### 6.1 RECOMM_LETTER_BILLED_EVENT (推荐信计费事件)

参考 `SERVICE_SESSION_COMPLETED_EVENT` 格式设计

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | - | 会话ID (推荐信场景下为letterId) |
| studentId | string | ✓ | 学生ID |
| mentorId | string | - | 导师ID |
| refrenceId | string | - | 参考ID (推荐信ID) |
| serviceTypeCode | string | ✓ | 服务类型代码 (如: RecommendationLetter) |
| letterType | string | ✓ | Letter Type Code (recomm_letter_types.type_code) |
| packageType | string | - | Package Type Code (recomm_letter_types.type_code) |

### 6.2 RECOMM_LETTER_BILL_CANCELLED_EVENT (取消计费事件)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | - | 会话ID (推荐信场景下为letterId) |
| studentId | string | ✓ | 学生ID |
| mentorId | string | - | 导师ID |
| refrenceId | string | - | 参考ID (推荐信ID) |
| serviceTypeCode | string | ✓ | 服务类型代码 |
| letterType | string | ✓ | Letter Type Code |
| packageType | string | - | Package Type Code |
| cancelledAt | Date | ✓ | 取消时间 |

---

## 7. 与简历功能的差异对比

| 特性 | 简历 | 推荐信 |
|------|------|--------|
| Job Title分类 | ✓ | ✗ |
| Set Final操作 | ✓ | ✗ |
| Cancel Final操作 | ✓ | ✗ |
| Letter/Package Type | ✗ | ✓ |
| 同类型计费限制 | ✓ (每个job title只能计费一份) | ✗ (无限制) |
| 状态枚举 | uploaded/final/deleted | uploaded/deleted |
| 计费前可删除 | ✓ | ✓ |
| 计费后可删除 | ✗ | ✗ |
| 取消计费 | ✓ | ✓ |

---

## 8. 文件结构

```
src/
├── api/
│   ├── controllers/services/recomm-letter/
│   │   └── recomm-letter.controller.ts
│   └── dto/
│       ├── request/services/recomm-letter/
│       │   ├── upload-recomm-letter.request.dto.ts
│       │   ├── bill-recomm-letter.request.dto.ts
│       │   └── cancel-bill-recomm-letter.request.dto.ts
│       └── response/services/recomm-letter/
│           └── recomm-letter.response.dto.ts
├── application/commands/services/
│   └── recomm-letter.service.ts
├── domains/services/recomm-letter/
│   ├── entities/
│   │   └── recomm-letter.entity.ts
│   ├── value-objects/
│   │   └── recomm-letter-status.vo.ts
│   ├── repositories/
│   │   ├── recomm-letter.repository.interface.ts
│   │   └── recomm-letter.repository.ts
│   ├── services/
│   │   └── recomm-letter-domain.service.ts
│   ├── exceptions/
│   │   └── index.ts
│   ├── infrastructure/
│   │   └── recomm-letters.schema.ts (待创建)
│   └── recomm-letter.module.ts
└── shared/events/
    └── recomm-letter-events.ts (待创建)
```

