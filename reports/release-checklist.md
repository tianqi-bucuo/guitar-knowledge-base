# 发布与离线验收记录

日期：2026-10-02。Release Task 4 基于已接受的 `eced1b0`（呈现与产物检查）、`ef87e4b`（来源校验修复）、`a7c9c98`（来源审计）及 `ca40755`（学习依赖图）。本记录区分既有人工证据、本次提交前自动 gate 和控制器随后执行的提交后复验。

## 交付范围

- 唯一内容源与 Obsidian vault：`content/`；首版 75 篇正式页面，覆盖十个批准模块。
- 数据与已提交的 SVG：`data/`、`content/assets/diagrams/`；阅读本地 SVG 无需运行生成器。
- Quartz 4.5.2 静态输出：`public/`，可丢弃并重新构建；不手工维护。
- Node >=22、npm >=10.9.2；本次工具版本为 Node 25.8.0、npm 11.11.0，使用已有安装，未安装依赖。
- 本次只补充 npm 命令、README、本地偏好忽略规则及本记录；内容、来源报告、呈现代码与已有测试保持已验收版本。

## Obsidian 原生离线检查

复用控制器 2026-10-02 的原生 UI 观察，Obsidian 1.13.7，vault 为 `/Users/chenkunya/Documents/吉他/content`。当前 renderer 的 DevTools Network 设为 **Offline**、启用 **Disable cache** 后重载。不是系统断网，不证明主进程所有网络通道隔离。vault 外的仓库 `node_modules` 没有删除或移动。较早四页检查时没有预览服务器；最终术语/路线增量检查时，独立的 loopback 静态服务器正在运行，但 vault 没有请求它。两轮均未启动 Quartz dev server。正文、脚注和本地 SVG 的实际渲染由 UI 观察确认。

| 指定页面         | 正文与本地导航                                               | 反向链接                      | SVG                                         | 结果 |
| ---------------- | ------------------------------------------------------------ | ----------------------------- | ------------------------------------------- | ---- |
| 学习路线总览     | 最终增量检查显示十模块，点击第 10 模块术语链接进入吉他术语表 | 最终观察 19 条                | 三类本地图/原图入口可见，app-local 请求 200 | PASS |
| C和弦            | 离线重载正文与脚注可读                                       | 当次观察 12 条                | x、两个 O、3/2/1 指位完整，本地请求 200     | PASS |
| 基础八分音符扫弦 | 正文、口数、动作和脚注可读                                   | 当次观察 8 条                 | 八格 ↓↑ 及第 1/3 拍重音可辨，本地请求 200   | PASS |
| 指板上的音名     | 正文、脚注和等价六弦位置表可读                               | 当次观察 6 条，并实际点击导航 | 零至五品完整指板、根音标记可辨              | PASS |
| 吉他术语表       | 最终增量检查术语、脚注可读；点击认识民谣吉他实际切换页面     | 7 条                          | N/A：此页无图示                             | PASS |

反向链接行为已通过“指板上的音名 → 音高音名与唱名”实际导航验证，正文 wikilink 通过“音高音名与唱名 → 吉他调音与标准音”及术语页课程链接验证。表中计数来自对应观察时点，不要求后续新增链接后数量相同。前四页的较早观察与最终路线/术语增量检查共同完成五页矩阵；没有重新操作 UI。

核心操作与练习、文字替代和 SVG 均在本地；外部影音/来源链接离线时可能不可用，不承担核心指令。观察后 Disable cache 已取消、Network 恢复 No throttling，DevTools 关闭，侧栏恢复；未更改账户、同步或系统网络。设备偏好/workspace 保持本机忽略状态，没有清除或提交。截图存在于控制器原生工具输出，没有保存为仓库文件。

## 已接受的来源、呈现与交互证据

- [来源结构报告](source-audit.md)：75 页、81 个独立引用来源、0 结构错误。来源写入与不写入比较分离，在线探测仅在显式运行 `audit:sources:online` 时发生；本次未执行。该报告不代表事实、版权许可、医疗结论或网络健康认证。
- [内容安全与版权审阅](content-review.md)：保留其人工观察、直接来源阅读与复用脚注的范围；本次没有重新爬取或扩展事实核查。
- [呈现与静态产物 QA](visual-qa.md)：控制器实际检查八页 × 桌面 1440×900/手机 390×844 × 浅色/深色，共 32 个布局状态；搜索、标签、反向链接、Explorer、关系图展示及 SVG 原图导航按所记录交互通过。后续手机搜索截断只复验受影响的手机搜索与桌面预览。

真实中文搜索目标排名：横按第 3，六八拍、手腕、变调夹、顺阶和弦均第 1，全部满足前 5。静态测试核对目标与索引，排名依据实际 UI，未模拟搜索算法。

呈现报告记录 CSS、JS、最大 SVG、精确 `contentIndex.json` 和完整输出树的批准字节上限；本次 gate 再检查这些上限。字节量不是加载/CPU 性能。浏览器为 Codex in-app-browser，支持的接口未提供引擎版本；截图保留在控制器工具输出，未捏造持久截图路径。物理触摸/捏合、完整键盘顺序、图节点导航、屏幕阅读器、其他浏览器引擎、OS 离线和完整 WCAG 合规没有验证。

## 干净构建与提交前 gate

固定命令：

```bash
npm run verify:release
```

顺序为 `npm test && npm run check && npm run check:release && npm run diagrams:check && npm run check:sources && npm run build:site && npm run check:site-output && npm run test:site-output`。泛用测试不包含产物测试；`check:sources` 不写报告；没有在线探测或部署。

本次提交前运行 `npm run verify:release` 一次，退出码 **0**。运行前使用新建临时目录保存原 `public/`，并确认仓库中不再有 `public/`，随后由 gate 重新构建。备份路径记录在 Task 4 交接报告，备份保留；没有清理已有其他目录或备份。

| 阶段              | 实际输出/结果                                                     |
| ----------------- | ----------------------------------------------------------------- |
| npm test          | 264 tests，264 pass，0 fail                                       |
| check             | TypeScript 通过；All matched files use Prettier code style        |
| check:release     | Summary: 0 error(s), 0 warning(s)                                 |
| diagrams:check    | DIAGRAMS_CURRENT 17                                               |
| check:sources     | 75 pages，81 sources，0 structural error(s)；报告未改写           |
| build:site        | Found 75 input files，Parsed 75 Markdown files，Emitted 228 files |
| check:site-output | Verified offline Quartz build output in public/                   |
| test:site-output  | 7 tests，7 pass，0 fail；75 页与字节预算通过                      |

本次产物字节：CSS 46515、JS 712157、最大 SVG 12604、`contentIndex.json` 406925、完整输出树 6146646，与已接受的最终呈现报告一致。运行中出现已记录的 `DEP0040` 非阻断弃用警告。gate 后的文档证据补写和预览/离线方法文字纠正单独完成格式与差异检查；没有重复运行完整 gate，也没有更改通过测试的源码或依赖。

## 保留的限制与最终交接

- 继承的 Node `DEP0040`（punycode）弃用警告为非阻断问题，不声称无警告。
- 原始 SVG 打开时曾出现 `Cannot use 'in' operator to search for 'animation' in undefined`。控制器在仅打开本地 SVG 的独立 in-app-browser tab 重现；该资源是 `image/svg+xml`、根节点 svg、无脚本，Quartz 分发脚本没有对应检查。证据支持无 Quartz 页面脚本也能重现，但没有确定浏览器/工具内部原因。原图显示与 Back 返回正常；不声称控制台零错误。
- 外部链接可在离线时不可用；Obsidian 的检查仅为当前 renderer 离线模拟，未移除依赖或隔离系统网络。
- Quartz `npm run dev` 的服务器未明确绑定 loopback；README 给出明确绑定 `127.0.0.1:8080` 的已有 `serve-handler` 静态预览替代。控制器持有当前静态 QA 服务器，并负责最终停止。
- 提交、提交后的完整复验及干净 Git 确认由控制器随后执行；这里没有将未来结果标为已通过。
- 本次交付仅为本地内容与静态发布候选；没有 push、部署、托管注册、云同步、分析、评论或后台服务。
