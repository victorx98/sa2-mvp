# Query模块重构方案

## 1. 背景

当前项目采用DDD架构，在`domains/services`模块中遵循了良好的分层原则：
- **内层**：定义接口（`repositories/`）
- **外层**：实现接口（`infrastructure/repositories/`）
- **依赖方向**：外层依赖内层，符合依赖倒置原则

然而，`domains/query`模块尚未遵循相同的架构原则，存在以下问题：
- ❌ 缺少接口定义层
- ❌ 实现直接暴露在`services/`目录
- ❌ 依赖注入使用具体类而非接口
- ❌ 与其他domain模块结构不一致

## 2. 当前结构

```
src/domains/query/
├── query.module.ts
├── services/                          # ❌ 直接实现，无接口层
│   ├── student-query.service.ts
│   ├── mentor-query.service.ts
│   ├── regular-mentoring-query.service.ts
│   └── ...
└── placement/
    └── placement-query.service.ts
```

## 3. 目标结构

```
src/domains/query/
├── query.module.ts
├── interfaces/                        # ✅ 接口定义（内层）
│   ├── student-query.interface.ts
│   ├── mentor-query.interface.ts
│   ├── regular-mentoring-query.interface.ts
│   └── index.ts
│
├── dto/                               # ✅ Read Model DTO
│   ├── student-list-item.dto.ts
│   ├── mentor-list-item.dto.ts
│   └── index.ts
│
└── infrastructure/                    # ✅ 实现层（外层）
    ├── services/                      # 查询服务实现
    │   ├── student-query.service.ts
    │   ├── mentor-query.service.ts
    │   ├── regular-mentoring-query.service.ts
    │   └── index.ts
    └── placement/                     # 子域查询实现
        └── placement-query.service.ts
```

## 4. 重构步骤

### 4.1 创建接口定义层

**文件：** `src/domains/query/interfaces/student-query.interface.ts`

```typescript
import { StudentListItem, StudentCounselorViewItem } from '../dto';
import { IPaginatedResult } from '@shared/types/paginated-result';

/**
 * Student Query Service Interface
 * 职责：定义学生查询能力的抽象
 */
export interface IStudentQueryService {
  /**
   * 根据导师ID获取学生列表
   */
  findStudentsByMentorId(mentorId: string, text?: string): Promise<StudentListItem[]>;

  /**
   * 根据顾问ID获取学生列表
   */
  findStudentsByCounselorId(counselorId: string, text?: string): Promise<StudentListItem[]>;

  /**
   * 获取所有学生列表
   */
  findAllStudents(text?: string): Promise<StudentListItem[]>;

  /**
   * 获取顾问视图的学生列表（带分页）
   */
  listOfCounselorView(
    counselorId?: string,
    search?: string,
    page?: number,
    pageSize?: number,
    studentId?: string,
  ): Promise<IPaginatedResult<StudentCounselorViewItem>>;
}

/**
 * DI Token
 */
export const STUDENT_QUERY_SERVICE = Symbol('STUDENT_QUERY_SERVICE');
```

### 4.2 提取DTO到独立目录

**文件：** `src/domains/query/dto/student-list-item.dto.ts`

```typescript
import { Country, Gender } from '@shared/types/identity-enums';

/**
 * Student List Item DTO
 * 扁平化的 Read Model，用于列表展示
 */
export interface StudentListItem {
  // Student 表主要字段
  id: string;
  status: string;
  underMajor: string;
  underCollege: string;
  // ... 其他字段
  
  // User 表补充字段
  email: string;
  nameEn: string;
  nameZh: string;
  country?: Country;
  gender?: Gender;
}

/**
 * Student Counselor View Item DTO
 * 顾问视图的学生列表 Read Model
 */
export interface StudentCounselorViewItem extends StudentListItem {
  // 学校名称
  underCollegeNameZh: string;
  underCollegeNameEn: string;
  // 专业名称
  underMajorNameZh: string;
  underMajorNameEn: string;
  // 顾问关联信息
  counselorStatus: string;
  counselorType: string;
}
```

### 4.3 修改实现类

**文件：** `src/domains/query/infrastructure/services/student-query.service.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { IStudentQueryService } from '../../interfaces/student-query.interface';
import { StudentListItem, StudentCounselorViewItem } from '../../dto';
import { IPaginatedResult } from '@shared/types/paginated-result';

/**
 * Student Query Service Implementation
 * 职责：实现学生查询接口，直接使用SQL进行高效查询
 */
@Injectable()
export class StudentQueryService implements IStudentQueryService {
  private readonly logger = new Logger(StudentQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findStudentsByMentorId(
    mentorId: string,
    text?: string,
  ): Promise<StudentListItem[]> {
    // 实现保持不变...
  }

  // ... 其他方法实现
}
```

### 4.4 更新Module配置

**文件：** `src/domains/query/query.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';

// 导入接口Token
import { STUDENT_QUERY_SERVICE } from './interfaces/student-query.interface';
import { MENTOR_QUERY_SERVICE } from './interfaces/mentor-query.interface';
import { REGULAR_MENTORING_QUERY_SERVICE } from './interfaces/regular-mentoring-query.interface';
// ... 其他接口

// 导入实现类
import { StudentQueryService } from './infrastructure/services/student-query.service';
import { MentorQueryService } from './infrastructure/services/mentor-query.service';
import { RegularMentoringQueryService } from './infrastructure/services/regular-mentoring-query.service';
// ... 其他实现

/**
 * Query Domain Module
 * 职责：
 * 1. 提供跨域查询服务
 * 2. 构建 Read Model
 * 3. 高效查询，可以直接 join 各域表
 */
@Module({
  imports: [
    DatabaseModule,
    // ... 其他domain模块
  ],
  providers: [
    // 使用接口Token注入
    {
      provide: STUDENT_QUERY_SERVICE,
      useClass: StudentQueryService,
    },
    {
      provide: MENTOR_QUERY_SERVICE,
      useClass: MentorQueryService,
    },
    {
      provide: REGULAR_MENTORING_QUERY_SERVICE,
      useClass: RegularMentoringQueryService,
    },
    // ... 其他服务
  ],
  exports: [
    // 导出接口Token
    STUDENT_QUERY_SERVICE,
    MENTOR_QUERY_SERVICE,
    REGULAR_MENTORING_QUERY_SERVICE,
    // ... 其他服务
  ],
})
export class QueryModule {}
```

### 4.5 更新Application层使用方式

**文件：** `src/application/queries/student/student-list.query.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { 
  IStudentQueryService, 
  STUDENT_QUERY_SERVICE 
} from '@domains/query/interfaces/student-query.interface';
import { StudentListItem, StudentCounselorViewItem } from '@domains/query/dto';
import { User } from '@domains/identity/user/user-interface';
import { IPaginatedResult } from '@shared/types/paginated-result';

/**
 * Student List Query (Application Layer)
 * 职责：编排学生列表查询用例
 */
@Injectable()
export class StudentListQuery {
  constructor(
    @Inject(STUDENT_QUERY_SERVICE)
    private readonly studentQueryService: IStudentQueryService,  // ✅ 注入接口
  ) {}

  async find(
    user: User,
    search?: string,
    counselorId?: string,
    mentorId?: string,
  ): Promise<StudentListItem[]> {
    if (mentorId) {
      return this.studentQueryService.findStudentsByMentorId(mentorId, search);
    }
    
    if (counselorId) {
      return this.studentQueryService.findStudentsByCounselorId(counselorId, search);
    }
    
    return this.studentQueryService.findAllStudents(search);
  }
}
```

## 5. 重构检查清单

### 5.1 接口层（interfaces/）
- [ ] `student-query.interface.ts` - 学生查询接口
- [ ] `mentor-query.interface.ts` - 导师查询接口
- [ ] `counselor-query.interface.ts` - 顾问查询接口
- [ ] `school-query.interface.ts` - 学校查询接口
- [ ] `major-query.interface.ts` - 专业查询接口
- [ ] `regular-mentoring-query.interface.ts` - 常规辅导查询接口
- [ ] `gap-analysis-query.interface.ts` - Gap分析查询接口
- [ ] `ai-career-query.interface.ts` - AI职业查询接口
- [ ] `comm-session-query.interface.ts` - 沟通会话查询接口
- [ ] `class-session-query.interface.ts` - 班级会话查询接口
- [ ] `class-query.interface.ts` - 班级查询接口
- [ ] `placement-query.interface.ts` - 职位查询接口
- [ ] `index.ts` - 统一导出

### 5.2 DTO层（dto/）
- [ ] `student-list-item.dto.ts` - 学生列表DTO
- [ ] `mentor-list-item.dto.ts` - 导师列表DTO
- [ ] `counselor-list-item.dto.ts` - 顾问列表DTO
- [ ] 其他Read Model DTO
- [ ] `index.ts` - 统一导出

### 5.3 实现层（infrastructure/services/）
- [ ] 移动所有`services/*.service.ts`到`infrastructure/services/`
- [ ] 每个实现类添加`implements I*QueryService`
- [ ] 更新import路径

### 5.4 Module配置
- [ ] 更新`query.module.ts`使用Token注入
- [ ] 导出Token而非具体类
- [ ] 更新相关模块的导入

### 5.5 Application层更新
- [ ] 更新所有Application Query使用Token注入
- [ ] 更新import路径
- [ ] 使用接口类型而非具体类

### 5.6 测试更新
- [ ] 更新单元测试mock方式
- [ ] 使用接口进行测试隔离

## 6. 重构收益

### 6.1 架构一致性
✅ 与`domains/services`模块保持一致的结构  
✅ 符合DDD分层架构原则  
✅ 清晰的依赖方向：外层依赖内层

### 6.2 可测试性
✅ 易于mock接口进行单元测试  
✅ 测试不依赖具体实现  
✅ 可以快速切换测试实现

### 6.3 可维护性
✅ 接口定义清晰，易于理解  
✅ 实现可替换（如切换到不同的ORM）  
✅ 符合开闭原则

### 6.4 可扩展性
✅ 易于添加新的查询服务  
✅ 可以为不同场景提供不同实现  
✅ 支持装饰器模式（如缓存）

## 7. 迁移策略

### 7.1 渐进式重构（推荐）
1. **第一阶段**：创建接口层，保持现有实现不变
2. **第二阶段**：逐个模块迁移实现到infrastructure
3. **第三阶段**：更新Application层使用Token注入
4. **第四阶段**：删除旧代码，完成重构

### 7.2 一次性重构
- 适合小团队或停机维护窗口
- 需要充分的测试覆盖
- 风险较高，不推荐

## 8. 注意事项

### 8.1 向后兼容
- 在过渡期可以同时导出Token和具体类
- 给团队足够的迁移时间
- 做好文档和培训

### 8.2 性能影响
- 接口注入不会带来性能损失
- NestJS的依赖注入在启动时完成
- 运行时性能无差异

### 8.3 团队协作
- 更新团队编码规范
- 统一代码审查标准
- 确保新代码遵循新架构

## 9. 参考示例

完整的重构示例可参考：
- `domains/services/sessions/regular-mentoring/` - 标准DDD结构
- `domains/contract/` - 领域模块组织方式
- 本文档中的代码示例

## 10. 总结

通过本次重构，Query模块将：
- ✅ 遵循DDD分层架构原则
- ✅ 与其他domain模块保持一致
- ✅ 提升代码的可测试性和可维护性
- ✅ 为未来的扩展打下良好基础

**重构优先级**：中等  
**预计工作量**：2-3人天  
**风险等级**：低（主要是结构调整，业务逻辑不变）

