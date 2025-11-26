# Placement Domain Implementation Summary {投岗域实现概要}

Based on the design document `docs/placement_domain_design_v2.0.md` and `docs/MASS_APPLICATION_MODULE_DESIGN.md`, this implementation provides a minimal, clean architecture for the mass application (海投) module.

根据设计文档实现的海投模块，采用极简设计理念，专注于核心业务流程。

## Architecture Overview {架构概览}

```
placement/
├── placement.module.ts                    # Domain module definition
├── interfaces/                            # Service interfaces
│   └── mass-application-service.interface.ts
├── services/                              # Service implementations
│   └── mass-application.service.ts
├── dto/                                   # Data Transfer Objects
│   └── mass-application.dto.ts
├── types/                                 # Type definitions
│   └── application-status.enum.ts
├── README.md                              # This file
└── index.ts                               # Public API exports
```

## Core Features {核心功能}

### ✨ Mass Application (海投)

- **Single Application**: Create individual job applications to Indeed jobs
- **Batch Application**: Apply to multiple jobs in one operation
- **Status Tracking**: Track application status through lifecycle
- **Duplicate Prevention**: Prevent duplicate applications to the same job

### 📊 Data Model

Based on shared primary key design with two tables:

1. **mass_applications** - Stores mass application records
   - Primary key: `id`
   - Foreign key references: `indeed_job_id`
   - Status tracking: `application_status`
   - Student tracking: `student_id`

2. **application_references** - Central reference table for all application types
   - Shared primary key with mass_applications
   - Application type: `mass`
   - Job table type: `indeed`

### 📋 Business Rules Implemented {业务规则实现}

1. **Uniqueness Constraint**: One student can only apply once per job
2. **Status Transitions**: Validated using ALLOWED_STATUS_TRANSITIONS
3. **Batch Processing**: Partial success - failures don't rollback entire batch
4. **No Events**: Direct service calls (no domain events for simplicity)
5. **Anti-corruption Layer**: Student IDs as strings (not foreign keys)

## Implementation Details {实现细节}

### Technology Stack {技术栈}

- **Framework**: NestJS
- **Database**: PostgreSQL with Drizzle ORM
- **Language**: TypeScript
- **Testing**: Jest

### Key Files Created {关键文件列表}

#### Database Schema (`src/infrastructure/database/schema/placement/`)

1. **mass-applications.schema.ts**
   - Database table definition
   - Indexes for query optimization
   - Type exports

2. **application-references.schema.ts**
   - Shared primary key reference table
   - Indexes for cross-application queries

3. **index.ts**
   - Schema exports for central import

#### Domain Layer (`src/domains/placement/`)

1. **placement.module.ts**
   - NestJS module definition
   - Service registration

2. **services/mass-application.service.ts**
   - Core business logic implementation
   - Transaction management
   - Status transition validation

3. **interfaces/mass-application-service.interface.ts**
   - Service contract definition
   - Method signatures

4. **dto/mass-application.dto.ts**
   - Request/response DTOs
   - Type definitions

5. **types/application-status.enum.ts**
   - Status enumeration
   - Transition validation logic
   - Helper functions

#### Tests (`test/domains/placement/`)

1. **mass-application-flow.e2e-spec.ts**
   - End-to-end integration tests
   - Database testing
   - Business rule validation

## Usage Example {使用示例}

```typescript
import { MassApplicationService } from '@domains/placement';
import { ApplicationStatus } from '@domains/placement/types';

// Create a single application
const application = await massApplicationService.createApplication({
  studentId: 'student_001',
  indeedJobId: 'indeed_job_001',
  jobId: 'job_001',
});

// Status: SUBMITTED
console.log(application.status); // Output: "submitted"

// Update status to INTERVIEWED
const updated = await massApplicationService.updateApplicationStatus({
  applicationId: application.id,
  newStatus: ApplicationStatus.INTERVIEWED,
  updatedBy: 'counselor_001'
});

// Create batch applications
const batchResult = await massApplicationService.createBatchApplications({
  studentId: 'student_002',
  applications: [
    { indeedJobId: 'indeed_job_002', jobId: 'job_002' },
    { indeedJobId: 'indeed_job_003', jobId: 'job_003' },
  ]
});

console.log(batchResult.successCount); // Number of successful applications
console.log(batchResult.failedCount);  // Number of failed applications
```

## Status Flow {状态流转}

```
SUBMITTED
   ├──→ INTERVIEWED → REJECTED
   ├──→ INTERVIEWED → OFFERED → EXPIRED
   ├──→ REJECTED
   └──→ EXPIRED
```

**Forbidden Transitions (非法流转)**:
- SUBMITTED → OFFERED (must go through INTERVIEWED)
- Any transition from terminal states (REJECTED, EXPIRED)

## Database Indexes {数据库索引}

Optimized queries with these indexes:

1. `uk_student_indeed_job` - Unique constraint
2. `idx_mass_app_student_status` - Student + status queries
3. `idx_mass_app_job_status` - Job + status queries
4. `idx_mass_app_applied_at` - Time-based queries

## Running Tests {运行测试}

```bash
# Run integration tests
npm test -- test/domains/placement/mass-application-flow.e2e-spec.ts

# Run with coverage
npm run test:cov -- test/domains/placement/

# Run all tests
npm test
```

## Future Enhancements {未来增强}

While keeping the "minimal design" principle, potential enhancements could include:

1. **Job Search Integration**: Query Indeed jobs before applying
2. **Student Preferences**: Filter jobs based on student profiles
3. **Application Templates**: Pre-fill common application fields
4. **Analytics Dashboard**: Track application success rates
5. **Email Notifications**: Notify students of status changes (if needed)

However, these additions should be carefully evaluated against the "minimal" design principle, only adding features that provide clear business value.

## Design Principles Maintained {遵循的设计原则}

✅ **Minimal Design** - Only essential features implemented
✅ **Direct Calls** - No domain events (free service requirement)
✅ **DDD Anti-corruption Layer** - String references for cross-domain entities
✅ **Shared Primary Key** - Single entry point for all application types
✅ **Partial Batch Success** - Independent job application processing
✅ **Status Validation** - Enforced state machine transitions
✅ **Type Safety** - Full TypeScript types throughout

## References {参考文档}

- Design Document: `docs/placement_domain_design_v2.0.md`
- Mass Application Module Design: `docs/MASS_APPLICATION_MODULE_DESIGN.md`
- Architecture Decision Record: `docs/MASS_APPLICATION_MODULE_DESIGN.md:1054` (Architecture Decision List)
