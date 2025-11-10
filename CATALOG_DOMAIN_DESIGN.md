# MentorX 平台 Catalog Domain 详细设计文档

> **版本：** v1.1
> **创建日期：** 2025-11-04
> **最后更新：** 2025-11-04
> **状态：** 设计阶段
> **负责域：** Catalog Domain（产品目录域）

---

## 📋 目录

- [1. 领域概述](#1-领域概述)
- [2. 核心概念与架构](#2-核心概念与架构)
- [3. 数据模型设计](#3-数据模型设计)
- [4. 领域服务接口](#4-领域服务接口)
- [5. DTO 定义](#5-dto-定义)
- [6. 业务规则与验证](#6-业务规则与验证)
- [7. 状态机设计](#7-状态机设计)
- [8. 示例场景](#8-示例场景)
- [9. 实现指南](#9-实现指南)

---

## 1. 领域概述

### 1.1 领域职责

Catalog Domain（产品目录域）是 MentorX 平台的**配置域**，负责管理平台提供的所有服务、服务包和产品的定义和配置。

**核心职责：**

- ✅ 管理平台提供的基础服务定义（Service）
- ✅ 管理服务组合（Service Package）
- ✅ 管理面向客户的产品（Product）
- ✅ 管理产品的生命周期状态（草稿/上架/下架）
- ✅ 提供产品查询和推荐功能
- ✅ 支持产品的定时上下架

**不负责的职责：**

- ❌ 不处理合同签订（Contract Domain 负责）
- ❌ 不处理服务消费（Contract Domain 负责）
- ❌ 不处理计费和结算（Financial Domain 负责）
- ❌ 不发布业务事件（纯配置域，按需查询）

### 1.2 领域特性

**配置域特性：**

1. **纯配置管理**：Catalog 是配置域，不参与业务流程
2. **按需查询**：其他域通过服务调用获取产品信息
3. **无事件发布**：不发布业务事件，避免不必要的耦合
4. **独立演进**：配置变更不影响已签约的合同

**三层清晰分层：**

```
Service (服务)
    ↓ 被引用
Service Package (服务包)
    ↓ 被引用
Product (产品)
    ↓ 被引用
Contract (合同)
```

### 1.3 与其他域的协作

**协作模式：同步服务调用**

```
Contract Domain                    Catalog Domain
    │                                  │
    │ 创建合同时需要产品信息              │
    │──────────────────────────────────▶│
    │   调用: getProductById()          │
    │                                  │ 查询产品
    │                                  │ 查询产品项
    │                                  │ 展开服务和服务包
    │◀──────────────────────────────────│
    │   返回: ProductDetail             │
    │                                  │
    │ 创建合同和服务权益                 │
```

**关键点：**

- ✅ Contract Domain 通过直接调用 `ProductService` 获取产品信息
- ✅ Contract 保存 `productId`，需要时动态查询产品详情
- ✅ 产品信息变更不影响已签约的合同（合同创建时已复制关键信息）

---

## 2. 核心概念与架构

### 2.1 核心概念

#### 2.1.1 Service（服务）

**定义：** 服务是平台提供的最小原子单位，是构成服务包和产品的基础元素。

**特点：**

- 原子性：服务是最小的可售卖单位
- 可复用：同一服务可被多个服务包或产品引用
- 独立管理：服务的定义和配置独立于产品

**示例：**

- GAP分析
- 简历修改
- 推荐信
- 1对1辅导
- 内推服务
- 合同促签

**服务类型（Service Type）：**

```typescript
enum ServiceType {
  // 1对1服务
  GAP_ANALYSIS = 'gap_analysis',
  RESUME_REVIEW = 'resume_review',
  RECOMMENDATION_LETTER = 'recommendation_letter',
  RECOMMENDATION_LETTER_ONLINE = 'recommendation_letter_online',
  SESSION = 'session',
  MOCK_INTERVIEW = 'mock_interview',

  // 小组服务
  CLASS_SESSION = 'class_session',

  // 特殊服务
  INTERNAL_REFERRAL = 'internal_referral',
  CONTRACT_SIGNING_ASSISTANCE = 'contract_signing_assistance',
  PROXY_APPLICATION = 'proxy_application',

  // 其他
  OTHER_SERVICE = 'other',
}
```

**计费模式（Billing Mode）：**

```typescript
enum BillingMode {
  ONE_TIME = 'one_time',       // 按次计费（如简历修改）
  PER_SESSION = 'per_session',  // 按课节计费（如班课）
  STAGED = 'staged',           // 阶段性计费（如内推）
  PACKAGE = 'package',         // 服务包计费（整包售卖）
}
```

#### 2.1.2 Service Package（服务包）

**定义：** 服务包是多个服务的逻辑组合，便于管理和售卖。

**特点：**

- 组合性：服务包由多个服务组成
- 可复用：同一服务包可被多个产品引用
- 独立管理：服务包的定义独立于产品

**示例：**

```
求职基础包：
- GAP分析 x 1次
- 简历修改 x 3次
- 推荐信 x 1次
- 1对1辅导 x 5次
```

#### 2.1.3 Product（产品）

**定义：** 产品是面向客户的商品，包含服务或服务包的组合，并附带定价和营销信息。

**特点：**

- 面向客户：产品是最终售卖给学生的商品
- 灵活组合：产品可以包含服务或服务包
- 生命周期管理：草稿 → 上架 → 下架的状态流转
- 目标用户细分：支持学历维度

**产品状态（Product Status）：**

```typescript
enum ProductStatus {
  DRAFT = 'draft',       // 草稿
  ACTIVE = 'active',     // 上架
  INACTIVE = 'inactive', // 下架
}
```

**目标用户类型（User Type）：**

```typescript
enum UserType {
  UNDERGRADUATE = 'undergraduate',  // 本科生
  GRADUATE = 'graduate',           // 研究生
  WORKING = 'working',            // 在职人士
}
```

### 2.2 架构设计

#### 2.2.1 三层分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Catalog Domain 架构                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Service (服务层)                                   │
│  - 定义平台的基础服务                                         │
│  - 配置计费模式、评价要求等                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓ 被引用
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Service Package (服务包层)                         │
│  - 多个服务的逻辑组合                                         │
│  - 通过 service_package_items 关联服务                       │
│  - 简化产品配置和管理                                         │
└─────────────────────────────────────────────────────────────┘
                              ↓ 被引用
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Product (产品层)                                   │
│  - 面向客户的商品                                            │
│  - 通过 product_items 关联服务或服务包                       │
│  - 包含定价、营销标签等信息                          │
│  - 支持生命周期管理（草稿/上架/下架）                         │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 数据流向

```
┌──────────────┐
│ 产品经理      │
└──────┬───────┘
       │ 1. 创建服务
       ▼
┌──────────────────┐
│ Service          │
│ (服务定义)        │
└──────┬───────────┘
       │ 2. 组合成服务包
       ▼
┌──────────────────────┐
│ Service Package      │
│ (服务包)              │
└──────┬───────────────┘
       │ 3. 配置产品
       ▼
┌─────────────────────────┐
│ Product                 │
│ (产品 + 定价 + 营销)     │
└──────┬──────────────────┘
       │ 4. 上架产品
       ▼
┌─────────────────────────┐
│ 学生浏览和购买           │
└─────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 核心表结构

Catalog Domain 包含 5 张核心表：

| 表名                      | 类型   | 职责       |
| ------------------------- | ------ | ---------- |
| `services`              | 实体表 | 服务定义   |
| `service_packages`      | 实体表 | 服务包定义 |
| `service_package_items` | 关联表 | 服务包组成 |
| `products`              | 实体表 | 产品定义   |
| `product_items`         | 关联表 | 产品组成   |

#### 3.1.1 表关系图

```
┌─────────────────┐
│    services     │
└────────┬────────┘
         │
         │ 被引用（M:N）
         │
    ┌────▼────────────────────────┐
    │                             │
┌───▼──────────────────┐   ┌──────▼──────────┐
│service_package_items │   │  product_items  │
└───┬──────────────────┘   └──────┬──────────┘
    │                             │
    │ 属于                        │ 属于
    │                             │
┌───▼──────────────┐       ┌──────▼─────────┐
│service_packages  │───────▶│   products     │
└──────────────────┘       └────────────────┘
         被引用（M:N）
```

### 3.2 Schema 定义

#### 3.2.1 services（服务定义表）

**文件路径：** `src/database/schema/services.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, json, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

// 服务类型枚举
export const serviceTypeEnum = pgEnum('service_type', [
  // 1对1服务
  'gap_analysis',                  // GAP分析
  'resume_review',                 // 简历修改
  'recommendation_letter',         // 推荐信
  'recommendation_letter_online',  // 网申推荐信
  'session',           		   // 通用1对1辅导
  'mock_interview',               // 模拟面试（AI）

  // 小组服务
  'class_session',                // 班课

  // 特殊服务
  'internal_referral',            // 内推服务
  'contract_signing_assistance',  // 合同促签
  'proxy_application',            // 代投服务

  // 其他
  'other_service',               //其他服务
]);

// 计费模式枚举
export const billingModeEnum = pgEnum('billing_mode', [
  'one_time',     // 按次计费（如简历修改）
  'per_session',  // 按课节计费（如班课）
  'staged',       // 阶段性计费（如内推，具体阶段由Financial Domain管理）
  'package',      // 服务包计费（整包售卖）
]);

// 单位枚举
export const serviceUnitEnum = pgEnum('service_unit', [
  'times',        // 次
  'hours',        // 小时
]);

// 服务状态枚举
export const serviceStatusEnum = pgEnum('service_status', [
  'active',    // 启用
  'inactive',  // 禁用
  'deleted',   // 已删除
]);

export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 服务标识
  code: varchar('code', { length: 100 }).notNull().unique(), // 服务编码，如 'resume_review'
  serviceType: serviceTypeEnum('service_type').notNull().unique(),

  // 基本信息
  name: varchar('name', { length: 200 }).notNull(), // 服务名称，如 '简历修改'
  description: text('description'),
  coverImage: varchar('cover_image', { length: 500 }),

  // 计费配置
  billingMode: billingModeEnum('billing_mode').notNull().default('one_time'),
  defaultUnit: serviceUnitEnum('default_unit').notNull().default('times'),

  // 服务配置
  requiresEvaluation: boolean('requires_evaluation').default(false), // 是否需要评价后计费
  requiresMentorAssignment: boolean('requires_mentor_assignment').default(true), // 是否需要分配导师

  // 状态管理
  status: serviceStatusEnum('status').notNull().default('active'),

  // 元数据
  metadata: json('metadata').$type<{
    features?: string[];        // 服务特点
    deliverables?: string[];    // 交付物
    duration?: number;          // 预计时长（分钟）
    prerequisites?: string[];   // 前置条件
  }>(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
});

// 索引
// CREATE INDEX idx_services_code ON services(code);
// CREATE INDEX idx_services_service_type ON services(service_type);
// CREATE INDEX idx_services_status ON services(status);
// CREATE INDEX idx_services_billing_mode ON services(billing_mode);
```

**字段说明：**

| 字段                         | 类型         | 说明         | 约束                         |
| ---------------------------- | ------------ | ------------ | ---------------------------- |
| `id`                       | UUID         | 主键         | PRIMARY KEY                  |
| `code`                     | VARCHAR(100) | 服务编码     | UNIQUE, NOT NULL             |
| `serviceType`              | ENUM         | 服务类型     | UNIQUE, NOT NULL             |
| `name`                     | VARCHAR(200) | 服务名称     | NOT NULL                     |
| `description`              | TEXT         | 服务描述     | -                            |
| `coverImage`               | VARCHAR(500) | 封面图片URL  | -                            |
| `billingMode`              | ENUM         | 计费模式     | NOT NULL, DEFAULT 'one_time' |
| `defaultUnit`              | ENUM         | 默认单位     | NOT NULL, DEFAULT 'times'    |
| `requiresEvaluation`       | BOOLEAN      | 是否需要评价 | DEFAULT false                |
| `requiresMentorAssignment` | BOOLEAN      | 是否需要导师 | DEFAULT true                 |
| `status`                   | ENUM         | 服务状态     | NOT NULL, DEFAULT 'active'   |
| `metadata`                 | JSON         | 元数据       | -                            |
| `createdAt`                | TIMESTAMP    | 创建时间     | NOT NULL                     |
| `updatedAt`                | TIMESTAMP    | 更新时间     | NOT NULL                     |
| `createdBy`                | UUID         | 创建人       | NOT NULL, FK → users        |

#### 3.2.2 service_packages（服务包表）

**文件路径：** `src/database/schema/service-packages.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, varchar, text, timestamp, json } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { serviceStatusEnum } from './services.schema';

export const servicePackages = pgTable('service_packages', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 服务包标识
  code: varchar('code', { length: 100 }).notNull().unique(), // 服务包编码，如 'basic_package'
  name: varchar('name', { length: 200 }).notNull(), // 服务包名称，如 '求职基础包'
  description: text('description'),
  coverImage: varchar('cover_image', { length: 500 }),

  // 状态管理
  status: serviceStatusEnum('status').notNull().default('active'),

  // 元数据
  metadata: json('metadata').$type<{
    features?: string[];      // 服务包特点
  }>(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
});

// 索引
// CREATE INDEX idx_service_packages_code ON service_packages(code);
// CREATE INDEX idx_service_packages_status ON service_packages(status);
```

**字段说明：**

| 字段            | 类型         | 说明        | 约束                   |
| --------------- | ------------ | ----------- | ---------------------- |
| `id`          | UUID         | 主键        | PRIMARY KEY            |
| `code`        | VARCHAR(100) | 服务包编码  | UNIQUE, NOT NULL       |
| `name`        | VARCHAR(200) | 服务包名称  | NOT NULL                 |
| `description` | TEXT         | 服务包描述  | -                        |
| `coverImage`  | VARCHAR(500) | 封面图片URL | -                        |
| `status`      | ENUM         | 服务包状态  | NOT NULL, DEFAULT 'active' |
| `metadata`    | JSON         | 元数据      | -                        |
| `createdAt`   | TIMESTAMP    | 创建时间    | NOT NULL               |
| `updatedAt`   | TIMESTAMP    | 更新时间    | NOT NULL               |
| `createdBy`   | UUID         | 创建人      | NOT NULL, FK → users  |

#### 3.2.3 service_package_items（服务包组成表）

**文件路径：** `src/database/schema/service-package-items.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
import { servicePackages } from './service-packages.schema';
import { services, serviceUnitEnum } from './services.schema';

export const servicePackageItems = pgTable('service_package_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联服务包和服务
  packageId: uuid('package_id').notNull().references(() => servicePackages.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'restrict' }),

  // 数量配置
  quantity: integer('quantity').notNull(), // 服务次数
  unit: serviceUnitEnum('unit').notNull().default('times'), // 单位

  // 展示顺序
  sortOrder: integer('sort_order').notNull().default(0),

  // 时间戳字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 索引
// CREATE INDEX idx_service_package_items_package_id ON service_package_items(package_id);
// CREATE INDEX idx_service_package_items_service_id ON service_package_items(service_id);
// CREATE UNIQUE INDEX idx_service_package_items_package_service ON service_package_items(package_id, service_id);

// 外键约束说明：
// - packageId: CASCADE DELETE（服务包删除时，自动删除关联记录）
// - serviceId: RESTRICT DELETE（服务被引用时，不允许删除）
```

**字段说明：**

| 字段          | 类型      | 说明     | 约束                                             |
| ------------- | --------- | -------- | ------------------------------------------------ |
| `id`        | UUID      | 主键     | PRIMARY KEY                                      |
| `packageId` | UUID      | 服务包ID | NOT NULL, FK → service_packages, CASCADE DELETE |
| `serviceId` | UUID      | 服务ID   | NOT NULL, FK → services, RESTRICT DELETE        |
| `quantity`  | INTEGER   | 服务数量 | NOT NULL                                         |
| `unit`      | ENUM      | 单位     | NOT NULL, DEFAULT 'times'                        |
| `sortOrder` | INTEGER   | 排序顺序 | NOT NULL, DEFAULT 0                              |
| `createdAt` | TIMESTAMP | 创建时间 | NOT NULL                                         |
| `updatedAt` | TIMESTAMP | 更新时间 | NOT NULL                                         |

**唯一约束：** `(packageId, serviceId)` - 同一服务包不能重复包含同一服务

#### 3.2.4 products（产品表）

**文件路径：** `src/database/schema/products.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, varchar, integer, timestamp, text, json, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

// 产品状态枚举
export const productStatusEnum = pgEnum('product_status', [
  'draft',        // 草稿
  'active',       // 上架
  'inactive',     // 下架
  'deleted',      // 已删除
]);

// 货币枚举
export const currencyEnum = pgEnum('currency', [
  'USD',   // 美元
  'CNY',   // 人民币
  'EUR',   // 欧元（预留）
  'GBP',   // 英镑（预留）
  'JPY',   // 日元（预留）
]);

// 用户类型枚举
export const userTypeEnum = pgEnum('user_type', [
  'undergraduate',  // 本科生
  'graduate',       // 研究生
  'working',        // 在职人士
]);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 基本信息
  name: varchar('name', { length: 500 }).notNull(),
  code: varchar('code', { length: 100 }).notNull().unique(), // 产品编码
  description: text('description'),
  coverImage: varchar('cover_image', { length: 500 }),

  // 目标用户（支持多选）
  targetUserTypes: json('target_user_types').$type<Array<'undergraduate' | 'graduate' | 'working'>>(),

  // 定价信息
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('USD'),

  // 有效期，如果为NULL表示长期有效（单位：天）
  validityDays: integer('validity_days'),

  // 营销标签
  marketingLabels: json('marketing_labels').$type<Array<'hot' | 'new' | 'recommended'>>(),

  // 状态管理
  status: productStatusEnum('status').notNull().default('draft'),

  // 定时上架（仅作为元数据，不自动触发）
  scheduledPublishAt: timestamp('scheduled_publish_at', { withTimezone: true }),

  // 实际上下架时间
  publishedAt: timestamp('published_at', { withTimezone: true }),
  unpublishedAt: timestamp('unpublished_at', { withTimezone: true }),

  // 展示顺序
  sortOrder: integer('sort_order').notNull().default(0),

  // 元数据
  metadata: json('metadata').$type<{
    features?: string[];        // 产品特点
    faqs?: Array<{              // 常见问题
      question: string;
      answer: string;
    }>;
  }>(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  publishedBy: uuid('published_by').references(() => users.id),
  unpublishedBy: uuid('unpublished_by').references(() => users.id),
});

// 索引
// CREATE INDEX idx_products_status ON products(status);
// CREATE INDEX idx_products_sort_order ON products(sort_order);
// CREATE INDEX idx_products_published_at ON products(published_at);
// CREATE INDEX idx_products_code ON products(code);
// CREATE INDEX idx_products_scheduled_publish ON products(scheduled_publish_at) WHERE status = 'draft';

// 约束
// ALTER TABLE products ADD CONSTRAINT chk_price_positive CHECK (price::numeric > 0);
// ALTER TABLE products ADD CONSTRAINT chk_validity_days_positive CHECK (validity_days IS NULL OR validity_days > 0);
```

**字段说明：**

| 字段                     | 类型          | 说明             | 约束                      |
| ------------------------ | ------------- | ---------------- | ------------------------- |
| `id`                   | UUID          | 主键             | PRIMARY KEY               |
| `name`                 | VARCHAR(500)  | 产品名称         | NOT NULL                  |
| `code`                 | VARCHAR(100)  | 产品编码         | UNIQUE, NOT NULL          |
| `description`          | TEXT          | 产品描述         | -                         |
| `coverImage`           | VARCHAR(500)  | 封面图片URL      | -                         |
| `targetUserTypes`      | JSON          | 目标用户类型数组 | -                         |
| `price`                | NUMERIC(12,2) | 价格             | NOT NULL, > 0             |
| `currency`             | ENUM          | 货币代码         | NOT NULL, DEFAULT 'USD'   |
| `validityDays`         | INTEGER       | 有效期（天）     | NULL表示长期有效, > 0     |
| `marketingLabels`      | JSON          | 营销标签数组     | -                         |
| `status`               | ENUM          | 产品状态         | NOT NULL, DEFAULT 'draft' |
| `scheduledPublishAt`   | TIMESTAMP     | 计划上架时间     | 仅作元数据，不自动触发    |
| `publishedAt`          | TIMESTAMP     | 实际上架时间     | -                         |
| `unpublishedAt`        | TIMESTAMP     | 实际下架时间     | -                         |
| `sortOrder`            | INTEGER       | 排序顺序         | NOT NULL, DEFAULT 0       |
| `metadata`             | JSON          | 元数据           | -                         |
| `createdAt`            | TIMESTAMP     | 创建时间         | NOT NULL                  |
| `updatedAt`            | TIMESTAMP     | 更新时间         | NOT NULL                  |
| `createdBy`            | UUID          | 创建人           | NOT NULL, FK → users     |
| `publishedBy`          | UUID          | 上架操作人       | FK → users               |
| `unpublishedBy`        | UUID          | 下架操作人       | FK → users               |

#### 3.2.5 product_items（产品项表）

**文件路径：** `src/database/schema/product-items.schema.ts`

**Schema 定义：**

```typescript
import { pgTable, uuid, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { products } from './products.schema';
import { services, serviceUnitEnum } from './services.schema';
import { servicePackages } from './service-packages.schema';

// 产品项类型枚举
export const productItemTypeEnum = pgEnum('product_item_type', [
  'service',          // 直接服务
  'service_package',  // 服务包
]);

export const productItems = pgTable('product_items', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联产品
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),

  // 项类型和引用ID
  type: productItemTypeEnum('type').notNull(),
  referenceId: uuid('reference_id').notNull(), // type='service' → services.id
                                                // type='service_package' → service_packages.id

  // 数量配置
  quantity: integer('quantity').notNull(), // 服务次数
  unit: serviceUnitEnum('unit').notNull().default('times'), // 单位

  // 展示顺序
  sortOrder: integer('sort_order').notNull().default(0),

  // 时间戳字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 索引
// CREATE INDEX idx_product_items_product_id ON product_items(product_id);
// CREATE INDEX idx_product_items_type ON product_items(type);
// CREATE INDEX idx_product_items_reference_id ON product_items(reference_id);
// CREATE UNIQUE INDEX idx_product_items_unique ON product_items(product_id, type, reference_id);

// 外键约束说明：
// - productId: CASCADE DELETE（产品删除时，自动删除所有关联的产品项）
// - referenceId: 应用层保证引用完整性（因为引用两个不同的表）
```

**字段说明：**

| 字段            | 类型      | 说明     | 约束                                     |
| --------------- | --------- | -------- | ---------------------------------------- |
| `id`          | UUID      | 主键     | PRIMARY KEY                              |
| `productId`   | UUID      | 产品ID   | NOT NULL, FK → products, CASCADE DELETE |
| `type`        | ENUM      | 项类型   | NOT NULL                                 |
| `referenceId` | UUID      | 引用ID   | NOT NULL                                 |
| `quantity`    | INTEGER   | 数量     | NOT NULL                                 |
| `unit`        | ENUM      | 单位     | NOT NULL, DEFAULT 'times'                |
| `sortOrder`   | INTEGER   | 排序顺序 | NOT NULL, DEFAULT 0                      |
| `createdAt`   | TIMESTAMP | 创建时间 | NOT NULL                                 |
| `updatedAt`   | TIMESTAMP | 更新时间 | NOT NULL                                 |

**唯一约束：** `(productId, type, referenceId)` - 同一产品不能重复包含同一服务或服务包

**类型区分：**

- `type='service'`：referenceId 指向 `services.id`
- `type='service_package'`：referenceId 指向 `service_packages.id`

---

## 4. 领域服务接口

### 4.1 ServiceService（服务管理服务）

**职责：** 管理平台提供的基础服务

**服务方法（9个）：**

| # | 方法名                | 方法签名                                                                                                            | 功能说明                                        |
| - | --------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1 | create                | `create(dto: CreateServiceDto): Promise<Service>`                                                                 | 创建新服务                                      |
| 2 | update                | `update(id: string, dto: UpdateServiceDto): Promise<Service>`                                                     | 更新服务信息                                    |
| 3 | search                | `search(filter: ServiceFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<Service>>` | 分页查询服务（默认排除deleted）                |
| 4 | findOne               | `findOne(where: FindOneServiceDto): Promise<ServiceDetail \| null>`                                               | 根据条件查询单条服务详情（支持id、code等字段组合，包含已删除）|
| 5 | updateStatus          | `updateStatus(id: string, status: 'active' \| 'inactive'): Promise<Service>`                                      | 更新服务状态（active/inactive）                 |
| 6 | remove                | `remove(id: string): Promise<Service>`                                                                            | 逻辑删除服务（设置status='deleted'，需检查引用）|
| 7 | restore               | `restore(id: string): Promise<Service>`                                                                           | 恢复已删除的服务（deleted → inactive）          |
| 8 | findAvailableServices | `findAvailableServices(): Promise<Service[]>`                                                                     | 查询所有可用服务（排除deleted）                 |
| 9 | generateSnapshot      | `generateSnapshot(id: string): Promise<ServiceSnapshot>`                                                          | 生成服务快照（用于合同快照）                    |

**实现位置：** `src/domains/catalog/service/services/service.service.ts`

### 4.2 ServicePackageService（服务包管理服务）

**职责：** 管理服务包（服务的组合）

**服务方法（11个）：**

| # | 方法名                  | 方法签名                                                                                                                   | 功能说明                                        |
| - | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1 | create                  | `create(dto: CreateServicePackageDto): Promise<ServicePackage>`                                                          | 创建服务包                                      |
| 2 | update                  | `update(id: string, dto: UpdateServicePackageDto): Promise<ServicePackage>`                                              | 更新服务包信息                                  |
| 3 | addService              | `addService(packageId: string, dto: AddServiceDto): Promise<void>`                                                       | 向服务包添加服务                                |
| 4 | removeService           | `removeService(packageId: string, serviceId: string): Promise<void>`                                                     | 从服务包移除服务                                |
| 5 | updateItemSortOrder     | `updateItemSortOrder(packageId: string, items: Array<{itemId: string; sortOrder: number}>): Promise<void>`              | 更新服务包中服务项排序顺序                      |
| 6 | search                  | `search(filter: PackageFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<ServicePackage>>` | 分页查询服务包（默认排除deleted，支持查询active服务包）              |
| 7 | findOne                 | `findOne(where: FindOneServicePackageDto): Promise<ServicePackageDetail \| null>`                                        | 根据条件查询单条服务包详情（支持id、code等字段组合，包含已删除）|
| 8 | updateStatus            | `updateStatus(id: string, status: 'active' \| 'inactive'): Promise<ServicePackage>`                                      | 更新服务包状态（active/inactive，禁用时会检查product引用）               |
| 9 | remove                  | `remove(id: string): Promise<ServicePackage>`                                                                            | 逻辑删除服务包（设置status='deleted'，需检查product引用，不检查package间引用）|
| 10| restore                 | `restore(id: string): Promise<ServicePackage>`                                                                           | 恢复已删除的服务包（deleted → inactive）        |
| 11| generateSnapshot        | `generateSnapshot(id: string): Promise<ServicePackageSnapshot>`                                                          | 生成服务包快照（展开服务，用于合同快照）        |

**特殊说明：**
- 查询可用服务包请使用 `search({ status: 'active' })`

**实现位置：** `src/domains/catalog/service-package/services/service-package.service.ts`

### 4.3 ProductService（产品管理服务）

**职责：** 产品生命周期管理，包含草稿、上架、下架状态流转

**服务方法（15个）：**

| #  | 方法名                 | 方法签名                                                                                                            | 功能说明                                        |
| -- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1  | create                 | `create(dto: CreateProductDto): Promise<Product>`                                                                 | 创建产品（草稿状态）                            |
| 2  | update                 | `update(id: string, dto: UpdateProductDto): Promise<Product>`                                                     | 更新未发布过的草稿产品                          |
| 3  | addItem                | `addItem(productId: string, dto: AddProductItemDto): Promise<void>`                                               | 向产品添加服务或服务包                          |
| 4  | removeItem             | `removeItem(productId: string, itemId: string): Promise<void>`                                                    | 从产品移除服务或服务包                          |
| 5  | updateItemSortOrder    | `updateItemSortOrder(productId: string, items: Array<{itemId: string; sortOrder: number}>): Promise<void>`       | 更新产品项排序顺序                              |
| 6  | search                 | `search(filter: ProductFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<Product>>` | 分页查询（默认排除deleted，支持includeDeleted）|
| 7  | findOne                | `findOne(where: FindOneProductDto): Promise<ProductDetail \| null>`                                               | 根据条件查询单条产品详情（支持id、code等字段组合，包含已删除）|
| 8  | publish                | `publish(id: string, dto: PublishProductDto): Promise<Product>`                                                   | 上架产品（scheduledPublishAt仅作备忘录）        |
| 9  | unpublish              | `unpublish(id: string, reason: string): Promise<Product>`                                                         | 下架产品（status='inactive'）                   |
| 10 | revertToDraft          | `revertToDraft(id: string): Promise<Product>`                                                                     | 将下架产品恢复为草稿（inactive → draft）        |
| 11 | remove                 | `remove(id: string): Promise<Product>`                                                                            | 逻辑删除产品（status='deleted'，仅限draft）     |
| 12 | restore                | `restore(id: string): Promise<Product>`                                                                           | 恢复已删除的产品（deleted → draft）             |
| 13 | batchUpdate            | `batchUpdate(dto: BatchOperationDto): Promise<BatchResult>`                                                       | 批量上架/下架（独立事务，最多50个）             |
| 14 | updateProductSortOrder | `updateProductSortOrder(updates: Array<{productId: string; sortOrder: number}>): Promise<void>`                  | 批量更新产品排序顺序                            |
| 15 | generateSnapshot       | `generateSnapshot(id: string): Promise<ProductSnapshot>`                                                          | 生成产品快照（展开服务包，用于合同）            |

**实现位置：** `src/domains/catalog/product/services/product.service.ts`

**方法说明：**

- **`search(filter, pagination, sort)`** 统一处理所有查询场景：
  - **filter** - 筛选条件对象：
    - `status: 'draft' | 'active' | 'deleted'` - 按状态筛选
    - `userType: 'undergraduate' | 'graduate' | 'working'` - 按学历维度筛选
    - `keyword: string` - 关键词搜索
    - `includeDeleted: boolean` - 是否包含已删除产品（默认false）
  - **pagination** - 分页规则对象（可选，默认page=1, pageSize=20）
  - **sort** - 排序规则对象（可选，默认按sortOrder ASC）
- **`recommend(filter)`** - 简化的推荐功能，基于ProductFilterDto筛选，不涉及个性化算法

---

## 5. DTO 定义

### 5.1 通用 DTO

#### 5.1.1 分页和排序

```typescript
// 分页规则对象（可选，不传则查询全部）
interface PaginationDto {
  page: number;      // 页码，从1开始
  pageSize: number;  // 每页数量
}

// 排序规则对象（可选）
interface SortDto {
  field: string;           // 排序字段名
  order: 'asc' | 'desc';   // 排序方向
}

// 分页结果对象
interface PaginatedResult<T> {
  data: T[];           // 数据列表
  total: number;       // 总记录数
  page: number;        // 当前页码
  pageSize: number;    // 每页数量
  totalPages: number;  // 总页数
}
```

### 5.2 Service DTOs

#### 5.2.1 CreateServiceDto

```typescript
interface CreateServiceDto {
  // 服务标识
  code: string;                // 服务编码，如 'resume_review'
  serviceType: ServiceType;    // 服务类型

  // 基本信息
  name: string;                // 服务名称，如 '简历修改'
  description?: string;        // 服务描述
  coverImage?: string;         // 封面图片URL

  // 计费配置
  billingMode: BillingMode;    // 计费模式（阶段性计费的具体阶段由Financial Domain管理）
  defaultUnit: ServiceUnit;    // 默认单位

  // 服务配置
  requiresEvaluation?: boolean;      // 是否需要评价后计费
  requiresMentorAssignment?: boolean; // 是否需要分配导师

  // 元数据
  metadata?: {
    features?: string[];        // 服务特点
    deliverables?: string[];    // 交付物
    duration?: number;          // 预计时长（分钟）
    prerequisites?: string[];   // 前置条件
  };
}
```

**验证规则：**

- ✅ `code` 必填，全局唯一
- ✅ `serviceType` 必填，全局唯一
- ✅ `name` 必填
- ✅ `billingMode` 必填
- ✅ `defaultUnit` 必填

#### 5.2.2 UpdateServiceDto

```typescript
interface UpdateServiceDto {
  // 基本信息（可选更新）
  name?: string;
  description?: string;
  coverImage?: string;

  // 计费配置（可选更新）
  billingMode?: BillingMode;
  defaultUnit?: ServiceUnit;

  // 服务配置（可选更新）
  requiresEvaluation?: boolean;
  requiresMentorAssignment?: boolean;

  // 元数据（可选更新）
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
    prerequisites?: string[];
  };
}
```

**验证规则：**

- ✅ 不允许更新 `code` 和 `serviceType`（创建后不可变）
- ✅ 至少提供一个字段
- ✅ 更新前检查服务是否被引用（如被引用，需谨慎更新）

#### 5.2.3 ServiceFilterDto

```typescript
interface ServiceFilterDto {
  keyword?: string;                         // 关键词搜索（name, code, description）
  serviceType?: ServiceType;                // 按服务类型筛选
  billingMode?: BillingMode;                // 按计费模式筛选
  status?: 'active' | 'inactive' | 'deleted'; // 按状态筛选
  includeDeleted?: boolean;                 // 是否包含已删除服务（默认false）
}
```

#### 5.2.4 FindOneServiceDto

```typescript
interface FindOneServiceDto {
  id?: string;                              // 服务ID
  code?: string;                            // 服务编码（唯一）
  // 支持通过id或code任一字段查询单条记录
  // 至少提供其中一个字段
}
```

**校验规则：**

- ✅ 必须提供至少一个查询字段（id 或 code）
- ✅ 支持通过 id 或 code 单独查询
- ✅ 如果同时提供多个字段，使用 AND 逻辑组合查询
- ✅ 查询结果包含所有状态的服务（包括 deleted）
- ✅ 未找到匹配记录时返回 null

#### 5.2.5 ServiceDetail（响应接口）

```typescript
interface ServiceDetail {
  // Service基础字段
  id: string;
  code: string;
  serviceType: ServiceType;
  name: string;
  description?: string;
  coverImage?: string;
  billingMode: BillingMode;
  defaultUnit: ServiceUnit;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  status: 'active' | 'inactive' | 'deleted';
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
    prerequisites?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

#### 5.2.5 ServiceSnapshot（快照接口）

```typescript
interface ServiceSnapshot {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  serviceType: ServiceType;
  billingMode: BillingMode;
  defaultUnit: ServiceUnit;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
  };
  snapshotAt: Date;
}
```

### 5.3 ServicePackage DTOs

#### 5.3.1 CreateServicePackageDto

```typescript
interface CreateServicePackageDto {
  // 服务包标识
  code: string;           // 服务包编码，如 'basic_package'
  name: string;           // 服务包名称，如 '求职基础包'
  description?: string;   // 服务包描述
  coverImage?: string;    // 封面图片URL

  // 元数据
  metadata?: {
    features?: string[];      // 服务包特点
    highlights?: string[];    // 亮点说明
    targetAudience?: string; // 目标用户
  };

  // 可选：创建时同时添加服务项
  items?: Array<{
    serviceId: string;   // 服务ID
    quantity: number;    // 数量
    unit: ServiceUnit;   // 单位
    sortOrder?: number;  // 排序顺序
  }>;
}
```

**验证规则：**

- ✅ `code` 必填，全局唯一
- ✅ `name` 必填
- ✅ 如果提供 `items`，每个 `serviceId` 必须存在且有效

#### 5.3.2 UpdateServicePackageDto

```typescript
interface UpdateServicePackageDto {
  // 基本信息（可选更新）
  name?: string;
  description?: string;
  coverImage?: string;

  // 元数据（可选更新）
  metadata?: {
    features?: string[];
    highlights?: string[];
    targetAudience?: string;
  };
}
```

**验证规则：**

- ✅ 不允许更新 `code`（创建后不可变）
- ✅ 至少提供一个字段

#### 5.3.3 AddServiceDto

```typescript
interface AddServiceDto {
  serviceId: string;   // 服务ID
  quantity: number;    // 数量
  unit: ServiceUnit;   // 单位
  sortOrder?: number;  // 排序顺序
}
```

**验证规则：**

- ✅ `serviceId` 必须存在且有效
- ✅ `quantity` 必须大于 0
- ✅ 同一服务不能重复添加到同一服务包

#### 5.3.4 PackageFilterDto

```typescript
interface PackageFilterDto {
  keyword?: string;                           // 关键词搜索（name, code, description）
  status?: 'active' | 'inactive' | 'deleted'; // 按状态筛选
  includeDeleted?: boolean;                   // 是否包含已删除服务包（默认false）
}
```

#### 5.3.5 FindOneServicePackageDto

```typescript
interface FindOneServicePackageDto {
  id?: string;                              // 服务包ID
  code?: string;                            // 服务包编码（唯一）
  // 支持通过id或code任一字段查询单条记录
  // 至少提供其中一个字段
}
```

**校验规则：**

- ✅ 必须提供至少一个查询字段（id 或 code）
- ✅ 支持通过 id 或 code 单独查询
- ✅ 如果同时提供多个字段，使用 AND 逻辑组合查询
- ✅ 查询结果包含所有状态的服务包（包括 deleted）
- ✅ 未找到匹配记录时返回 null

#### 5.3.6 ServicePackageDetail（响应接口）

```typescript
interface ServicePackageDetail {
  // ServicePackage基础字段
  id: string;
  code: string;
  name: string;
  description?: string;
  coverImage?: string;
  status: 'active' | 'inactive' | 'deleted';
  metadata?: {
    features?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;

  // 展开的服务列表（完整嵌套对象）
  items: Array<{
    id: string;
    serviceId: string;
    service: ServiceDetail;  // 完整的Service对象
    quantity: number;
    unit: ServiceUnit;
    sortOrder: number;
  }>;
}
```

#### 5.3.6 ServicePackageSnapshot（快照接口）

```typescript
interface ServicePackageSnapshot {
  packageId: string;
  packageName: string;
  packageCode: string;

  // 展开的服务列表
  services: Array<{
    serviceId: string;
    serviceName: string;
    serviceCode: string;
    serviceType: ServiceType;
    quantity: number;
    unit: ServiceUnit;
    billingMode: BillingMode;
  }>;

  snapshotAt: Date;
}
```

### 5.4 Product DTOs

#### 5.4.1 CreateProductDto

```typescript
interface CreateProductDto {
  // 基本信息
  name: string;                  // 产品名称
  code: string;                  // 产品编码
  description?: string;          // 产品描述
  coverImage?: string;           // 封面图片URL

  // 目标用户
  targetUserTypes?: Array<'undergraduate' | 'graduate' | 'working'>;

  // 定价信息
  price: number;                 // 价格（必须 > 0）
  currency?: 'USD' | 'CNY';      // 货币代码，默认 'USD'

  // 有效期（NULL表示长期有效）
  validityDays?: number;         // 有效期（天，如提供必须 > 0，不提供表示长期有效）

  // 营销标签
  marketingLabels?: Array<'hot' | 'new' | 'recommended'>;

  // 元数据
  metadata?: {
    features?: string[];         // 产品特点
    highlights?: string[];       // 亮点说明
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
  };

  // 可选：创建时同时添加产品项
  items?: Array<{
    type: 'service' | 'service_package';
    referenceId: string;  // type='service' → serviceId, type='service_package' → packageId
    quantity: number;
    unit: ServiceUnit;
    sortOrder?: number;
  }>;
}
```

**验证规则：**

- ✅ `code` 必填，全局唯一
- ✅ `name` 必填
- ✅ `price` 必须大于 0
- ✅ `currency` 只能是 'USD' 或 'CNY'
- ✅ `validityDays` 如果提供，必须大于 0；不提供表示长期有效
- ✅ 如果提供 `items`，每个 `referenceId` 必须存在且有效
- ✅ 如果 `items` 中包含 `type='service_package'`，其 `quantity` 必须为 1

#### 5.4.2 UpdateProductDto

```typescript
interface UpdateProductDto {
  // 基本信息（可选更新）
  name?: string;
  description?: string;
  coverImage?: string;

  // 目标用户（可选更新）
  targetUserTypes?: Array<'undergraduate' | 'graduate' | 'working'>;

  // 定价信息（可选更新）
  price?: number;
  currency?: string;

  // 有效期（可选更新）
  validityDays?: number;

  // 营销标签（可选更新）
  marketingLabels?: Array<'hot' | 'new' | 'recommended'>;

  // 元数据（可选更新）
  metadata?: {
    features?: string[];
    highlights?: string[];
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
  };
}
```

**验证规则：**

- ✅ 只能更新未发布过的草稿产品（status='draft' 且 publishedAt IS NULL）
- ✅ 不允许更新 `code`（创建后不可变）
- ✅ 如果更新 `price`，必须大于 0
- ✅ 如果更新 `currency`，只能是 'USD' 或 'CNY'
- ✅ 如果更新 `validityDays`，必须大于 0 或 NULL（NULL表示长期有效）
- ✅ 至少提供一个字段

#### 5.4.3 AddProductItemDto

```typescript
interface AddProductItemDto {
  type: 'service' | 'service_package';
  referenceId: string;  // type='service' → serviceId, type='service_package' → packageId
  quantity: number;
  unit: ServiceUnit;
  sortOrder?: number;   // 可选，不提供时自动递增
}
```

**验证规则：**

- ✅ `referenceId` 必须存在且有效
- ✅ `quantity` 必须大于 0
- ✅ 如果 `type='service_package'`，`quantity` 必须为 1
- ✅ 同一产品不能重复添加同一服务或服务包
- ✅ `sortOrder` 如果不提供，自动设置为 max(sortOrder) + 1

#### 5.4.4 PublishProductDto

```typescript
interface PublishProductDto {
  scheduledPublishAt?: Date;  // 可选：计划上架时间（仅作元数据，不自动触发）
                              // 不提供则表示立即上架
}
```

**验证规则：**

- ✅ 产品必须包含至少一个产品项
- ✅ 所有关联的服务和服务包必须是 `status = 'active'`
- ✅ `scheduledPublishAt` 仅作为元数据记录，不影响上架操作

#### 5.4.5 ProductFilterDto

```typescript
interface ProductFilterDto {
  keyword?: string;                                        // 关键词搜索（name, code, description）
  status?: 'draft' | 'active' | 'inactive' | 'deleted';   // 按状态筛选
  userType?: 'undergraduate' | 'graduate' | 'working';    // 按目标用户类型筛选
  marketingLabel?: 'hot' | 'new' | 'recommended';         // 按营销标签筛选
  includeDeleted?: boolean;                               // 是否包含已删除产品（默认false）
}
```

#### 5.4.6 FindOneProductDto

```typescript
interface FindOneProductDto {
  id?: string;                              // 产品ID
  code?: string;                            // 产品编码（唯一）
  // 支持通过id或code任一字段查询单条记录
  // 至少提供其中一个字段
}
```

**校验规则：**

- ✅ 必须提供至少一个查询字段（id 或 code）
- ✅ 支持通过 id 或 code 单独查询
- ✅ 如果同时提供多个字段，使用 AND 逻辑组合查询
- ✅ 查询结果包含所有状态的产品（包括 deleted）
- ✅ 未找到匹配记录时返回 null

#### 5.4.7 BatchOperationDto

```typescript
interface BatchOperationDto {
  productIds: string[];           // 产品ID列表（最多50个）
  operation: 'publish' | 'unpublish';  // 操作类型
  scheduledPublishAt?: Date;      // 仅当 operation='publish' 时有效（仅作备忘录）
  reason?: string;                // 仅当 operation='unpublish' 时有效
}

interface BatchResult {
  success: number;                // 成功数量
  failed: number;                 // 失败数量
  errors: Array<{
    productId: string;
    error: string;
  }>;
}
```

**验证规则：**

- ✅ `productIds` 不能为空，长度必须在 1-50 之间（通用批量操作限制）
- ✅ 所有产品ID必须存在
- ✅ 如果 `operation='publish'`，所有产品必须是 `status='draft'`
- ✅ 如果 `operation='unpublish'`，所有产品必须是 `status='active'`
- ✅ `scheduledPublishAt` 仅作为元数据记录，不影响上架操作
- ✅ 采用独立事务策略，允许部分成功
- ✅ 不支持重试机制，前端需展示详细失败信息供人工处理

#### 5.4.7 ProductDetail（响应接口）

```typescript
interface ProductDetail {
  // Product基础字段
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImage?: string;
  targetUserTypes?: Array<'undergraduate' | 'graduate' | 'working'>;
  price: string;
  currency: 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY';
  validityDays?: number;
  marketingLabels?: Array<'hot' | 'new' | 'recommended'>;
  status: 'draft' | 'active' | 'inactive' | 'deleted';
  scheduledPublishAt?: Date;
  publishedAt?: Date;
  unpublishedAt?: Date;
  sortOrder: number;
  metadata?: {
    features?: string[];
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  publishedBy?: string;
  unpublishedBy?: string;

  // 完全展开的产品项（嵌套对象）
  items: Array<ProductItemDetail>;
}

interface ProductItemDetail {
  id: string;
  type: 'service' | 'service_package';
  quantity: number;
  unit: ServiceUnit;
  sortOrder: number;

  // 完整的嵌套对象
  service?: ServiceDetail;              // 当 type='service'
  servicePackage?: ServicePackageDetail; // 当 type='service_package'
}
```

#### 5.4.8 ProductSnapshot（快照接口）

```typescript
interface ProductSnapshot {
  productId: string;
  productName: string;
  productCode: string;
  price: string;
  currency: 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY';
  validityDays?: number;

  // 展开后的扁平化服务列表（服务包已展开为具体服务）
  services: Array<{
    serviceId: string;
    serviceName: string;
    serviceCode: string;
    serviceType: ServiceType;
    quantity: number;
    unit: ServiceUnit;
    billingMode: BillingMode;
    sourceType: 'direct' | 'from_package';  // 直接引用还是来自服务包
    sourcePackageId?: string;               // 如果来自服务包，记录包ID
    sourcePackageName?: string;             // 如果来自服务包，记录包名称
  }>;

  snapshotAt: Date;
}
```

---

## 6. 业务规则与验证

### 6.1 Service 业务规则

#### 6.1.1 创建规则

| 规则       | 说明                                     | 错误代码                   |
| ---------- | ---------------------------------------- | -------------------------- |
| 唯一性检查 | `code` 和 `serviceType` 必须全局唯一   | `SERVICE_CODE_DUPLICATE` |

#### 6.1.2 更新规则

| 规则       | 说明                                       | 错误代码                    |
| ---------- | ------------------------------------------ | --------------------------- |
| 不可变字段 | `code` 和 `serviceType` 创建后不可修改 | `SERVICE_FIELD_IMMUTABLE` |
| 引用检查   | 服务被引用时，允许更新但给出警告           | `SERVICE_IN_USE_WARNING`  |

#### 6.1.3 状态管理规则

| 规则       | 说明                                                  | 错误代码                     |
| ---------- | ----------------------------------------------------- | ---------------------------- |
| 状态转换   | 支持 active ↔ inactive, active/inactive → deleted   | -                            |
| 禁用检查   | 禁用时检查引用，允许禁用但给出警告                    | `SERVICE_IN_USE_WARNING`   |
| 删除检查   | 删除前检查引用，不允许删除被引用的服务                | `SERVICE_IN_USE`           |
| 状态约束   | 只能删除 `status != 'active'` 的服务                | `SERVICE_ACTIVE_CANNOT_DELETE` |

#### 6.1.4 恢复规则

| 规则     | 说明                                       | 错误代码                 |
| -------- | ------------------------------------------ | ------------------------ |
| 状态检查 | 只能恢复 `status='deleted'` 的服务       | `SERVICE_NOT_DELETED` |
| 恢复目标 | 恢复后状态为 `inactive`（需手动激活）    | -                        |

### 6.2 ServicePackage 业务规则

#### 6.2.1 创建规则

| 规则       | 说明                                                                | 错误代码                   |
| ---------- | ------------------------------------------------------------------- | -------------------------- |
| 唯一性检查 | `code` 必须全局唯一                                               | `PACKAGE_CODE_DUPLICATE` |
| 服务项验证 | 如果提供 `items`，所有 `serviceId` 必须存在且 `status='active'` | `SERVICE_NOT_FOUND`      |

#### 6.2.2 添加服务规则

| 规则       | 说明                             | 错误代码                       |
| ---------- | -------------------------------- | ------------------------------ |
| 服务存在性 | `serviceId` 必须存在           | `SERVICE_NOT_FOUND`          |
| 服务状态   | 服务必须是 `status='active'`   | `SERVICE_NOT_ACTIVE`         |
| 唯一性检查 | 同一服务不能重复添加到同一服务包 | `SERVICE_ALREADY_IN_PACKAGE` |
| 数量验证   | `quantity` 必须大于 0          | `INVALID_QUANTITY`           |

#### 6.2.3 移除服务规则

| 规则         | 说明                                 | 错误代码                   |
| ------------ | ------------------------------------ | -------------------------- |
| 最少服务数   | 服务包至少保留 1 个服务              | `PACKAGE_MIN_SERVICES`   |
| 产品引用检查 | 如果服务包被产品引用，移除服务需谨慎 | `PACKAGE_IN_USE_WARNING` |

#### 6.2.4 状态管理规则

| 规则       | 说明                                                    | 错误代码                      |
| ---------- | ------------------------------------------------------- | ----------------------------- |
| 状态转换   | 支持 active ↔ inactive, active/inactive → deleted     | -                             |
| 禁用检查   | 禁用时检查product引用，允许禁用但给出警告             | `PACKAGE_IN_USE_WARNING`    |
| 删除检查   | 删除前检查product引用，不检查service_package_items引用 | `PACKAGE_IN_USE`            |
| 状态约束   | 只能删除 `status != 'active'` 的服务包                | `PACKAGE_ACTIVE_CANNOT_DELETE` |

**特殊说明：** ServicePackage 删除时不检查是否被其他 ServicePackage 引用（通过 service_package_items），这是设计决策，避免 package 嵌套引用带来的复杂性。

#### 6.2.5 恢复规则

| 规则     | 说明                                         | 错误代码                   |
| -------- | -------------------------------------------- | -------------------------- |
| 状态检查 | 只能恢复 `status='deleted'` 的服务包       | `PACKAGE_NOT_DELETED`    |
| 恢复目标 | 恢复后状态为 `inactive`（需手动激活）      | -                          |

### 6.3 Product 业务规则

#### 6.3.1 创建规则

| 规则       | 说明                                       | 错误代码                   |
| ---------- | ------------------------------------------ | -------------------------- |
| 唯一性检查 | `code` 必须全局唯一                      | `PRODUCT_CODE_DUPLICATE` |
| 价格验证   | `price` 必须大于 0                       | `INVALID_PRICE`          |
| 有效期验证 | `validityDays` 如果提供，必须大于 0；不提供表示长期有效 | `INVALID_VALIDITY_DAYS`  |
| 产品项验证 | 如果提供 `items`，所有引用必须存在且有效 | `REFERENCE_NOT_FOUND`    |

#### 6.3.2 更新规则

| 规则       | 说明                                                | 错误代码                      |
| ---------- | --------------------------------------------------- | ----------------------------- |
| 状态检查   | 只能更新草稿状态的产品（status='draft'）  | `PRODUCT_NOT_DRAFT` |
| 不可变字段 | `code` 创建后不可修改                             | `PRODUCT_FIELD_IMMUTABLE`   |
| 价格验证   | 如果更新 `price`，必须大于 0                      | `INVALID_PRICE`             |
| 货币验证   | 如果更新 `currency`，只能是 'USD' 或 'CNY'        | `INVALID_CURRENCY`          |
| 有效期验证 | 如果更新 `validityDays`，必须大于 0 或 NULL      | `INVALID_VALIDITY_DAYS`     |

#### 6.3.3 添加产品项规则

| 规则         | 说明                                           | 错误代码                      |
| ------------ | ---------------------------------------------- | ----------------------------- |
| 引用存在性   | `referenceId` 必须存在                       | `REFERENCE_NOT_FOUND`       |
| 引用状态     | 引用的服务或服务包必须是 `status='active'`   | `REFERENCE_NOT_ACTIVE`      |
| 唯一性检查   | 同一产品不能重复添加同一服务或服务包           | `ITEM_ALREADY_IN_PRODUCT`   |
| 数量验证     | `quantity` 必须大于 0                        | `INVALID_QUANTITY`          |
| 服务包数量   | 服务包的 `quantity` 必须为 1                 | `PACKAGE_QUANTITY_MUST_BE_ONE` |

#### 6.3.4 移除产品项规则

| 规则       | 说明                    | 错误代码              |
| ---------- | ----------------------- | --------------------- |
| 最少产品项 | 产品至少保留 1 个产品项 | `PRODUCT_MIN_ITEMS` |

#### 6.3.5 上架规则

| 规则         | 说明                                               | 错误代码                |
| ------------ | -------------------------------------------------- | ----------------------- |
| 状态检查     | 只能上架草稿状态的产品                             | `PRODUCT_NOT_DRAFT`   |
| 产品项检查   | 产品必须包含至少 1 个产品项                        | `PRODUCT_NO_ITEMS`    |
| 引用状态检查 | 所有关联的服务和服务包必须是 `status='active'`   | `REFERENCE_NOT_ACTIVE` |
| 定时说明     | `scheduledPublishAt` 仅作元数据，不自动触发上架  | -                       |

#### 6.3.6 下架规则

| 规则     | 说明                                         | 错误代码               |
| -------- | -------------------------------------------- | ---------------------- |
| 状态检查 | 只能下架上架状态的产品                       | `PRODUCT_NOT_ACTIVE` |
| 原因必填 | 下架时必须提供原因                           | `REASON_REQUIRED`    |
| 下架效果 | 下架后status='inactive'，保留publishedAt    | -                      |

#### 6.3.7 恢复为草稿规则

| 规则     | 说明                                         | 错误代码                  |
| -------- | -------------------------------------------- | ------------------------- |
| 状态检查 | 只能将下架状态的产品恢复为草稿               | `PRODUCT_NOT_INACTIVE`  |
| 恢复目标 | 恢复后status='draft'，可再次编辑和上架      | -                         |

#### 6.3.8 删除规则

| 规则     | 说明                                       | 错误代码                      |
| -------- | ------------------------------------------ | ----------------------------- |
| 状态检查 | 只能删除未发布过的草稿产品（publishedAt IS NULL） | `PRODUCT_ALREADY_PUBLISHED` |
| 删除效果 | 设置status='deleted'，实现逻辑删除       | -                             |

#### 6.3.9 恢复已删除产品规则

| 规则     | 说明                                      | 错误代码                 |
| -------- | ----------------------------------------- | ------------------------ |
| 状态检查 | 只能恢复 `status='deleted'` 的产品      | `PRODUCT_NOT_DELETED` |
| 恢复目标 | 恢复后状态为 `draft`                    | -                        |

**特殊说明：** 删除产品时不跨域检查合同引用，因为合同创建时已生成产品快照，独立存储。

### 6.4 错误代码清单

本节列出所有业务规则验证的错误代码，便于前后端统一处理错误信息。

#### 6.4.1 Service 相关错误

| 错误代码                     | HTTP状态码 | 说明                                   |
| ---------------------------- | ---------- | -------------------------------------- |
| `SERVICE_CODE_DUPLICATE`   | 409        | 服务编码已存在                         |
| `SERVICE_TYPE_DUPLICATE`   | 409        | 服务类型已存在                         |
| `SERVICE_NOT_FOUND`        | 404        | 服务不存在                             |
| `SERVICE_DELETED`          | 410        | 服务已被删除                           |
| `SERVICE_FIELD_IMMUTABLE`  | 400        | 服务字段不可修改（code/serviceType）  |
| `SERVICE_IN_USE_WARNING`   | 200        | 服务被引用，允许操作但给出警告         |
| `SERVICE_IN_USE`           | 400        | 服务被引用，不允许删除                 |
| `SERVICE_ACTIVE_CANNOT_DELETE` | 400    | 无法删除active状态的服务               |
| `SERVICE_NOT_DELETED`      | 400        | 服务未被删除，无法恢复                 |
| `SERVICE_NOT_ACTIVE`       | 400        | 服务状态不是active                     |

#### 6.4.2 ServicePackage 相关错误

| 错误代码                           | HTTP状态码 | 说明                                   |
| ---------------------------------- | ---------- | -------------------------------------- |
| `PACKAGE_CODE_DUPLICATE`         | 409        | 服务包编码已存在                       |
| `PACKAGE_NOT_FOUND`              | 404        | 服务包不存在                           |
| `PACKAGE_DELETED`                | 410        | 服务包已被删除                         |
| `PACKAGE_IN_USE_WARNING`         | 200        | 服务包被引用，允许操作但给出警告       |
| `PACKAGE_IN_USE`                 | 400        | 服务包被引用，不允许删除               |
| `PACKAGE_ACTIVE_CANNOT_DELETE`   | 400        | 无法删除active状态的服务包             |
| `PACKAGE_NOT_DELETED`            | 400        | 服务包未被删除，无法恢复               |
| `PACKAGE_MIN_SERVICES`           | 400        | 服务包至少保留1个服务                  |
| `SERVICE_ALREADY_IN_PACKAGE`     | 400        | 服务已存在于该服务包中                 |

#### 6.4.3 Product 相关错误

| 错误代码                          | HTTP状态码 | 说明                                   |
| --------------------------------- | ---------- | -------------------------------------- |
| `PRODUCT_CODE_DUPLICATE`        | 409        | 产品编码已存在                         |
| `PRODUCT_NOT_FOUND`             | 404        | 产品不存在                             |
| `PRODUCT_DELETED`               | 410        | 产品已被删除                           |
| `PRODUCT_NOT_DRAFT`             | 400        | 产品不是草稿状态                       |
| `PRODUCT_NOT_ACTIVE`            | 400        | 产品不是上架状态                       |
| `PRODUCT_NOT_INACTIVE`          | 400        | 产品不是下架状态                       |
| `PRODUCT_NOT_DELETED`           | 400        | 产品未被删除，无法恢复                 |
| `PRODUCT_ALREADY_PUBLISHED`     | 400        | 产品已发布过，不可编辑                 |
| `PRODUCT_FIELD_IMMUTABLE`       | 400        | 产品字段不可修改（code）               |
| `PRODUCT_NO_ITEMS`              | 400        | 产品必须包含至少1个产品项              |
| `PRODUCT_MIN_ITEMS`             | 400        | 产品至少保留1个产品项                  |
| `PRODUCT_IN_USE`                | 400        | 产品被合同引用，不允许删除             |
| `ITEM_ALREADY_IN_PRODUCT`       | 400        | 产品项已存在于该产品中                 |
| `PACKAGE_QUANTITY_MUST_BE_ONE`  | 400        | 服务包的quantity必须为1                |

#### 6.4.4 通用验证错误

| 错误代码                    | HTTP状态码 | 说明                                   |
| --------------------------- | ---------- | -------------------------------------- |
| `INVALID_PRICE`           | 400        | 价格必须大于0                          |
| `INVALID_CURRENCY`        | 400        | 货币代码无效（仅支持USD/CNY）          |
| `INVALID_VALIDITY_DAYS`   | 400        | 有效期必须大于0或NULL                  |
| `INVALID_QUANTITY`        | 400        | 数量必须大于0                          |
| `REFERENCE_NOT_FOUND`     | 404        | 引用的资源不存在                       |
| `REFERENCE_NOT_ACTIVE`    | 400        | 引用的资源状态不是active               |
| `REASON_REQUIRED`         | 400        | 必须提供操作原因                       |

#### 6.4.5 Metadata 验证建议

以下字段建议值（不强制验证，MVP阶段）：

- **features**：建议不超过10项，每项不超过200字符
- **deliverables**：建议不超过20项，每项不超过500字符
- **duration**：建议范围 15-480 分钟
- **faqs**：建议不超过20条，每条问题/答案不超过1000字符

---

## 7. 状态机设计

### 7.1 Product 状态机

```
┌─────────────────────────────────────────────────────────────┐
│                    Product 状态机                            │
└─────────────────────────────────────────────────────────────┘

         create()
           │
           ▼
      ┌────────┐    publish()        ┌────────┐
      │ draft  │ ──────────────────▶  │ active │
      │ (草稿) │                      │ (上架) │
      └───┬────┘                      └───┬────┘
          │                               │
          │ remove()                      │ unpublish()
          │ (仅未发布过的草稿)             │
          ▼                               ▼
      ┌─────────┐                    ┌──────────┐
      │ deleted │                    │ inactive │
      │(已删除) │                    │ (已下架)  │
      └────┬────┘                    └─────┬────┘
           │                               │
           │ restore()                     │ revertToDraft()
           │                               │
           └──────────▶ draft ◀────────────┘


状态说明：
- draft: 草稿状态（status='draft'），可编辑、可删除、可上架
  - 未发布过（publishedAt IS NULL）：正常草稿
  - 从inactive恢复（publishedAt NOT NULL）：已发布过的产品恢复为草稿，可重新编辑和上架
- active: 上架状态，对客户可见，不可编辑、不可删除
- inactive: 下架状态，不可见，保留publishedAt，不可编辑（需先revertToDraft）
- deleted: 逻辑删除状态，可恢复为draft
```

**状态转换规则：**

| 当前状态    | 允许操作          | 目标状态    | 备注                                     |
| ----------- | ----------------- | ----------- | ---------------------------------------- |
| `draft`   | `publish()`     | `active`  | scheduledPublishAt仅作备忘录             |
| `draft`   | `update()`      | `draft`   | 只能更新status='draft'的产品             |
| `draft`   | `remove()`      | `deleted` | 仅限publishedAt IS NULL的草稿            |
| `active`  | `unpublish()`   | `inactive`| 保留publishedAt                          |
| `inactive`| `revertToDraft()`| `draft`   | 可再次编辑和上架                         |
| `deleted` | `restore()`     | `draft`   | 恢复为草稿状态                           |

**状态约束：**

| 状态        | 可编辑  | 可删除                        | 对客户可见 | sortOrder管理 |
| ----------- | ------- | ----------------------------- | ---------- | ------------- |
| `draft`   | ✅ status='draft' | ✅ (仅未发布过)       | ❌         | 不参与排序    |
| `active`  | ❌      | ❌                            | ✅         | 参与排序      |
| `inactive`| ❌      | ❌                            | ❌         | 不参与排序    |
| `deleted` | ❌      | ❌                            | ❌         | 不参与排序    |

### 7.2 Service 和 ServicePackage 状态机

Service 和 ServicePackage 使用 `status` 枚举字段管理状态，支持三状态流转。

```
┌─────────────────────────────────────────────────────────────┐
│            Service / ServicePackage 状态机                   │
└─────────────────────────────────────────────────────────────┘

         create()
           │
           ▼
      ┌────────┐     updateStatus()     ┌──────────┐
      │ active │ ◀─────────────────────▶ │ inactive │
      │ (启用) │                         │  (禁用)  │
      └───┬────┘                         └────┬─────┘
          │                                   │
          │ remove()                          │ remove()
          ▼                                   ▼
      ┌─────────┐   restore()             ┌─────────┐
      │ deleted │ ──────────────────────▶  │ inactive│
      │(已删除) │                          │        │
      └─────────┘                          └─────────┘


状态说明：
- active: 启用状态，可被产品/服务包引用
- inactive: 禁用状态，不可被新引用（已引用的不受影响）
- deleted: 逻辑删除状态，可恢复到inactive
```

**状态转换规则：**

| 当前状态    | 允许操作        | 目标状态    | 备注                          |
| ----------- | --------------- | ----------- | ----------------------------- |
| `active`  | `updateStatus(inactive)` | `inactive` | 检查引用但允许，给出警告  |
| `inactive`| `updateStatus(active)`   | `active`   | -                             |
| `active`  | `remove()`      | `deleted` | 检查引用，不允许删除被引用的  |
| `inactive`| `remove()`      | `deleted` | 同上                          |
| `deleted` | `restore()`     | `inactive`| 恢复后需手动激活              |

**状态约束：**

| 状态        | 可被引用 | 可删除            | 备注                          |
| ----------- | -------- | ----------------- | ----------------------------- |
| `active`   | ✅       | ❌（如被引用）    | 禁用时允许但警告              |
| `inactive` | ❌       | ❌（如被引用）    | 新产品/服务包不可引用         |
| `deleted`  | ❌       | ❌                | 已逻辑删除，可恢复            |

---

## 8. 示例场景

### 8.1 场景1：创建基础服务

**业务需求：** 产品经理创建"简历修改"服务

**步骤：**

```typescript
// 1. 创建服务
const service = await serviceService.create({
  code: 'resume_review',
  serviceType: 'resume_review',
  name: '简历修改',
  description: '专业导师1对1修改简历',
  billingMode: 'one_time',
  defaultUnit: 'times',
  requiresEvaluation: false,
  requiresMentorAssignment: true,
  metadata: {
    features: [
      '1对1专属服务',
      '72小时内交付',
      '无限次修改直到满意',
    ],
    deliverables: [
      '修改后的简历文档',
      '修改说明报告',
    ],
    duration: 60, // 60分钟
  },
});

console.log(`服务创建成功: ${service.id}`);
```

### 8.2 场景2：创建服务包

**业务需求：** 产品经理创建"求职基础包"服务包

**步骤：**

```typescript
// 1. 创建服务包
const servicePackage = await servicePackageService.create({
  code: 'basic_package',
  name: '求职基础包',
  description: '包含求职必备的基础服务',
  items: [
    {
      serviceId: '<GAP分析服务ID>',
      quantity: 1,
      unit: 'times',
      sortOrder: 1,
    },
    {
      serviceId: '<简历修改服务ID>',
      quantity: 3,
      unit: 'times',
      sortOrder: 2,
    },
    {
      serviceId: '<推荐信服务ID>',
      quantity: 1,
      unit: 'times',
      sortOrder: 3,
    },
  ],
  metadata: {
    features: [
      '涵盖求职基础服务',
      '适合初级求职者',
    ],
    targetAudience: '本科生、研究生',
  },
});

console.log(`服务包创建成功: ${servicePackage.id}`);
```

### 8.3 场景3：创建产品并上架

**业务需求：** 产品经理创建"VIP全程服务"产品并立即上架

**步骤：**

```typescript
// 1. 创建产品（草稿状态）
const product = await productService.create({
  code: 'vip_full_service',
  name: 'VIP全程求职服务',
  description: '一站式求职服务，助你拿到Dream Offer',
  price: 5999.00,
  currency: 'USD',
  validityDays: 365,
  targetUserTypes: ['undergraduate', 'graduate'],
  marketingLabels: ['hot', 'recommended'],
  items: [
    {
      type: 'service_package',
      referenceId: '<求职基础包ID>',
      quantity: 1,
      unit: 'times',
      sortOrder: 1,
    },
    {
      type: 'service',
      referenceId: '<内推服务ID>',
      quantity: 3,
      unit: 'times',
      sortOrder: 2,
    },
  ],
  metadata: {
    features: [
      '包含求职基础包',
      '3次内推机会',
      '1年有效期',
    ],
    highlights: [
      '成功率高达85%',
      '平均3个月拿到Offer',
    ],
    faqs: [
      {
        question: '服务有效期多久？',
        answer: '购买后365天内有效',
      },
    ],
  },
});

console.log(`产品创建成功（草稿）: ${product.id}`);

// 2. 立即上架
const publishedProduct = await productService.publish(product.id, {});

console.log(`产品已上架: ${publishedProduct.publishedAt}`);
```

### 8.4 场景4：学生浏览产品

**业务需求：** 本科生学生浏览适合自己的产品

**步骤：**

```typescript
// 1. 查询已上架的产品（适合本科生）
const result = await productService.search(
  {
    status: 'active',
    userType: 'undergraduate',
  },
  {
    page: 1,
    pageSize: 20,
  },
  {
    field: 'sortOrder',
    order: 'asc',
  }
);

console.log(`找到 ${result.total} 个产品`);

// 2. 查看产品详情（通过 id 查询）
const productDetail = await productService.findOne({ id: result.data[0].id });

// 或者通过 code 查询
// const productDetail = await productService.findOne({ code: 'PROD_001' });

console.log('产品详情:', productDetail);
console.log('包含的服务和服务包:', productDetail.items);
```

### 8.5 场景5：定时上架产品

**业务需求：** 产品经理创建"双11特惠产品"，定时在11月11日00:00上架

**步骤：**

```typescript
// 1. 创建产品（草稿状态）
const product = await productService.create({
  code: 'double11_special',
  name: '双11特惠产品',
  description: '限时优惠，错过等一年',
  price: 3999.00,
  currency: 'USD',
  validityDays: 180,
  marketingLabels: ['hot', 'new'],
  items: [
    {
      type: 'service_package',
      referenceId: '<求职基础包ID>',
      quantity: 1,
      unit: 'times',
    },
  ],
});

// 2. 定时上架（2025-11-11 00:00:00）
const scheduledProduct = await productService.publish(product.id, {
  publishAt: new Date('2025-11-11T00:00:00Z'),
});

console.log(`产品已设置定时上架: ${scheduledProduct.scheduledPublishAt}`);
```

### 8.6 场景6：批量下架产品

**业务需求：** 产品经理批量下架过期产品

**步骤：**

```typescript
// 1. 批量下架
const result = await productService.batchUpdate({
  productIds: [
    '<产品ID1>',
    '<产品ID2>',
    '<产品ID3>',
  ],
  operation: 'unpublish',
  reason: '产品已过期，需要更新',
});

console.log(`成功下架: ${result.success} 个产品`);
console.log(`失败: ${result.failed} 个产品`);

if (result.failed > 0) {
  console.log('错误详情:', result.errors);
}
```

### 8.7 场景7：推荐产品

**业务需求：** 根据学生信息推荐适合的产品

**步骤：**

```typescript
// 1. 根据用户信息查询推荐产品（使用search的筛选功能）
// 假设学生是本科生
const recommendedProducts = await productService.search(
  {
    status: 'active',
    userType: 'undergraduate',
    marketingLabel: 'recommended',
  },
  {
    page: 1,
    pageSize: 10,
  },
  {
    field: 'sortOrder',
    order: 'asc',
  }
);

console.log(`为您推荐 ${recommendedProducts.total} 个产品`);

// 推荐策略说明：
// - 筛选已上架的产品（status='active'）
// - 按学生的学历类型筛选（userType='undergraduate'）
// - 优先展示推荐标签的产品（marketingLabel='recommended'）
// - 按产品排序顺序展示（sortOrder ASC）
//
// 高级推荐功能（AI驱动）可由上层BFF或AI服务实现：
// - 分析学生的目标行业与岗位
// - 分析学生的历史购买记录
// - 综合产品的热度和评价
```

---

## 9. 实现指南

### 9.1 目录结构

```
src/domains/catalog/
├── catalog.module.ts                      # 根模块
├── index.ts                               # 导出接口
│
├── service/                               # 服务管理模块
│   ├── service.module.ts
│   ├── index.ts
│   ├── services/
│   │   └── service.service.ts
│   ├── dto/
│   │   ├── create-service.dto.ts
│   │   ├── update-service.dto.ts
│   │   └── service-filter.dto.ts
│   └── interfaces/
│       └── service.interface.ts
│
├── service-package/                       # 服务包管理模块
│   ├── service-package.module.ts
│   ├── index.ts
│   ├── services/
│   │   └── service-package.service.ts
│   ├── dto/
│   │   ├── create-service-package.dto.ts
│   │   ├── update-service-package.dto.ts
│   │   ├── add-service.dto.ts
│   │   └── package-filter.dto.ts
│   └── interfaces/
│       ├── service-package.interface.ts
│       └── service-package-detail.interface.ts
│
└── product/                               # 产品管理模块
    ├── product.module.ts
    ├── index.ts
    ├── services/
    │   └── product.service.ts
    ├── dto/
    │   ├── create-product.dto.ts
    │   ├── update-product.dto.ts
    │   ├── add-product-item.dto.ts
    │   ├── publish-product.dto.ts
    │   ├── product-filter.dto.ts
    │   └── batch-operation.dto.ts
    └── interfaces/
        ├── product.interface.ts
        └── product-detail.interface.ts
```

### 9.2 模块依赖

```typescript
// src/domains/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { ServiceModule } from './service/service.module';
import { ServicePackageModule } from './service-package/service-package.module';
import { ProductModule } from './product/product.module';
import { DatabaseModule } from '@database/drizzle.module';

@Module({
  imports: [
    DatabaseModule,
    ServiceModule,
    ServicePackageModule,
    ProductModule,
  ],
  exports: [
    ServiceModule,
    ServicePackageModule,
    ProductModule,
  ],
})
export class CatalogModule {}
```

### 9.3 服务实现示例

#### 9.3.1 获取当前用户ID的方法

**方式1：使用自定义装饰器（推荐）**

```typescript
// src/shared/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // 假设AuthGuard已经注入了user对象
  },
);

// 在Service中使用
@Injectable()
export class ProductService {
  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    // 使用传入的 userId
  }
}

// 在Controller中调用
@Post()
async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
  return this.productService.create(dto, user.id);
}
```

**方式2：使用ClsService（推荐用于跨层访问）**

```typescript
// 安装依赖：npm install nestjs-cls
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ProductService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const userId = this.cls.get('userId');
    // 使用 userId
  }
}
```

#### 9.3.2 统一错误处理

**定义自定义异常类：**

```typescript
// src/domains/catalog/exceptions/catalog.exception.ts
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

// 错误消息映射表
export const CATALOG_ERROR_MESSAGES: Record<string, string> = {
  // Service 相关错误
  SERVICE_CODE_DUPLICATE: '服务编码已存在',
  SERVICE_TYPE_DUPLICATE: '服务类型已存在',
  SERVICE_NOT_FOUND: '服务不存在',
  SERVICE_DELETED: '服务已被删除',
  SERVICE_FIELD_IMMUTABLE: '服务字段不可修改',
  SERVICE_IN_USE_WARNING: '服务被引用，允许操作但给出警告',
  SERVICE_IN_USE: '服务被引用，不允许删除',
  SERVICE_ACTIVE_CANNOT_DELETE: '无法删除active状态的服务',
  SERVICE_NOT_DELETED: '服务未被删除，无法恢复',
  SERVICE_NOT_ACTIVE: '服务状态不是active',

  // ServicePackage 相关错误
  PACKAGE_CODE_DUPLICATE: '服务包编码已存在',
  PACKAGE_NOT_FOUND: '服务包不存在',
  PACKAGE_DELETED: '服务包已被删除',
  PACKAGE_IN_USE_WARNING: '服务包被引用，允许操作但给出警告',
  PACKAGE_IN_USE: '服务包被引用，不允许删除',
  PACKAGE_ACTIVE_CANNOT_DELETE: '无法删除active状态的服务包',
  PACKAGE_NOT_DELETED: '服务包未被删除，无法恢复',
  PACKAGE_MIN_SERVICES: '服务包至少保留1个服务',
  SERVICE_ALREADY_IN_PACKAGE: '服务已存在于该服务包中',

  // Product 相关错误
  PRODUCT_CODE_DUPLICATE: '产品编码已存在',
  PRODUCT_NOT_FOUND: '产品不存在',
  PRODUCT_DELETED: '产品已被删除',
  PRODUCT_NOT_DRAFT: '产品不是草稿状态',
  PRODUCT_NOT_ACTIVE: '产品不是上架状态',
  PRODUCT_NOT_INACTIVE: '产品不是下架状态',
  PRODUCT_NOT_DELETED: '产品未被删除，无法恢复',
  PRODUCT_ALREADY_PUBLISHED: '产品已发布过，不可编辑',
  PRODUCT_FIELD_IMMUTABLE: '产品字段不可修改',
  PRODUCT_NO_ITEMS: '产品必须包含至少1个产品项',
  PRODUCT_MIN_ITEMS: '产品至少保留1个产品项',
  PRODUCT_IN_USE: '产品被合同引用，不允许删除',
  ITEM_ALREADY_IN_PRODUCT: '产品项已存在于该产品中',
  PACKAGE_QUANTITY_MUST_BE_ONE: '服务包的quantity必须为1',

  // 通用验证错误
  INVALID_PRICE: '价格必须大于0',
  INVALID_CURRENCY: '货币代码无效（仅支持USD/CNY）',
  INVALID_VALIDITY_DAYS: '有效期必须大于0或NULL',
  INVALID_QUANTITY: '数量必须大于0',
  REFERENCE_NOT_FOUND: '引用的资源不存在',
  REFERENCE_NOT_ACTIVE: '引用的资源状态不是active',
  REASON_REQUIRED: '必须提供操作原因',
};

// 自定义异常基类
export class CatalogException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: 400,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || '未知错误',
    });
  }
}

// 特定异常类
export class CatalogNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: 404,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || '资源不存在',
    });
  }
}

export class CatalogConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: 409,
      code,
      message: message || CATALOG_ERROR_MESSAGES[code] || '资源冲突',
    });
  }
}
```

**在Service中使用：**

```typescript
import { CatalogException, CatalogNotFoundException, CatalogConflictException } from '../exceptions/catalog.exception';

// 示例1：产品编码重复
if (existing.length > 0) {
  throw new CatalogConflictException('PRODUCT_CODE_DUPLICATE');
}

// 示例2：产品不存在
if (!product) {
  throw new CatalogNotFoundException('PRODUCT_NOT_FOUND');
}

// 示例3：产品状态不符合要求
if (product.status !== 'draft') {
  throw new CatalogException('PRODUCT_NOT_DRAFT');
}

// 示例4：自定义错误消息
throw new CatalogException('PRODUCT_NO_ITEMS', '该产品没有配置任何服务项，无法上架');
```

**全局异常过滤器（可选）：**

```typescript
// src/shared/filters/catalog-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { CatalogException } from '@domains/catalog/exceptions/catalog.exception';

@Catch(CatalogException)
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: CatalogException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      statusCode: status,
      errorCode: exception.code,
      message: exceptionResponse.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

#### 9.3.3 ProductService 实现示例

```typescript
// src/domains/catalog/product/services/product.service.ts
import { Injectable } from '@nestjs/common';
import { DrizzleService } from '@database/drizzle.service';
import { products, productItems } from '@database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { CatalogException, CatalogNotFoundException, CatalogConflictException } from '../exceptions/catalog.exception';

@Injectable()
export class ProductService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * 创建产品（草稿状态）
   * @param dto 创建产品DTO
   * @param userId 当前用户ID（从Controller传入）
   */
  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    // 1. 验证产品编码唯一性
    const existing = await this.drizzle.db
      .select()
      .from(products)
      .where(eq(products.code, dto.code))
      .limit(1);

    if (existing.length > 0) {
      throw new CatalogConflictException('PRODUCT_CODE_DUPLICATE');
    }

    // 2. 验证价格和有效期
    if (dto.price <= 0) {
      throw new CatalogException('INVALID_PRICE');
    }

    if (dto.validityDays !== undefined && dto.validityDays !== null && dto.validityDays <= 0) {
      throw new CatalogException('INVALID_VALIDITY_DAYS');
    }

    // 3. 如果提供了产品项，验证引用存在性
    if (dto.items && dto.items.length > 0) {
      await this.validateProductItems(dto.items);
    }

    // 4. 创建产品
    const [product] = await this.drizzle.db
      .insert(products)
      .values({
        name: dto.name,
        code: dto.code,
        description: dto.description,
        coverImage: dto.coverImage,
        targetUserTypes: dto.targetUserTypes,
        price: dto.price.toString(),
        currency: dto.currency || 'USD',
        validityDays: dto.validityDays,
        marketingLabels: dto.marketingLabels,
        status: 'draft',
        metadata: dto.metadata,
        createdBy: userId,
      })
      .returning();

    // 5. 如果提供了产品项，创建关联记录
    if (dto.items && dto.items.length > 0) {
      await this.drizzle.db.insert(productItems).values(
        dto.items.map((item, index) => ({
          productId: product.id,
          type: item.type,
          referenceId: item.referenceId,
          quantity: item.quantity,
          unit: item.unit,
          sortOrder: item.sortOrder ?? index,
        }))
      );
    }

    return product;
  }

  /**
   * 上架产品
   * @param id 产品ID
   * @param dto 发布配置DTO
   * @param userId 当前用户ID（从Controller传入）
   */
  async publish(id: string, dto: PublishProductDto, userId: string): Promise<Product> {
    // 1. 查询产品
    const [product] = await this.drizzle.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new CatalogNotFoundException('PRODUCT_NOT_FOUND');
    }

    // 2. 验证产品状态
    if (product.status !== 'draft') {
      throw new CatalogException('PRODUCT_NOT_DRAFT');
    }

    // 3. 验证产品包含至少一个产品项
    const items = await this.drizzle.db
      .select()
      .from(productItems)
      .where(eq(productItems.productId, id));

    if (items.length === 0) {
      throw new CatalogException('PRODUCT_NO_ITEMS');
    }

    // 4. 验证所有引用的服务和服务包是否启用
    await this.validateReferencesActive(items);

    // 5. 确定上架时间（立即上架，scheduledPublishAt仅作备忘录）
    const publishAt = new Date();

    // 6. 更新产品状态
    const [updatedProduct] = await this.drizzle.db
      .update(products)
      .set({
        status: 'active',
        publishedAt: publishAt,
        scheduledPublishAt: dto.scheduledPublishAt,
        publishedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  }

  /**
   * 验证产品项引用的存在性
   */
  private async validateProductItems(items: AddProductItemDto[]): Promise<void> {
    for (const item of items) {
      if (item.type === 'service') {
        const service = await this.drizzle.db
          .select()
          .from(services)
          .where(eq(services.id, item.referenceId))
          .limit(1);

        if (service.length === 0) {
          throw new CatalogNotFoundException('SERVICE_NOT_FOUND', `服务不存在: ${item.referenceId}`);
        }

        if (service[0].status !== 'active') {
          throw new CatalogException('SERVICE_NOT_ACTIVE', `服务未启用: ${item.referenceId}`);
        }
      } else if (item.type === 'service_package') {
        const servicePackage = await this.drizzle.db
          .select()
          .from(servicePackages)
          .where(eq(servicePackages.id, item.referenceId))
          .limit(1);

        if (servicePackage.length === 0) {
          throw new CatalogNotFoundException('PACKAGE_NOT_FOUND', `服务包不存在: ${item.referenceId}`);
        }

        if (servicePackage[0].status !== 'active') {
          throw new CatalogException('REFERENCE_NOT_ACTIVE', `服务包未启用: ${item.referenceId}`);
        }
      }
    }
  }

  // ... 其他方法实现
}
```

### 9.4 数据库迁移步骤

#### 9.4.1 创建 Schema 文件

```bash
# 创建 services schema
touch src/database/schema/services.schema.ts

# 创建 service_packages schema
touch src/database/schema/service-packages.schema.ts

# 创建 service_package_items schema
touch src/database/schema/service-package-items.schema.ts

# 创建 products schema
touch src/database/schema/products.schema.ts

# 创建 product_items schema
touch src/database/schema/product-items.schema.ts
```

#### 9.4.2 更新 schema/index.ts

```typescript
// src/database/schema/index.ts
export * from './services.schema';
export * from './service-packages.schema';
export * from './service-package-items.schema';
export * from './products.schema';
export * from './product-items.schema';
```

#### 9.4.3 生成 Drizzle 迁移

```bash
npm run db:generate
```

#### 9.4.4 创建补充SQL迁移（约束和索引）

由于Drizzle不支持某些数据库特性（如CHECK约束、部分索引等），需要创建独立的SQL迁移文件：

**文件：** `src/database/migrations/0002_add_constraints_and_indexes.sql`

```sql
-- ============================================
-- Catalog Domain - 约束和索引
-- ============================================

-- ============================================
-- Services 表
-- ============================================

-- 索引
CREATE INDEX IF NOT EXISTS idx_services_code ON services(code);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_billing_mode ON services(billing_mode);

-- ============================================
-- Service Packages 表
-- ============================================

-- 索引
CREATE INDEX IF NOT EXISTS idx_service_packages_code ON service_packages(code);
CREATE INDEX IF NOT EXISTS idx_service_packages_status ON service_packages(status);

-- ============================================
-- Service Package Items 表
-- ============================================

-- 索引
CREATE INDEX IF NOT EXISTS idx_service_package_items_package_id ON service_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_service_package_items_service_id ON service_package_items(service_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_package_items_package_service
  ON service_package_items(package_id, service_id);

-- ============================================
-- Products 表
-- ============================================

-- 索引
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_published_at ON products(published_at);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- 部分索引（仅对draft状态的产品索引scheduled_publish_at）
CREATE INDEX IF NOT EXISTS idx_products_scheduled_publish
  ON products(scheduled_publish_at)
  WHERE status = 'draft';

-- 约束
ALTER TABLE products
  ADD CONSTRAINT IF NOT EXISTS chk_price_positive
  CHECK (price::numeric > 0);

ALTER TABLE products
  ADD CONSTRAINT IF NOT EXISTS chk_validity_days_positive
  CHECK (validity_days IS NULL OR validity_days > 0);

-- ============================================
-- Product Items 表
-- ============================================

-- 索引
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON product_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_items_type ON product_items(type);
CREATE INDEX IF NOT EXISTS idx_product_items_reference_id ON product_items(reference_id);

-- 唯一索引（防止重复添加）
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_items_unique
  ON product_items(product_id, type, reference_id);
```

#### 9.4.5 应用迁移

```bash
# 开发环境（直接推送，包含Drizzle迁移）
npm run db:push

# 手动应用SQL迁移（约束和索引）
psql $DATABASE_URL < src/database/migrations/0002_add_constraints_and_indexes.sql

# 生产环境（运行所有迁移）
npm run db:migrate
# 然后手动应用SQL迁移文件
```

#### 9.4.6 验证迁移结果

```bash
# 打开 Drizzle Studio 检查表结构
npm run db:studio

# 或使用 psql 验证
psql $DATABASE_URL -c "\d services"
psql $DATABASE_URL -c "\d products"
```

### 9.5 测试指南

#### 9.5.1 单元测试

```typescript
// src/domains/catalog/product/services/product.service.spec.ts
describe('ProductService', () => {
  let service: ProductService;
  let drizzle: DrizzleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: DrizzleService,
          useValue: mockDrizzleService,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    drizzle = module.get<DrizzleService>(DrizzleService);
  });

  describe('create', () => {
    it('应该成功创建产品', async () => {
      const dto: CreateProductDto = {
        code: 'test_product',
        name: '测试产品',
        price: 1000,
        validityDays: 365,
      };

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.code).toBe(dto.code);
      expect(result.status).toBe('draft');
    });

    it('应该拒绝重复的产品编码', async () => {
      const dto: CreateProductDto = {
        code: 'duplicate_code',
        name: '重复产品',
        price: 1000,
        validityDays: 365,
      };

      // 模拟已存在的产品
      jest.spyOn(drizzle.db, 'select').mockResolvedValue([{ id: '123' }]);

      await expect(service.create(dto)).rejects.toThrow('产品编码已存在');
    });
  });

  describe('publish', () => {
    it('应该成功上架产品', async () => {
      const productId = '123';

      const result = await service.publish(productId, {});

      expect(result.status).toBe('active');
      expect(result.publishedAt).toBeDefined();
    });

    it('应该拒绝上架非草稿状态的产品', async () => {
      const productId = '123';

      // 模拟已上架的产品
      jest.spyOn(drizzle.db, 'select').mockResolvedValue([
        { id: productId, status: 'active' }
      ]);

      await expect(service.publish(productId, {})).rejects.toThrow(
        '只能上架草稿状态的产品'
      );
    });
  });
});
```

#### 9.5.2 集成测试

```typescript
// test/catalog/product.e2e-spec.ts
describe('ProductController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/catalog/products (POST) - 创建产品', () => {
    return request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({
        code: 'test_product',
        name: '测试产品',
        price: 1000,
        validityDays: 365,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.code).toBe('test_product');
        expect(res.body.status).toBe('draft');
      });
  });

  it('/api/catalog/products/:id/publish (POST) - 上架产品', async () => {
    // 先创建产品
    const createRes = await request(app.getHttpServer())
      .post('/api/catalog/products')
      .send({
        code: 'publish_test',
        name: '上架测试产品',
        price: 1000,
        validityDays: 365,
      });

    const productId = createRes.body.id;

    // 上架产品
    return request(app.getHttpServer())
      .post(`/api/catalog/products/${productId}/publish`)
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('active');
        expect(res.body.publishedAt).toBeDefined();
      });
  });
});
```

### 9.4 数据库管理规范

#### 9.4.1 索引管理

**所有索引必须在 SQL 迁移文件中手动创建**，不在 Drizzle schema 中定义。

**迁移文件示例：** `src/database/migrations/0001_create_catalog_indexes.sql`

```sql
-- Services 表索引
CREATE INDEX idx_services_code ON services(code);
CREATE INDEX idx_services_service_type ON services(service_type);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_billing_mode ON services(billing_mode);

-- Service Packages 表索引
CREATE INDEX idx_service_packages_code ON service_packages(code);
CREATE INDEX idx_service_packages_status ON service_packages(status);

-- Service Package Items 表索引
CREATE INDEX idx_service_package_items_package_id ON service_package_items(package_id);
CREATE INDEX idx_service_package_items_service_id ON service_package_items(service_id);
CREATE UNIQUE INDEX idx_service_package_items_package_service
  ON service_package_items(package_id, service_id);

-- Products 表索引
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sort_order ON products(sort_order);
CREATE INDEX idx_products_published_at ON products(published_at);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_scheduled_publish
  ON products(scheduled_publish_at) WHERE status = 'draft';

-- Product Items 表索引
CREATE INDEX idx_product_items_product_id ON product_items(product_id);
CREATE INDEX idx_product_items_type ON product_items(type);
CREATE INDEX idx_product_items_reference_id ON product_items(reference_id);
CREATE UNIQUE INDEX idx_product_items_unique
  ON product_items(product_id, type, reference_id);

-- 约束
ALTER TABLE products
  ADD CONSTRAINT chk_price_positive CHECK (price::numeric > 0);

ALTER TABLE products
  ADD CONSTRAINT chk_validity_days_positive
  CHECK (validity_days IS NULL OR validity_days > 0);
```

#### 9.4.2 自动更新 updatedAt 字段

**使用 PostgreSQL 触发器自动更新 `updated_at` 字段**

**迁移文件示例：** `src/database/migrations/0002_create_updated_at_triggers.sql`

```sql
-- 创建通用触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Services 表触发器
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service Packages 表触发器
CREATE TRIGGER update_service_packages_updated_at
  BEFORE UPDATE ON service_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service Package Items 表触发器
CREATE TRIGGER update_service_package_items_updated_at
  BEFORE UPDATE ON service_package_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Products 表触发器
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product Items 表触发器
CREATE TRIGGER update_product_items_updated_at
  BEFORE UPDATE ON product_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 9.4.3 sortOrder 自动管理

**sortOrder 字段的管理策略：**

1. **新增记录时**：`sortOrder = MAX(sortOrder) + 1`
2. **删除记录时**：重新计算剩余记录的 sortOrder（填补空缺）
3. **手动调整时**：通过 `updateItemSortOrder()` / `updateProductSortOrder()` 方法

**实现示例：**

```typescript
import { eq, and, desc } from 'drizzle-orm';

// 新增服务到服务包
async addService(packageId: string, dto: AddServiceDto): Promise<void> {
  const db = this.drizzle.db;

  // 计算新的 sortOrder
  const items = await db.select({ sortOrder: servicePackageItems.sortOrder })
    .from(servicePackageItems)
    .where(eq(servicePackageItems.packageId, packageId))
    .orderBy(desc(servicePackageItems.sortOrder))
    .limit(1);

  const newSortOrder = items.length > 0 ? items[0].sortOrder + 1 : 1;

  await db.insert(servicePackageItems).values({
    packageId,
    serviceId: dto.serviceId,
    quantity: dto.quantity,
    unit: dto.unit,
    sortOrder: dto.sortOrder ?? newSortOrder,
  });
}

// 删除服务后重新计算 sortOrder
async removeService(packageId: string, serviceId: string): Promise<void> {
  const db = this.drizzle.db;

  await db.transaction(async (tx) => {
    // 删除记录
    await tx.delete(servicePackageItems)
      .where(and(
        eq(servicePackageItems.packageId, packageId),
        eq(servicePackageItems.serviceId, serviceId)
      ));

    // 重新计算剩余记录的 sortOrder
    const remainingItems = await tx.select()
      .from(servicePackageItems)
      .where(eq(servicePackageItems.packageId, packageId))
      .orderBy(servicePackageItems.sortOrder);

    // 重新赋值 sortOrder（1, 2, 3, ...）
    for (let i = 0; i < remainingItems.length; i++) {
      await tx.update(servicePackageItems)
        .set({ sortOrder: i + 1 })
        .where(eq(servicePackageItems.id, remainingItems[i].id));
    }
  });
}
```

### 9.5 批量操作通用规范

**所有批量操作接口遵循以下规范：**

1. **最大数量限制：50条**
2. **独立事务策略：** 每条记录独立事务，允许部分成功
3. **不支持自动重试：** 失败记录返回详细错误信息，由前端展示供人工处理
4. **返回格式统一：**

```typescript
interface BatchResult {
  success: number;                // 成功数量
  failed: number;                 // 失败数量
  errors: Array<{
    id: string;                   // 记录ID
    error: string;                // 错误信息
  }>;
}
```

**实现示例：**

```typescript
async batchUpdate(dto: BatchOperationDto): Promise<BatchResult> {
  // 验证数量限制
  if (dto.productIds.length > 50) {
    throw new BadRequestException('批量操作最多支持50条记录');
  }

  const result: BatchResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // 独立事务处理每个产品
  for (const productId of dto.productIds) {
    try {
      await this.drizzle.db.transaction(async (tx) => {
        if (dto.operation === 'publish') {
          await this.publishInTransaction(tx, productId, dto.scheduledPublishAt);
        } else {
          await this.unpublishInTransaction(tx, productId, dto.reason);
        }
      });
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: productId,
        error: error.message,
      });
    }
  }

  return result;
}
```

### 9.6 快照生成规范

**快照设计原则：**

1. **实时生成，不持久化存储**
2. **由 BFF 层调用，避免后端跨域访问**
3. **完全展开嵌套结构**（服务包展开为具体服务列表）

**ProductSnapshot 生成示例：**

```typescript
async generateSnapshot(id: string): Promise<ProductSnapshot> {
  const product = await this.findOne({ id });

  const services: ProductSnapshot['services'] = [];

  for (const item of product.items) {
    if (item.type === 'service') {
      // 直接引用服务
      services.push({
        serviceId: item.service.id,
        serviceName: item.service.name,
        serviceCode: item.service.code,
        serviceType: item.service.serviceType,
        quantity: item.quantity,
        unit: item.unit,
        billingMode: item.service.billingMode,
        sourceType: 'direct',
      });
    } else {
      // 展开服务包
      for (const pkgItem of item.servicePackage.items) {
        services.push({
          serviceId: pkgItem.service.id,
          serviceName: pkgItem.service.name,
          serviceCode: pkgItem.service.code,
          serviceType: pkgItem.service.serviceType,
          quantity: pkgItem.quantity * item.quantity, // 数量相乘
          unit: pkgItem.unit,
          billingMode: pkgItem.service.billingMode,
          sourceType: 'from_package',
          sourcePackageId: item.servicePackage.id,
          sourcePackageName: item.servicePackage.name,
        });
      }
    }
  }

  return {
    productId: product.id,
    productName: product.name,
    productCode: product.code,
    price: product.price,
    currency: product.currency,
    validityDays: product.validityDays,
    services,
    snapshotAt: new Date(),
  };
}
```

### 9.7 删除检查实现规范

**删除检查仅限本域内引用，不跨域检查**

**Service 删除检查示例：**

```typescript
async remove(id: string): Promise<Service> {
  const db = this.drizzle.db;

  // 1. 检查状态（只能删除非 active 状态的服务）
  const service = await this.findOne({ id });
  if (!service || service.status === 'active') {
    throw new BadRequestException('SERVICE_NOT_FOUND_OR_ACTIVE_CANNOT_DELETE');
  }

  // 2. 检查本域内引用
  // 2.1 检查是否被服务包引用
  const packageRefs = await db.select()
    .from(servicePackageItems)
    .where(eq(servicePackageItems.serviceId, id))
    .limit(1);

  if (packageRefs.length > 0) {
    throw new BadRequestException('SERVICE_IN_USE');
  }

  // 2.2 检查是否被产品直接引用
  const productRefs = await db.select()
    .from(productItems)
    .where(and(
      eq(productItems.type, 'service'),
      eq(productItems.referenceId, id)
    ))
    .limit(1);

  if (productRefs.length > 0) {
    throw new BadRequestException('SERVICE_IN_USE');
  }

  // 3. 不检查 Contract Domain 的引用（Contract 有快照，独立存储）

  // 4. 逻辑删除
  await db.update(services)
    .set({ status: 'deleted' })
    .where(eq(services.id, id));

  return this.findOne({ id });
}
```

---

## 10. 附录

### 10.1 常见问题（FAQ）

#### Q1: Catalog 域为什么不发布事件？

**A:** Catalog 是配置域，主要职责是管理产品定义和配置。其他域（如 Contract Domain）通过服务调用获取产品信息即可，不需要事件通知。这样可以：

- 减少不必要的事件耦合
- 简化系统架构
- 提高性能（按需查询）

#### Q2: 产品上架后为什么不能编辑？

**A:** 产品上架后不可编辑是为了保证已签约合同的一致性。如果产品内容变更，可能导致已签约的合同权益不一致。正确的做法是：

- 下架旧产品
- 创建新产品（新版本）
- 上架新产品

#### Q3: 如何处理产品价格调整？

**A:** 产品价格调整分两种情况：

- **未上架产品**：直接修改 `price` 字段
- **已上架产品**：创建新产品，设置新价格，下架旧产品

#### Q4: Service 和 ServicePackage 的区别是什么？

**A:**

- **Service**：最小原子单位，如"简历修改"、"GAP分析"
- **ServicePackage**：多个服务的组合，如"求职基础包"（包含GAP分析、简历修改、推荐信等）

#### Q5: Product 可以同时包含 Service 和 ServicePackage 吗？

**A:** 可以。Product 通过 `product_items` 表灵活关联 Service 或 ServicePackage，支持混合配置。

示例：

```typescript
Product: VIP全程服务
- Service Package: 求职基础包 x 1
- Service: 内推服务 x 3
- Service: 模拟面试 x 2
```

### 10.2 术语表

| 术语     | 英文              | 说明                                           |
| -------- | ----------------- | ---------------------------------------------- |
| 产品域   | Catalog Domain    | 负责管理服务、服务包和产品的配置域             |
| 服务     | Service           | 平台提供的最小原子单位                         |
| 服务包   | Service Package   | 多个服务的逻辑组合                             |
| 产品     | Product           | 面向客户的商品                                 |
| 产品项   | Product Item      | 产品包含的服务或服务包                         |
| 计费模式 | Billing Mode      | 服务的计费方式（按次、按课节、阶段性、服务包） |
| 目标用户 | Target User       | 产品面向的用户群体（本科生、研究生、在职人士） |
| 营销标签 | Marketing Label   | 产品的营销标记（热门、新品、推荐）             |
| 定时上架 | Scheduled Publish | 产品在指定时间自动上架                         |

### 10.3 参考资料

- [BILLING_MODULE_DESIGN.md](./BILLING_MODULE_DESIGN.md) - 计费模块设计文档
- [CLAUDE.md](./CLAUDE.md) - 项目开发指南
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) - DDD 设计理念
- [NestJS Documentation](https://docs.nestjs.com/) - NestJS 官方文档
- [Drizzle ORM](https://orm.drizzle.team/) - Drizzle ORM 文档

---

**文档结束**

---

> **版本历史：**
>
> - v1.1 (2025-11-04): 重大更新
>   - 产品状态机增加 `inactive` 状态（下架状态）
>   - ProductService 新增 `revertToDraft()`、`updateItemSortOrder()`、`updateProductSortOrder()` 方法
>   - ServicePackageService 新增 `updateItemSortOrder()` 方法
>   - 移除 `recommend()` 方法（简化为 search 的筛选功能）
>   - 货币枚举增加 EUR、GBP、JPY 预留支持
>   - 批量操作限制明确为最多 50 条
>   - 删除检查明确为仅本域引用，不跨域检查
>   - 补充数据库管理规范（索引、触发器、sortOrder 管理）
>   - 补充批量操作、快照生成、删除检查的实现规范
> - v1.0 (2025-11-04): 初始版本，完整的 Catalog Domain 设计
