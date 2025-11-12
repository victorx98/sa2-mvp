---
trigger: always_on
---
# 创建项目代码规范
- 强制 使用Drizzle Kit 自动生成 数据库Migrations（`npm run db:generate`）
- 强制 supabase MCP 更新数据库表结构

# 代码生成规则
- 禁止 在 `src/api` 目录下生成任何代码
- 禁止 在 `src/application` 目录下生成任何代码
- 保持 项目的目录结构不变
- 强制 event 的类型定义在 `src/shared/events` 目录下
- 强制 新生成的 markdown 文件,必须在 `src/docs` 目录下
- 强制 单元测试文件必须在代码文件同目录下
- 强制 集成测试文件在 `@test/[模块名称]/` 目录下

## 生成代码位置，其它位置不允许生成代码
- Contract Domain 对应用的代码位置有：
  - @src/domains/contract/ 中的所有文件
  - @test/contract/ 中的所有文件
  - @src/infrastructure/database/ 中的所有文件

  - Catalog Domain 对应用的代码位置有：
    - @src/domains/catalog/ 中的所有文件
    - @test/catalog/ 中的所有文件
    - @src/infrastructure/database/ 中的所有文件

  - Financial Domain 对应用的代码位置有：
    - @src/domains/financial/ 中的所有文件
    - @test/financial/ 中的所有文件
    - @src/infrastructure/database/ 中的所有文件

  - Placement Domain 对应用的代码位置有：
    - @src/domains/placement/ 中的所有文件
    - @test/placement/ 中的所有文件
    - @src/infrastructure/database/ 中的所有文件