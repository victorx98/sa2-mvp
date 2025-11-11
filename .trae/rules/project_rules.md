- 强制 代码使用英文+中文注释（英文注释[中文注释]）
- 强制 exception使用英文
- 强制 claude code使用中文对话
- 强制 TRAE 使用中文对话
- 强制 markdown文件使用中文
- 强制 使用Drizzle Kit 自动生成 数据库Migrations（`npm run db:generate`）
- 强制 supabase MCP 更新数据库表结构
- 强制 没有未使用的 import 语句
- 强制 ESLint 检查通过 (`npm run lint`)
- 强制 Prettier 格式化正常 (`npm run format`)
- 强制 所有文件遵循项目代码规范

- 禁止 创建任何形式的总结文档
- 禁止 创建代码备份文件

# 代码生成规则
- 禁止 在 `src/api` 目录下生成任何代码
- 禁止 在 `src/application` 目录下生成任何代码

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