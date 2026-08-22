# 民谣吉他知识库

这是一个以简体中文编写的民谣吉他知识库。同一份 `content/` Markdown 内容既可在 Obsidian 中离线编辑和阅读，也可由 Quartz 4.5.2 生成静态网站。

## 环境要求

- Node.js 22 或更高版本
- npm 10.9.2 或更高版本

首次使用时安装锁定的依赖：

```bash
npm ci
```

## 编辑内容

在 Obsidian 中选择“打开本地仓库”，并将仓库内的 `content/` 目录作为 vault 打开。`content/` 是唯一内容源；不要手工编辑生成的 `public/`。

作者日常检查允许清单中的计划页面尚未创建，也允许现有页面保留 `draft: true`；缺失页和当前页数不足只会产生 warning。现有页面的元数据、结构、内部链接、附件或占位文本错误仍会阻断检查：

```bash
npm run check:content
```

发布检查要求必需页面齐全、正式页面总数在 60–80 篇之间，并禁止 `draft: true`：

```bash
npm run check:release
```

目前发布检查预期失败，原因仅是 75 篇正文阶段尚未完成，正式页面总数还未达到 60–80 篇的发布范围。

## 验证与预览

提交前运行完整的基础验证；它会依次执行单元测试、类型与格式检查、作者模式内容检查和 Quartz 生产构建：

```bash
npm run verify
```

启动 Quartz 本地预览：

```bash
npm run quartz -- build --serve
```

请使用以上本地 `quartz` 脚本入口，以确保调用仓库固定的 Quartz 4.5.2 版本。

后续发布验收的固定顺序是：单元测试 → 类型与格式检查 → release 内容检查 → 站点构建 → 构建产物测试。构建产物测试不会放入通用 `npm test`，避免依赖旧的 `public/`。

通用 `npm test` 只运行知识库的构建前单元测试；需要单独回归导入的 Quartz 上游工具测试时运行 `npm run test:quartz`。
