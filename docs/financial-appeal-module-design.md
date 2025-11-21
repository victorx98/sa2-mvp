# 财务领域申诉模块设计文档

## 1. 项目背景与需求分析

### 1.1 核心需求
- **角色变更**：申诉处理由财务管理员变更为顾问，导师可指定处理顾问
- **流程优化**：简化申诉提交流程，提升处理效率
- **权限管理**：导师仅可操作自身申诉，顾问仅处理分配给自己的申诉

### 1.2 领域定义
- **核心领域**：财务领域，聚焦导师收益争议处理
- **聚合根**：导师申诉（MentorAppeal）
- **关键角色**：导师（Mentor）、顾问（Counselor）、管理员（Admin）

## 2. 业务场景

### 2.1 导师申诉提交流程
1. 导师发现费用计算错误或遗漏服务记录
2. 导师提交申诉，指定顾问并提供证明材料
3. 系统创建申诉记录，状态为待处理

### 2.2 顾问申诉处理流程
1. 顾问查看分配给自己的申诉
2. 审核申诉详情及相关财务记录
3. 做出批准或驳回决定
4. 如批准，系统自动调整应付账款记录

## 3. 数据库设计

### 3.1 表结构

```sql
CREATE TABLE mentor_appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id UUID NOT NULL REFERENCES mentors(id),
  counselor_id UUID NOT NULL REFERENCES counselors(id),
  mentor_payable_id UUID REFERENCES mentor_payable_ledgers(id),
  settlement_id UUID REFERENCES settlement_ledgers(id),
  appeal_type VARCHAR(50) NOT NULL,
  appeal_amount DECIMAL(19,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  rejection_reason TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_mentor_appeals_mentor_id ON mentor_appeals(mentor_id);
CREATE INDEX idx_mentor_appeals_counselor_id ON mentor_appeals(counselor_id);
CREATE INDEX idx_mentor_appeals_status ON mentor_appeals(status);
CREATE INDEX idx_mentor_appeals_mentor_payable_id ON mentor_appeals(mentor_payable_id);
CREATE INDEX idx_mentor_appeals_settlement_id ON mentor_appeals(settlement_id);
CREATE INDEX idx_mentor_appeals_created_at ON mentor_appeals(created_at);
CREATE INDEX idx_mentor_appeals_approved_by ON mentor_appeals(approved_by);
CREATE INDEX idx_mentor_appeals_rejected_by ON mentor_appeals(rejected_by);
CREATE INDEX idx_mentor_appeals_approved_at ON mentor_appeals(approved_at);
CREATE INDEX idx_mentor_appeals_rejected_at ON mentor_appeals(rejected_at);
```

### 3.2 字段说明

| 字段名 | 数据类型 | 约束 | 描述 |
| :--- | :--- | :--- | :--- |
| id | UUID | PRIMARY KEY | 申诉ID |
| mentor_id | UUID | NOT NULL | 导师ID |
| counselor_id | UUID | NOT NULL | 处理顾问ID |
| mentor_payable_id | UUID | REFERENCES | 关联应付账款ID |
| settlement_id | UUID | REFERENCES | 关联结算ID |
| appeal_type | VARCHAR(50) | NOT NULL | 申诉类型 |
| appeal_amount | DECIMAL(19,4) | NOT NULL | 申诉金额 |
| currency | VARCHAR(3) | NOT NULL | 货币类型 |
| reason | TEXT | NOT NULL | 申诉理由 |
| status | VARCHAR(20) | NOT NULL | 申诉状态 |
| rejection_reason | TEXT | - | 驳回理由 |
| approved_by | UUID | - | 审批人ID |
| approved_at | TIMESTAMP | - | 审批时间 |
| rejected_by | UUID | - | 驳回人ID |
| rejected_at | TIMESTAMP | - | 驳回时间 |
| created_by | UUID | NOT NULL | 创建人ID |
| updated_by | UUID | NOT NULL | 更新人ID |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

## 4. 领域服务设计

### 4.1 服务接口

```typescript
// IMentorAppealService.ts
// 导入共享类型
import { IPaginatedResult } from '@src/shared/types/paginated-result';
import { IPaginationQuery, ISortQuery } from '@src/shared/types/pagination.types';

export interface IMentorAppealService {
  /** 创建申诉 */
  createAppeal(dto: CreateAppealDTO, createdByUserId: string): Promise<MentorAppeal>;
  
  /** 查询单个申诉 */
  findOne(conditions: Partial<MentorAppeal> | { id: string }): Promise<MentorAppeal | null>;
  
  /** 搜索申诉列表 */
  search(
    filter: AppealSearchDTO,
    pagination: IPaginationQuery,
    sort?: ISortQuery
  ): Promise<IPaginatedResult<MentorAppeal>>;
  
  /** 审批申诉 */
  approveAppeal(id: string, approvedByUserId: string): Promise<MentorAppeal>;
  
  /** 驳回申诉 */
  rejectAppeal(id: string, dto: { rejectionReason: string }, rejectedByUserId: string): Promise<MentorAppeal>;
}
```

### 4.2 核心实现逻辑

```typescript
// MentorAppealService.ts 核心逻辑摘要
export class MentorAppealService implements IMentorAppealService {
  constructor(
    private readonly appealRepository: IMentorAppealRepository,
    private readonly payableService: IMentorPayableService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async createAppeal(dto: CreateAppealDTO, createdByUserId: string): Promise<MentorAppeal> {
    // 创建申诉记录并设置PENDING状态
    // 发布MENTOR_APPEAL_CREATED_EVENT事件
  }

  async findOne(conditions: Partial<MentorAppeal> | { id: string }): Promise<MentorAppeal | null> {
    // 根据条件查询单个申诉记录
    // 支持按ID精确查询或其他条件组合查询
  }

  async approveAppeal(id: string, approvedByUserId: string): Promise<MentorAppeal> {
    // 使用findOne验证申诉存在性
    const appeal = await this.findOne({ id });
    // 验证状态和权限
    // 更新状态为APPROVED并记录审批信息（approvedBy, approvedAt）
    // 如有关联应付账款，创建调整记录
    // 发布MENTOR_APPEAL_APPROVED_EVENT事件
  }

  async rejectAppeal(id: string, dto: { rejectionReason: string }, rejectedByUserId: string): Promise<MentorAppeal> {
    // 使用findOne验证申诉存在性
    const appeal = await this.findOne({ id });
    // 验证状态和权限
    // 更新状态为REJECTED并记录驳回理由、驳回人ID和驳回时间（rejectedBy, rejectedAt）
    // 发布MENTOR_APPEAL_REJECTED_EVENT事件
  }
}
```

## 5. 数据传输对象(DTO)

```typescript
// CreateAppealDTO.ts
export interface CreateAppealDTO {
  mentorId: string;
  counselorId: string;
  mentorPayableId?: string;
  settlementId?: string;
  appealType: string;
  appealAmount: number;
  currency: string;
  reason: string;
}

// AppealSearchDTO.ts
export interface AppealSearchDTO {
  mentorId?: string;
  counselorId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  appealType?: string;
  minAmount?: number;
  maxAmount?: number;
}

// AppealResponseDTO.ts
export interface AppealResponseDTO {
  id: string;
  mentorId: string;
  counselorId: string;
  mentorPayableId?: string;
  settlementId?: string;
  appealType: string;
  appealAmount: number;
  currency: string;
  reason: string;
  status: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}
```

## 6. 领域事件

```typescript
// 事件接口与常量定义
export interface IMentorAppealCreatedEvent {
  appealId: string;
  mentorId: string;
  counselorId: string;
  appealAmount: number;
  appealType: string;
}

export const MENTOR_APPEAL_CREATED_EVENT = 'financial.appeal.created';

export interface IMentorAppealApprovedEvent {
  appealId: string;
  mentorId: string;
  counselorId: string;
  appealAmount: number;
  approvedBy: string;
  approvedAt: Date;
}

export const MENTOR_APPEAL_APPROVED_EVENT = 'financial.appeal.approved';

export interface IMentorAppealRejectedEvent {
  appealId: string;
  mentorId: string;
  counselorId: string;
  rejectionReason: string;
  rejectedBy: string;
  rejectedAt: Date;
}

export const MENTOR_APPEAL_REJECTED_EVENT = 'financial.appeal.rejected';
```

## 7. 状态管理

### 7.1 状态定义

| 状态 | 值 | 描述 |
| :--- | :--- | :--- |
| PENDING | "PENDING" | 待处理状态 |
| APPROVED | "APPROVED" | 已批准状态 |
| REJECTED | "REJECTED" | 已驳回状态 |

### 7.2 状态转换规则

1. **PENDING → APPROVED**
   - 触发：顾问审批操作
   - 前置条件：申诉存在，状态为PENDING，操作顾问与counselorId匹配
   - 动作：更新状态，记录审批信息，发布审批事件，创建应付账款调整记录

2. **PENDING → REJECTED**
   - 触发：顾问驳回操作
   - 前置条件：申诉存在，状态为PENDING，操作顾问与counselorId匹配，提供驳回理由
   - 动作：更新状态，记录驳回理由，发布驳回事件

## 8. 权限控制

- **导师**：仅可查看和创建自己的申诉记录
- **顾问**：仅可查看和处理分配给自己的申诉记录
- **管理员**：可查看所有申诉记录和管理顾问分配

## 9. 集成与异常

### 9.1 核心集成点
- **MentorPayableService**：审批申诉时调整应付账款记录
- **事件系统**：发布申诉状态变更事件

### 9.2 关键异常处理
- 申诉不存在：返回404错误
- 状态不正确：提示当前状态不允许此操作
- 权限不足：提示无操作权限
- 关联记录不存在：提示关联记录不存在

## 10. 性能考虑

- 索引优化：为常用查询条件和关联字段添加索引
- 分页查询：实现分页机制避免大数据量查询
- 事件驱动：使用异步事件提高系统响应性