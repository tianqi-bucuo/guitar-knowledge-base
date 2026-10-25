# 民谣吉他知识库

以简体中文编写的民谣吉他知识库，覆盖零基础到中级乐理与编配。当前清单包含 97 篇正式页面、十个模块，学习路线与百科索引共用正文。同一份 `content/` Markdown 可在 Obsidian 中离线阅读和编辑，也可由仓库固定的 Quartz 4.5.2 生成带中文搜索、导航、反向链接和关系图谱的静态网站。

在线站点：<https://tianqi-bucuo.github.io/guitar-knowledge-base/>

## 环境与安装

- Node.js >=22
- npm >=10.9.2

在仓库根目录安装锁定依赖：

```bash
npm ci
```

开发检查和构建需要这些依赖；Obsidian 阅读本地 Markdown 与已提交的 SVG 无需运行生成器或 Quartz 服务器。首次安装依赖需要取得 npm 包，之后的发布 gate 不包含在线来源探测。

## 本地阅读与编辑

在 Obsidian 中选择“打开本地仓库”，打开本仓库的 `content/` 目录作为 vault。初学从 `学习路线总览` 顺序学习；已有基础则从 `中级乐理学习路线` 进入六阶段课程，完成后用 `中级乐理综合测验` 回查薄弱环节。也可通过 `吉他术语表`、和弦与节奏索引查阅。Obsidian 会显示正文 wikilink、反向链接以及 `content/assets/diagrams/` 中已提交的本地 SVG；外部视频或资料链接离线时可以不可用，核心步骤、练习、答案与图示保存在本地。

`content/` 是唯一内容源；`public/` 是可重新生成的输出，不要手工编辑。Obsidian 的 workspace、cache 以及 app、appearance、core-plugins 本地偏好均被忽略，保留在本机。项目没有配置云同步、账户或本站音视频服务。

### 页面模板工作流

1. 从 `content/templates/教学文章模板.md`、`索引页模板.md` 或 `路线页模板.md` 复制相应模板，放入对应中文模块目录；模板目录不发布。
2. 更新 title、description、稳定英文 permalink、type、受控 tags 与正文；教学页填写 level、真实 prerequisites。创作时保留 `draft: true`。
3. 以自己的文字编写操作、可观察练习和自检标准，补齐真实 wikilink、适用图示和页面内来源脚注；访问日期填实际查阅日期。
4. 按 `data/content-manifest.yml` 的页面身份、模块和顺序维护清单，保持当前 97 页发布范围。调整先修关系时同步基础与中级学习路线；新增范围需要另行评审。
5. 运行作者检查，在 Obsidian 与本地网站查看修改，完成审阅后设为 `draft: false`，再运行发布检查。

```bash
npm run check:content
npm run check:release
```

作者模式允许计划页面未完成及草稿，缺失页或篇数不足产生 warning；现有页面的元数据、结构、内部链接、附件及占位文本错误仍阻断。发布模式要求 97 篇必需页面齐全、覆盖十个模块且没有草稿，同时检查先修依赖、学习图连通性和 8 条搜索断言。

### 图示更新

修改 `data/` 下相应和弦、指板或节奏定义，再生成并检查 SVG，将数据与生成后的 SVG 一起审阅：

```bash
npm run diagrams:generate
npm run diagrams:check
```

SVG 已提交到 vault，离线阅读时无需 `node_modules` 参与渲染。宽图提供等价文字和本地原图入口。

## 检查与来源报告

```bash
npm test
npm run check
npm run verify
```

`npm test` 运行构建前的配置、内容和图示测试；`npm run check` 检查 TypeScript 与格式。`verify` 依次执行单元测试、类型/格式、作者内容检查、图示检查及生产构建。Quartz 上游工具测试可单独通过 `npm run test:quartz` 运行。

来源检查分为写报告、无写入核对和可选在线探测：

```bash
npm run audit:sources:write
npm run check:sources
```

第一个命令确定性更新 [来源结构报告](reports/source-audit.md)，第二个重新计算并比较已有报告，不写文件。结构检查覆盖 URL、日期、脚注和来源目录一致性；它不证明每项事实、版权许可或外部网址当前可用性。[内容安全与版权审阅](reports/content-review.md) 保留其实际人工审阅和来源核对范围。

确实需要联网检查外部网址时，单独运行：

```bash
npm run audit:sources:online
```

在线报告 `reports/source-audit-online.md` 被忽略，网络失败仅为 warning；该命令不进入发布 gate，也不替代人工来源审阅。

## 预览与生产构建

使用仓库本地 Quartz 入口启动构建、监视和预览：

```bash
npm run dev
# 等价入口：npm run quartz -- build --serve --port 8080
```

浏览器访问 `http://localhost:8080`，完成后 Ctrl+C 停止。Quartz 的默认服务器没有明确绑定 loopback；访问 localhost 不代表它只接受本机连接。需要明确只监听本机时，先构建，再用已安装的 `serve-handler` 启动静态预览（无实时重建）：

```bash
npm run build:site
node --input-type=module -e 'import http from "node:http"; import handler from "serve-handler"; http.createServer((req, res) => handler(req, res, { public: "public", cleanUrls: true, directoryListing: false })).listen(8080, "127.0.0.1")'
```

此替代预览访问 `http://127.0.0.1:8080`，结束同样使用 Ctrl+C。一次只使用一个 8080 端口的预览进程。

```bash
npm run build:site
npm run check:site-output
npm run test:site-output
```

生产构建输出到 `public/`。真实产物检查核对离线资源、社交 URL、CJK 字体顺序与禁用的 RSS/sitemap/OG 输出；独立构建产物测试核对 97 页、搜索索引、标题/控件/图示和文件字节预算。两项产物检查必须在新构建后执行，不在通用 `npm test` 中读取旧输出。[呈现与产物 QA](reports/visual-qa.md) 记录真实浏览器检查、批准字节预算和观察限制；字节预算不是加载时间或 CPU 性能测试。

## 发布交接

完整的本地发布 gate：

```bash
npm run verify:release
```

固定顺序：`npm test` → `check` → `check:release` → `diagrams:check` → `check:sources` → `build:site` → `check:site-output` → `test:site-output`。其中来源检查不写报告，gate 不运行在线探测。需要复验干净构建时，可先把现有 `public/` 移到仓库外新建的临时备份目录，再运行此命令；保留备份直到确认无需恢复。

[发布与离线验收记录](reports/release-checklist.md) 汇总实际检查及限制。Obsidian 五页检查使用 1.13.7 的当前 renderer Offline 与禁用缓存，随后恢复；没有断开系统网络或删除依赖。运行时 QA 覆盖指定页、视口、主题和有限交互，未作完整 WCAG、屏幕阅读器或跨浏览器认证。继承的 Node `DEP0040` 警告与隔离到无 Quartz 脚本原始 SVG 的 in-app-browser console 观察均在报告中保留。

推送到 `main` 分支后，GitHub Actions 会执行完整发布 gate，并将通过验证的 `public/` 产物部署到 GitHub Pages。云同步、分析、评论和后台服务仍不在本项目范围。

## 设计与实施依据

- [设计规范](docs/superpowers/specs/2026-08-22-guitar-knowledge-base-design.md)
- [实施路线图](docs/superpowers/plans/2026-08-22-guitar-knowledge-base-roadmap.md)
- [基础平台与内容校验计划](docs/superpowers/plans/2026-08-22-guitar-kb-foundation-plan.md)
- [SVG 图示系统计划](docs/superpowers/plans/2026-08-22-guitar-kb-diagrams-plan.md)
- [75 篇正文建设计划](docs/superpowers/plans/2026-08-22-guitar-kb-content-plan.md)
- [发布与质量验收计划](docs/superpowers/plans/2026-08-22-guitar-kb-release-plan.md)
- [中级乐理扩展设计](docs/superpowers/specs/2026-10-02-guitar-intermediate-theory-design.md)
- [中级乐理扩展计划](docs/superpowers/plans/2026-10-02-guitar-intermediate-theory-plan.md)
