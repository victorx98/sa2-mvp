---
trigger: always_on
---

# 项目编码范围（代码生成范围）
- 只包含：
    - @src/domains/contract/ 中的所有文件
    - @src/domains/catalog/ 中的所有文件
    - @src/domains/financial/ 中的所有文件
    - @src/infrastructure/database/ 中的所有文件
    
    - @test/domains/contract/ 中的所有文件
    - @test/domains/catalog/ 中的所有文件
    - @test/domains/financial/ 中的所有文件

# 创建项目代码规范

- 使用'Drizzle Kit' 自动生成 数据库Migrations（`npm run db:generate`）
- 使用'supabase MCP 工具' 更新数据库表结构

# 代码生成规则

- `不允许`在 `src/api` 目录下生成任何代码
- `不允许`在 `src/application` 目录下生成任何代码
- 新生成的 markdown 文件,`必须`在 `src/docs` 目录下
- `单元测试`文件'必须'在代码文件同目录下
- `集成测试`文件在 `@test/[模块名称]/` 目录下
- `单元测试`使用 `mock数据`
- `集成测试`使用 `真实数据`
- event 使用`nestjs` 中的 `EventEmitter2`
- 找不到文件时，`必须`询问我如何处理（创建新文件或跳过）

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
