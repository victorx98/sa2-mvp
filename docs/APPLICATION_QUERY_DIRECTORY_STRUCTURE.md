# Application Query 目录结构（推荐版 + 折中版）

适用场景：NestJS + Drizzle ORM + DDD。以下用“截图式树形结构”展示目录组织；其中 **Port（接口/契约）放在 Application 是推荐且刻意的设计**：让应用层只依赖抽象，外层基础设施去实现它。

## 1) 推荐结构：Ports 在 Application，Adapters 在最外层 Infrastructure

```
src/
├─ application/
│  ├─ queries/                                 # 查询用例编排（聚合/权限/DTO裁剪）
│  │  └─ students/
│  │     └─ list-students.query.ts
│  │
│  └─ read-model/                              # 读侧契约（Ports）与 DTO（可选）
│     ├─ ports/
│     │  ├─ student.read-model.port.ts         # interface + DI Token（纯抽象，无 Drizzle/schema）
│     │  └─ index.ts
│     └─ dto/
│        ├─ student-list-item.dto.ts           # Read Model DTO（不放领域实体）
│        └─ index.ts
│
└─ infrastructure/
   ├─ database/                                # 连接/事务/schema/migrations 等共享 DB 能力
   └─ modules/
      └─ identity/                             # 按业务模块/限界上下文切片（示例）
         └─ read-model/
            ├─ drizzle-student.read-model.ts   # Adapter：用 Drizzle/SQL 实现 Port
            └─ identity-read-model.module.ts   # providers: { provide: TOKEN, useClass: Drizzle... }
```

要点：
- `application/read-model/ports/**` 只放“能力契约”，**不 import** Drizzle/schema/DB connection。
- `infrastructure/modules/**/read-model/**` 放实现（adapter），**允许 import** Drizzle/schema/DB connection。
- `application/queries/**` 作为用例编排层，只依赖 Port 的 token/interface，从而隔离技术细节。

## 2) 折中结构：实现暂放在 Application（不推荐，但可短期过渡）

```
src/application/
└─ queries/
   ├─ interfaces/                              # Port（接口/契约）+ token
   │  ├─ student-query.interface.ts
   │  └─ index.ts
   ├─ infrastructure/                          # 实现（在 Application 内）
   │  └─ services/
   │     ├─ drizzle-student-query.service.ts
   │     └─ index.ts
   ├─ use-cases/
   │  └─ list-students.query.ts
   └─ dto/
      └─ student-list-item.dto.ts
```

风险提示：
- Application 会直接依赖 Drizzle/schema，后续换 ORM/数据源、加缓存/读写分离时迁移成本更高。
- 适合“先跑起来”的阶段，但建议逐步迁到“推荐结构”。
