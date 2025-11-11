## 代码合入规范

### 开发约定
- **补充测试**：新增或修改代码时同步补充测试，测试统一配置 `jest.config.js`。
  - 单元测试：与被测代码同级，文件后缀建议使用 `*.spec.ts` 或 `*.test.ts`，方便 VS Code 单独运行。
  - 集成测试：放置在 `test/<feature>/<specific-feature>.spec.ts`。
  - 仓库主要是单元测试，少量集成测试。单元测试要覆盖尽量全的代码逻辑，集成测试只需要覆盖主干逻辑，二者数量比应该是8:2/9:1
- **本地验证**：
  - 保证全部单元测试 `npm run test:unit` ✅
  - 保证全部集成测试 `npm run test:e2e` ✅
  - 或者，一次执行全部测试用例，`npm run test`，全部✅

### 工具约束
在GitHub上面配置 GitHub Action, 要求 PR 在合入 `main` 分支前, 自动执行全量用例测试，且要求通过100%

1. **GitHub Actions 工作流**
   在仓库根目录创建或更新 `.github/workflows/test.yml`：
   ```yaml
   name: CI

   on:
     pull_request:
       branches:
         - main
     push:
       branches:
         - main

   jobs:
     test:
       runs-on: ubuntu-latest

       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: npm
         - run: npm ci
         - run: npm run test
   ```
   - 在 GitHub 分支保护规则里勾选 Require
  status checks to pass before merging 并选择对应的 CI 检查。这样只要测试没全部通过（包括覆盖率阈值等都由
  npm run test 自己判定），GitHub 就会拒绝合并

