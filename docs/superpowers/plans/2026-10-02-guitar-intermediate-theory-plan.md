# 吉他知识库中级乐理扩充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同一个吉他知识库中完成可自学、可推导、可用于吉他分析与演奏的中级乐理课程。

**Architecture:** 深化 15 篇既有核心课，新增 22 篇正式页面，形成 97 篇清单；这一数字是逐页拆分的结果，不是质量指标。保持既有十个模块、页面身份和 Quartz／Obsidian 单一内容源，通过真实先修关系与独立的中级路线连接内容。写作按不重叠文件分批并行，公共清单、旧测试迁移与导航由集成负责人统一修改。

**Tech Stack:** Markdown、YAML、本地 SVG、Quartz 4.5.2、Obsidian；TypeScript、Node.js `node:test`、现有 `tsx`／remark／js-yaml；不新增依赖。

**Spec:** [已批准的中级乐理扩充设计](../specs/2026-10-02-guitar-intermediate-theory-design.md)。执行者须完整阅读设计及本计划。

## Global Constraints

- 用户要求直接在 `main` 工作，不创建分支或工作树；保留这一选择。
- 不更换 Quartz，不新增知识库子系统或第二套内容源，不手写 `public/` 中的生成文件。
- 保留既有正式页面的文件路径、标题、manifest ID 和 `permalink`。
- 沿用教学页八个二级栏目，通过三级标题组织推导、例题和答案。
- 不统一设置正文最低字数；“中级”不以篇数、字数、图片数量或测试数量定义。
- 所有课程正文和答案均可离线阅读；外部链接用于来源和补充，不承担正文中的必要解释。
- 不新增互动工具、账号、云同步、音视频制作、托管部署、前端改版或依赖升级。
- 原创解释、原创短练习与谱例；关键结论逐项查阅来源，不复制教材或歌曲。
- 自动检查不替代逐页内容审校；不得自行推送或部署。
- 现有未跟踪 `.impeccable/` 与本轮无关，保留且不提交；不把旧验收记录当作本轮证据。

## Review Focus

1. 相同半音数却拼写不同、跨八度或跨二／三弦：保留度数、性质、音区和实际音高的区别；Task 3 测 C–D♯／C–E♭及跨弦坐标。
2. 休止、延音、连音与复拍子混用：时值相同不代表发声次数或分组相同；Task 2 核对谱例事件、总时值与主拍。
3. 小调、调式和借用使用不同级数约定：说明基准，不把临时主音化自动判成转调；Task 4 与 Task 6 验证带上下文的对比例。
4. 同一和弦不同低音、挂留与附加音：实际发声音决定分析，不按手型或符号猜测；Task 5 核对音集合、最低音和七音有无。
5. 读者离线跳入中级课程：题目和答案一一对应，必要前置可到达，不能依赖外部音视频或不相关演奏技术；Task 8／9 验证依赖、答案与双端阅读。

---

## 文件边界与共同契约

以下路径均相对仓库根目录 `/Users/chenkunya/Documents/吉他`。表格中正文路径相对 `content/`；每行对应一个文件，均为本计划确定的教学主题。

- 核心正文：Task 2–7，按下面两张表分配所有权。每页都满足设计 §4，不能仅完成表中的一个测试例。
- 导航／测验／引用：Task 8；更新 `content/index.md`、`content/00-从这里开始/如何使用知识库.md`、`content/00-从这里开始/学习路线总览.md`、`content/00-从这里开始/开始前自测.md`、`content/07-练习与复盘/阶段测验.md`、`content/09-术语与参考资料/吉他术语表.md`、`和弦索引.md`、`节奏型索引.md`、`常见问题索引.md`、`参考来源总表.md`（最后五个均在 `09-术语与参考资料/` 下）。这些旧页只做衔接所需修改，不计入 15 篇深化课。
- 两个必要的自制谱例：Task 2 创建 `content/assets/examples/rhythm-reading.svg`；Task 3 创建 `content/assets/examples/notation-comparison.svg`。每个不超过 16,384 字节，含 `<title>`、可读标签，无脚本、外部资源或音乐字体依赖。保留既有 17 张生成图和生成器不变。
- 发布工具：Task 1 仅改 `scripts/content/loadManifest.ts`、`scripts/content/validateMetadata.ts`；Task 8 修改 `data/content-manifest.yml`。不改类型枚举、框架配置或布局。
- 新测试：`tests/content/intermediate-{contracts,rhythm,pitch,scales,chords,harmony,application,integration}.test.ts` 中花括号表示八个明确文件；共同辅助仅在 `tests/content/helpers/lessonAssertions.ts`。
- 审校证据：各内容任务分别创建 `reports/theory-expansion/{rhythm,pitch,scales,chords,harmony,application}.md`；Task 8 创建 `reports/theory-expansion/integration.md`；Task 9 创建 `reports/theory-expansion/acceptance.md`。旧报告保留；`reports/source-audit.md` 作为当前生成报告更新。

### A. 15 篇既有核心课：保留身份，深化正文

先修列是最终 `prerequisites` 的完整值，以中文标题写入；它表达必要知识而非上一页。其他旧教学页的先修不改。

| Task | 文件                                | 最终先修（分号分隔）                             | 深化与独立验收点                                                                                     |
| ---- | ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 2    | 03-节奏系统/节拍拍号与小节.md       | 空数组                                           | 主拍与细分；3/4、6/8 分组；不以横按为前提                                                            |
| 2    | 03-节奏系统/四分八分与十六分音符.md | 节拍拍号与小节                                   | 时值比例、符尾／符杠、不同速度下的相对关系与计算解析                                                 |
| 2    | 03-节奏系统/六八拍伴奏.md           | 节拍拍号与小节；四分八分与十六分音符；三拍子伴奏 | 复二拍与三拍对照；大拍、细分和伴奏发声位置                                                           |
| 2    | 03-节奏系统/切分节奏入门.md         | 重音与强弱层次；休止附点与延音线                 | 弱位起音、跨强位延续、休止与重音对比例及口数                                                         |
| 3    | 06-基础乐理与指板/音高音名与唱名.md | 吉他调音与标准音                                 | 音名、音区、固定音高与首调唱名；移调后不能照搬唱名映射                                               |
| 3    | 06-基础乐理与指板/指板上的音名.md   | 音高音名与唱名                                   | 从已有 0–5 品扩至八度关系、0–12 品推导、跨弦同音及二／三弦边界                                       |
| 3    | 06-基础乐理与指板/全音与半音.md     | 指板上的音名                                     | 升降与还原、等音与字母拼写；把手型与音高距离分开                                                     |
| 3    | 06-基础乐理与指板/音程入门.md       | 全音与半音                                       | 补齐六／七度、增减音程，完整计数步骤与多根音练习                                                     |
| 4    | 06-基础乐理与指板/大调音阶.md       | 音程入门；指板上的音名                           | C、G、F、D 的推导与迁移，保留字母次序和必要升降号                                                    |
| 4    | 06-基础乐理与指板/调与调号.md       | 大调音阶                                         | 调号、主音和实际旋律证据；不再以前面的弹唱移调课为前提                                               |
| 5    | 06-基础乐理与指板/三和弦构成.md     | 音程入门；大调音阶；和弦图读法                   | 多根音四类三和弦推导；重复音、音区、根音与配置的区别                                                 |
| 5    | 02-和弦系统/常用七和弦.md           | D与Dm和弦                                        | 保留入门按法和安全边界，补实际发声音、自检与带解析练习；理论完整推导链接新七和弦课，不能形成互为先修 |
| 6    | 06-基础乐理与指板/顺阶和弦与级数.md | 三和弦构成；调与调号                             | 大调三和弦逐级推导、跨调级数迁移；小调和七和弦细节分别指向主讲页                                     |
| 7    | 05-弹唱与伴奏/和弦级数与移调.md     | 变调夹原理与用法；C-Am-F-G和弦进行               | 完整保留旧原创八小节示例，再补纸上推导、音区与实际调核对；初学操作仍可先学                           |
| 7    | 05-弹唱与伴奏/完整歌曲编配流程.md   | 和弦级数与移调；前奏间奏与尾奏；弹唱协调训练     | 保留入门流程，补与新分析实战的衔接、决策理由及开放题解析；进阶章节作为后续而非入门强制前置           |

### B. 22 篇新增正式页面

ID 与永久链接均在此锁定；除学习路线为 `type: path` 外均为 `type: lesson`，最终 `required: true`、`draft: false`。模块取所在目录；难度按内容使用既有“基础／进阶”，标签取既有枚举。新课的元数据不得只写“大量先修”，须精确采用本表。

| Task | 文件                                        | ID；permalink                                                            | 先修                                                           | 主讲与验收点                                                                                     |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 2    | 03-节奏系统/休止附点与延音线.md             | rests-dots-ties；/rhythm/rests-dots-ties                                 | 四分八分与十六分音符                                           | 休止、附点、延音线／连音线；跨拍跨小节的起音与持续事件                                           |
| 2    | 03-节奏系统/连音与节奏分组.md               | tuplets-grouping；/rhythm/tuplets-grouping                               | 休止附点与延音线；节拍拍号与小节                               | 三连音比例、复拍子正常细分、符杠分组与朗读                                                       |
| 3    | 06-基础乐理与指板/五线谱简谱与六线谱.md     | reading-notation；/theory/reading-notation                               | 音高音名与唱名；四分八分与十六分音符                           | 同一个原创短句的三种记法；吉他谱面／实响八度、TAB 弦序、简谱调标与音区                           |
| 3    | 06-基础乐理与指板/音程转位与复音程.md       | interval-inversion；/theory/interval-inversion                           | 音程入门                                                       | 单音程转位、复音程还原与音区；不能只模 12 丢失度数                                               |
| 4    | 06-基础乐理与指板/小调音阶.md               | minor-scales；/theory/minor-scales                                       | 大调音阶；调与调号                                             | 自然／和声／旋律小调；古典上下行约定与其他语境的边界                                             |
| 4    | 06-基础乐理与指板/关系调同主音调与五度圈.md | key-relationships；/theory/key-relationships                             | 小调音阶；调与调号                                             | 相同调号不等于相同中心；同主音比较、五度圈与调号推导                                             |
| 4    | 06-基础乐理与指板/五声音阶.md               | pentatonic-scales；/theory/pentatonic-scales                             | 小调音阶；指板上的音名                                         | 大小调五声音阶的音级选择、关系与指板应用，不只给盒形                                             |
| 4    | 06-基础乐理与指板/调式入门.md               | modes；/theory/modes                                                     | 小调音阶；关系调同主音调与五度圈                               | 七种常用自然调式概览；重点比较同主音 Dorian／Aeolian、Mixolydian／Ionian；中心不能由起音自动决定 |
| 5    | 06-基础乐理与指板/七和弦构成.md             | seventh-chord-theory；/theory/seventh-chord-theory                       | 三和弦构成；音程转位与复音程                                   | 大七、属七、小七、半减七、减七的组成与符号；用小大七说明名称组合，不展开高级扩展和声             |
| 5    | 06-基础乐理与指板/和弦转位与低音.md         | inversions-bass；/theory/inversions-bass                                 | 七和弦构成                                                     | 三和弦两种／七和弦三种转位，斜线和弦与非和弦低音；实际音区决定最低音                             |
| 5    | 06-基础乐理与指板/挂留和弦与附加音和弦.md   | sus-add-chords；/theory/sus-add-chords                                   | 七和弦构成                                                     | sus2／sus4、add9／9 的音组成区别，符号 sus 与声部挂留不混同                                      |
| 6    | 06-基础乐理与指板/和声功能.md               | harmonic-function；/theory/harmonic-function                             | 顺阶和弦与级数；七和弦构成；节拍拍号与小节                     | T／PD／D 的语境与连接，主音延长、和声节奏；不把所有风格套进唯一序列                              |
| 6    | 06-基础乐理与指板/终止式与乐句.md           | cadences-phrases；/theory/cadences-phrases                               | 和声功能；和弦转位与低音；节拍拍号与小节                       | 正格、半终止、变格、阻碍；正格内部条件；结合句末旋律、低音与节奏判断                             |
| 6    | 06-基础乐理与指板/小调和声.md               | minor-harmony；/theory/minor-harmony                                     | 小调音阶；顺阶和弦与级数；和声功能                             | 自然小调和弦集合及升高导音的功能需要，v／V／V7、七级和弦与拼写                                   |
| 6    | 06-基础乐理与指板/副属和弦.md               | secondary-dominants；/theory/secondary-dominants                         | 小调和声；终止式与乐句                                         | 主音化、V/x 与 V7/x、目标和弦及后续；不能只凭一个变化音下结论                                    |
| 6    | 06-基础乐理与指板/调式借用.md               | modal-mixture；/theory/modal-mixture                                     | 小调和声；关系调同主音调与五度圈                               | 同主音借用、常见 iv／♭VI／♭VII 等在明确语境中的分析；与副属区别                                  |
| 6    | 06-基础乐理与指板/转调入门.md               | modulation；/theory/modulation                                           | 副属和弦；调式借用                                             | 临时主音化与新调确立；共同和弦和直接转调；不靠单一和弦或调号判定                                 |
| 7    | 05-弹唱与伴奏/声部连接与和弦配置.md         | voice-leading；/accompaniment/voice-leading                              | 和弦转位与低音；和声功能                                       | 共同音、级进、不同声部运动、吉他配置；古典规则与弹唱使用边界                                     |
| 7    | 05-弹唱与伴奏/旋律配和弦与非和弦音.md       | melody-harmonization；/accompaniment/melody-harmonization                | 声部连接与和弦配置；终止式与乐句；五线谱简谱与六线谱           | 旋律结构音与经过、辅助、先现、挂留；根据上下文选择不止一套合理和声                               |
| 7    | 05-弹唱与伴奏/乐句分析与编配实战.md         | phrase-arrangement；/accompaniment/phrase-arrangement                    | 旋律配和弦与非和弦音；转调入门；连音与节奏分组；和弦级数与移调 | 大调与小调原创乐句完整分析、配置和移调，解释选择与替代方案                                       |
| 8    | 00-从这里开始/中级乐理学习路线.md           | intermediate-theory-path；/start/intermediate-theory                     | path，不设 lesson 先修                                         | 六阶段入口、分支、回退、具体阶段产出；复用正文，不另抄教材                                       |
| 8    | 07-练习与复盘/中级乐理综合测验.md           | intermediate-theory-assessment；/practice/intermediate-theory-assessment | 乐句分析与编配实战；调式入门；五声音阶                         | 六领域辨认／推导／应用题、对应答案、错因回退与综合开放题评分依据                                 |

### 共同写作与验证接口

- 使用 `scripts/content/parsePage.ts` 的 `parsePage(path: string): PageRecord`；`body` 是实际正文，`frontmatter` 是归一化元数据。不能只在独立数据文件中测试“正确答案”。
- 统一实响音区标记 C4 等；指板／按法从 6→1 弦记录，`x` 为不发声；谱面音高另行明确。和弦公式相对根音，大调参照的变化音级与大小调内部级数须标明基准。不同体系的旋律小调、终止和功能名称说明采用的约定，不能全局换词掩盖差异。
- 节奏以主拍二分／三分说明英文 simple／compound meter；使用中文“单／复拍子”时先定义本课口径，遇到不同教材分类先说明差异，不直接替换名称。
- SVG 局部测试消费 `scripts/content/validateLinks.ts` 的 `validateLinks(pages: PageRecord[], contentRoot: string): Diagnostic[]`：保留真实页面的 `file` 与图片 `linkTargets`，过滤掉与本测试无关的课程链接后断言诊断为空，并核对实际 SVG 大小、标题与正文替代文字；不能仅测试旧图片 fixture。
- 每页“分级练习”下含 `### 一级：辨认`、`### 二级：推导`、`### 三级：应用`、`### 答案与解析`；题号按 `R1`、`D1`、`A1` 等编号，答案逐题对应。测验也采用这一组织，开放题说明评价维度。
- 每个内容批次的审校报告逐页记录“目标／推导／迁移／对比／吉他应用／题答对应／来源论断／遗留问题”，附实际章节定位；未完成审校不能预填通过。脚注与真实来源用现有格式，访问日期为实际核查日。
- 局部测试只检查拥有的页面与其数据，不要求其他并行批次已经发布；全库清单、旧精确快照及来源总表在 Task 8 集成。中间批次不得因局部测试通过声称整库可发布。

## 执行依赖与提交纪律

`Task 1 → Task 2 ∥ Task 3 → Task 4 ∥ Task 5 → Task 6 → Task 7 → Task 8 → Task 9`。

Task 2 可与 Task 3、4、5 并行；Task 4／5 都在 Task 3 后开始，Task 5 使用已锁定的既有大调概念，不与 Task 4 争写文件。Task 7 等待 Task 2 和 Task 6 全部通过。主代理加工作者总数不超过可用槽位，优先同时两名编写者并留一个独立审校槽位。

各工作者只写本批正文、新测试和本批报告；不改 manifest、共同助手、旧测试、总索引。公共文件由集成负责人修改。每批先写可失败的测试再写正文，独立审校完成后由主代理逐文件暂存并提交，禁止 `git add .`。发现计划中的理论测试值与可靠来源冲突时先纠正计划并记录依据，不强行使正文符合错误测试。

## Task 1：可扩充的发布边界与最小内容测试工具

**Files:** Modify `scripts/content/loadManifest.ts`、`scripts/content/validateMetadata.ts`、`tests/content/manifest.test.ts`、`tests/content/metadata.test.ts`；Create `tests/content/helpers/lessonAssertions.ts`、`tests/content/intermediate-contracts.test.ts`。

**Interfaces:** 保留 `loadManifest(path: string): Manifest` 和 version 1。测试助手导出 `sectionText(body: string, heading: string): string`（精确标题的章节正文）、`tableRows(body: string, heading: string): string[][]`（指定章节内唯一表格的数据行，不含表头，缺失／多表则报错）；不创建音乐计算引擎。

- [ ] 写失败用例：沿用 `withManifest`，将 release 改为 `{ minPages: 97, maxPages: 97 }` 后断言 `assert.deepEqual(loadManifest(path).release, { minPages: 97, maxPages: 97 })`；保留 60／80 fixture 成功。新增对 0、负数、小数、字符串、缺字段及倒置上下限的拒绝用例，仍为 `MANIFEST_INVALID_RELEASE_BOUNDS`。
- [ ] 写零先修失败用例：对元数据 fixture 的合法 lesson 仅改 `prerequisites: []`，`assert.deepEqual(validateMetadata([page], manifest), [])`；缺失字段、非数组及 `['']` 仍分别返回 `LESSON_PREREQUISITES_REQUIRED`／`INVALID_PREREQUISITES`。零先修表示真实课程起点，不能编造不相关前置去满足旧规则。
- [ ] 写助手失败测试：`assert.equal(sectionText("## A\n甲\n### B\n乙\n## C\n丙", "A").trim(), "甲\n### B\n乙")`；`assert.deepEqual(tableRows("### 核对\n|音|值|\n|---|---|\n|C|0|", "核对"), [["C", "0"]])`；重复标题、缺表和多表须拒绝，标题中代码／强调按可见文字识别。
- [ ] 运行 `node --import tsx --test tests/content/manifest.test.ts tests/content/metadata.test.ts tests/content/intermediate-contracts.test.ts`，确认新边界／零先修／助手用例失败而非无关环境错误。
- [ ] 删除 manifest 解析器 60／80 硬编码，保留合法数值检查；元数据仅允许先修空数组，字段仍必填且非空项规则不变。用现有 remark AST 实现小型测试助手，助手只供测试使用，不能修改 `parsePage`。
- [ ] 重跑上述命令及 `npm test`；预期全部通过，实际 manifest 暂不改仍为首版 75 页。不要在此阶段创建空白课程页。
- [ ] 逐文件审查并提交：`feat: support configurable curriculum release bounds`。

## Task 2：节奏读写与时值推导（4 篇深化＋2 篇新增）

**Files:** 表 A／B 的 Task 2 六篇、`content/assets/examples/rhythm-reading.svg`、`tests/content/intermediate-rhythm.test.ts`、`reports/theory-expansion/rhythm.md`。

**Interfaces:** 消费 Task 1 助手；产出时值、主拍、细分及原创新谱例的统一含义，供 Task 3 的读谱课与 Task 7 的实战引用。

- [ ] 写失败测试，从 `节拍拍号与小节.md` 的“复拍子核对”表取行：`assert.deepEqual(tableRows(body, "复拍子核对"), [["6/8", "2", "附点四分", "3"], ["9/8", "3", "附点四分", "3"], ["12/8", "4", "附点四分", "3"]])`；另核对 3/4 为三个四分主拍。测试不能把普通 6/8 三等分标成三连音。
- [ ] 添加事件表检查：原创 4/4 谱例以四分音符为单位，附点四分＋八分＋四分休止＋两八分的时值为 `[1.5, 0.5, 1, 0.5, 0.5]`、总和 4；同音延音只一次起音，分开重奏两次；三个八分三连音合计一个四分时值。从正文读取数值，独立计算总量并核对答案。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-rhythm.test.ts`，确认缺页、缺推导表或错误旧表述导致失败。
- [ ] 查阅节奏原始教材后逐篇编写六课和原创 SVG。分清延音线、连音线和连音比例；图旁有同等信息的文本事件表，不能仅靠图像理解。完成所有练习解析与批次审校记录。
- [ ] 重跑 `node --import tsx --test tests/content/intermediate-rhythm.test.ts` 和 `npm run diagrams:check`，预期退出0；局部测试包含改变节奏事件／主拍数的错误副本和真实 SVG 检查。
- [ ] 独立审校六课的解释、练习、答案与谱例，记录逐页结果并修正问题。
- [ ] 逐文件提交 `content: deepen rhythm reading and duration reasoning`。

## Task 3：音高、读谱与完整音程（4 篇深化＋2 篇新增）

**Files:** 表 A／B 的 Task 3 六篇、`content/assets/examples/notation-comparison.svg`、`tests/content/intermediate-pitch.test.ts`、`reports/theory-expansion/pitch.md`。

**Interfaces:** 消费 Task 1 助手和锁定的节奏概念；产出音区、音程与记谱约定，供后续音阶、和弦和实战使用。只链接 Task 2，不修改其文件。

- [ ] 写失败测试，`音程入门.md` 的“音程对照”表须含 `assert.ok(rows.some(r => r.join("|") === "C4–D♯4|增二度|3"))` 与 `C4–E♭4|小三度|3`；完整表核对大／小六七度、纯四五度及常见增减音程。
- [ ] 核对实际转位表包含 `C4–E4 → E4–C5：大三度→小六度`，复音程表包含 `C4–D5：大九度／14 半音`；正文音位表断言 `3弦4品 = 2弦0品 = B3`、`6弦12品 = E3`。采用逐单元格预期而非只搜索词语。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-pitch.test.ts`，记录预期失败。
- [ ] 查证记谱、音程来源，编写六课和同一原创短句的三种记法 SVG。明确吉他谱面与实响的八度关系；给初学者最小读谱说明，不能要求先会整首编配。
- [ ] 重跑 `node --import tsx --test tests/content/intermediate-pitch.test.ts`，预期退出0；测试包含真实 SVG 检查，及把 D♯ 改成 E♭却不改音程名、把 B3 改成 B4 的错误副本。
- [ ] 独立核对正文、表格、SVG 和答案是否一致，记录逐页审校结果并修正问题。
- [ ] 逐文件提交 `content: expand pitch notation and interval reasoning`。

## Task 4：音阶与调性体系（2 篇深化＋4 篇新增）

**Files:** 表 A／B 的 Task 4 六篇、`tests/content/intermediate-scales.test.ts`、`reports/theory-expansion/scales.md`。

**Interfaces:** 消费音程与音区约定；产出大小调、调号、五声音阶和调式语境。与 Task 5 并行，双方使用相同已锁定大调定义。

- [ ] 写失败测试，解析实际“小调对照”表，核对 A 自然小调、和声小调与古典旋律小调上下行的逐音拼写；例如 `assert.deepEqual(harmonicA, ["A", "B", "C", "D", "E", "F", "G♯", "A"])`。另用 E 小调验证迁移，不只检查 A 小调。
- [ ] 添加非 C 调表格预期：F 大调含 B♭，D 大调含 F♯／C♯；C 大调与 A 小调调号相同但主音不同；D Dorian 含 B，D Aeolian 含 B♭；A 小调五声音阶为 A C D E G，C 大调五声音阶为 C D E G A。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-scales.test.ts`，确认失败。
- [ ] 查证后编写六课；完整推导与解释先于汇总表。五度圈使用正文表即可；调式突出中心、持续低音和句尾证据，不把换起点等同于获得调式听感。
- [ ] 重跑 `node --import tsx --test tests/content/intermediate-scales.test.ts`，预期退出0；错误副本覆盖删除小调语境说明、互换调式特征音及破坏 E 小调升降号。
- [ ] 独立审校语境说明的实际含义、迁移题和答案，记录逐页结果并修正问题。
- [ ] 逐文件提交 `content: build the scale and tonality learning chain`。

## Task 5：和弦组成、转位与符号（2 篇深化＋3 篇新增）

**Files:** 表 A／B 的 Task 5 五篇、`tests/content/intermediate-chords.test.ts`、`reports/theory-expansion/chords.md`。

**Interfaces:** 消费音程约定；产出“组成音／低音／配置”分离的模型。常用七和弦仍是可先学的演奏入口，不依赖新理论课；新理论课通过相关链接回到按法。

- [ ] 写失败测试，从正文“七和弦核对”表逐行断言大七、属七、小七、半减七、减七相对半音为 `[0,4,7,11]`、`[0,4,7,10]`、`[0,3,7,10]`、`[0,3,6,10]`、`[0,3,6,9]`，并独立核对两个不同根音的字母拼写。
- [ ] 从正文核对 `C/E` 的最低音为 E、组成仍 C E G；对比 `Csus2 = C D G`、`Cadd9 = C E G D`、`C9 = C E G B♭ D`。使用带音区的示例核对最低音，不以数组书写顺序推断低音；为半减／减七及 sus／add 混淆添加错误副本用例。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-chords.test.ts`，确认失败。
- [ ] 查证后编写五课，核算每个吉他按法的实际音高、重复音和省略音；沿用现有 A7／D7／E7 图，不扩建图示生成器。逐页完成三个层次练习及解析。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-chords.test.ts tests/diagrams/chord.test.ts` 和 `npm run diagrams:check`，预期全部退出0。
- [ ] 独立审校转位、斜线与挂留语境以及五课题答，记录逐页结果并修正问题。
- [ ] 逐文件提交 `content: explain chord construction inversions and symbols`。

## Task 6：功能和声与调性变化（1 篇深化＋6 篇新增）

**Files:** 表 A／B 的 Task 6 七篇、`tests/content/intermediate-harmony.test.ts`、`reports/theory-expansion/harmony.md`。

**Interfaces:** 等待 Task 4／5；消费大小调、七和弦、转位和级数；产出带明确调性与乐句上下文的和声分析，供 Task 7 采用。

- [ ] 写失败测试，从实际“大调级数核对”表核对 G 调 `G Am Bm C D Em F♯dim` 与相应级数；小调表核对 A 小调 v 为 E G B，V／V7 的三音为 G♯；不能把升高导音误写为自然小调固有音。
- [ ] 在带上下文的例题答案中断言：C 大调 D7→G 的 D7 为 `V7/V`，组成 D F♯ A C；C 调的 Fm 借用例为 `iv`，组成 F A♭ C。终止例同时记录句末位置、最高声部及低音，不能仅用 V–I 两个符号判定完全正格。
- [ ] 添加一对原创上下文：一例短暂强调属和弦后回原调，一例后续乐句以新调终止并维持新中心；测试具体分析结论与原始音符／和弦表对应，并由审校者复核推理，不创建自动转调判断器。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-harmony.test.ts`，确认预期失败。
- [ ] 查证并编写七课。功能、终止、借用、转调各自展开适用条件、反例和跨调练习；不将流行和声写成违反古典规则即错误。
- [ ] 重跑同一局部命令，预期退出0；测试包含修改副属目标、导音或终止低音的错误副本。
- [ ] 独立审校七课的理论判断、推理和答案，记录逐页结果并修正问题。
- [ ] 逐文件提交 `content: add functional harmony and tonal transitions`。

## Task 7：吉他配置、旋律配和弦与实战（2 篇深化＋3 篇新增）

**Files:** 表 A／B 的 Task 7 五篇、`tests/content/intermediate-application.test.ts`、`reports/theory-expansion/application.md`。

**Interfaces:** 等待 Task 2／6；消费已审核的音高、节奏、和弦及和声分析，产出可以按步骤完成的原创综合案例。

- [ ] 写失败测试，规定实际案例必须有两个原创八小节短句：一个 G 大调 4/4、一个 E 小调 6/8；每音记录音名／音区、起拍、时值，每小节有和弦、低音、级数、分析理由。将正文每小节解析为 `{ pitch: string | null, onset: number, duration: number }[]`，休止用 null；G 调案例断言 `assert.equal(events.reduce((sum, event) => sum + event.duration, 0), 4)`，E 小调以八分单位核对总和6，同时检查相邻事件不重叠、不遗漏时段。不得用和弦列表代替旋律。
- [ ] 从实际移调答案读取对应音，断言 G 调案例移至 A 调时相邻音程和节奏保持、实响提高 2 半音且字母拼写正确。每个配置示例列出弦品／实际音区，用标准定弦独立核对，不能出现弦品和声音矛盾。
- [ ] 开放题测试包含两种参考配法的结构化数据，逐一核对音集合、低音和小节时值；审校记录须解释不同选择的音乐理由，不能靠出现“两种方案”文字通过。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-application.test.ts`，确认预期失败。
- [ ] 编写五课。设计具体旋律与和弦时避免仅为满足测试编造不连贯的音乐；保留旧入门例子，并明确专业四部写作与吉他弹唱的不同约束。
- [ ] 重跑同一局部命令，预期退出0。
- [ ] 由独立审校者从题目重做答案，用吉他音位推导核对可执行性；未实际弹奏／听辨的项明确记录，发现问题交原批次修正。
- [ ] 逐文件提交 `content: add guitar harmony analysis and arrangement practice`。

## Task 8：97 页课程集成、综合测验与旧契约迁移

**Files:** 表 B 的 Task 8 两篇；文件边界列出的旧导航／索引页；`data/content-manifest.yml`、`README.md`、`reports/source-audit.md`、`reports/theory-expansion/integration.md`；Create `tests/content/intermediate-integration.test.ts`。Modify `tests/content/inventory.test.ts`、`tests/content/manifest.test.ts`、`tests/content/task-2-entry-curriculum.test.ts`、`task-3-chord-curriculum.test.ts`、`task-4-rhythm-curriculum.test.ts`、`task-5-technique-curriculum.test.ts`、`task-6-accompaniment-curriculum.test.ts`、`task-7-theory-curriculum.test.ts`、`task-8-practice-curriculum.test.ts`、`task-9-care-curriculum.test.ts`、`task-10-reference-curriculum.test.ts`（均在 `tests/content/`）以及 `tests/site/build-output.test.ts`。未发生冲突的断言不改。

**Interfaces:** 消费所有核心课及批次证据；产出唯一正式 manifest、无循环且可达的学习图、完整题答链与最新引用目录。`parsePage` 后设置 `page.contentPath = entry.file` 再调用学习图验证器，不能用绝对路径替代该身份。

- [ ] 写集成失败测试，精确断言 `pages.length === 97`、release 为 `{ minPages: 97, maxPages: 97 }`、模块目标依既有顺序为 `[6,8,12,12,8,11,23,7,5,5]`、类型计数为 `{ lesson: 87, index: 6, path: 3, glossary: 1 }`。核对表 B 的 22 个身份，及基线 `a7cef15` 原有 75 个身份全部保留；不要只比较自生成的两份同源数组。
- [ ] 添加依赖测试：原音名入口不以“完整歌曲编配流程”为先修，节拍入口不以横按为先修；所有核心课以表 A／B 为准、其他旧页保持基线值。路线覆盖测试要求六阶段入口显式存在，删除其中之一的副本失败；另切断某个新课的全部入链以证明可达性检查拒绝，再制造先修环证明依赖检查拒绝。
- [ ] 添加答案测试：36 篇核心教学页（15 深化＋20 新课＋1 综合测验）的习题 ID 唯一且与答案 ID 完整对应；删除任一答案的副本失败。综合测验覆盖六领域，每领域都有辨认／推导／应用任务，开放题含判断标准、参考过程与回退链接。
- [ ] 运行 `node --import tsx --test tests/content/intermediate-integration.test.ts`，确认在未集成状态失败。
- [ ] 写新路线与综合测验，更新公共导航／索引／术语和来源表。来源总表从实际引用合并，逐项核查元数据和访问日期；不得先拍定新增来源数量。正文末尾的相关文章与路线次序同步。
- [ ] 写入完整 manifest；原75条保留其身份，新条按表 B 加入。按真实先修稳定拓扑排序，候选优先序为原清单顺序再接表 B 顺序；跳过尚有未放入先修的候选，不能跳过先修要求本身。发布目标固定97而非任意放宽范围。
- [ ] 针对性迁移旧测试：原先“仅 8 篇理论／仅 10 篇节奏／仅 8 篇伴奏”等目录断言改为新清单完整集合；旧前置、字面导航、表格个数、唯一来源集合、精确安全段落、禁止小调／七和弦标题、相关正文上限按新契约改为语义保护。保留旧图示字节保护、医疗／版权边界、错误副本、断链、重复身份与草稿拒绝；把每项删除的旧约束及替代证据列入 integration 报告。
- [ ] 更新输出检查为97篇；保留原5条搜索验收并新增“副属和弦”→`/theory/secondary-dominants`、“小调音阶”→`/theory/minor-scales`、“和弦转位”→`/theory/inversions-bass`，均 `maxRank: 5`。静态测试检查索引覆盖，实际排序留 Task 9 浏览器核对。
- [ ] 内容增长预算：CSS 56,320、JS 890,880、单 SVG 16,384 字节保持；内容索引上限改为 1,048,576、站点总量 12,582,912 字节。记录实际增量；如超预算先查重复和异常产物，不削减必要教学内容或继续自行放宽上限。
- [ ] 运行 `npm run audit:sources:write` 后 `npm run verify:release`；预期全链退出0、发布零结构错误。若全库格式检查被既有工具缓存阻断，只对明确的生成缓存做格式归一化且不提交工具配置，不修改产品检查规则绕过。
- [ ] 独立审校课程清单、习题覆盖和每项旧约束迁移；逐文件提交 `content: integrate the intermediate theory curriculum`。

## Task 9：整课内容审校与双端交付验收

**Files:** Create `reports/theory-expansion/acceptance.md`；必要修正仅限前述拥有者文件，附具体问题依据，不增加新范围。

**Interfaces:** 消费97页完整知识库、各批次报告与全链测试结果；产出可追溯的最终验收记录和用户入口。

- [ ] 逐页汇总36篇核心课的八项深度证据；由未作为该批唯一编写者的审校者重查例题和答案。六领域各选一个端到端任务，从先修到题目到答案独立完成，记录具体页面／题号／结论；有缺项则退回对应批次，不以总测试数代替。
- [ ] 使用真实 Quartz 页面核对两个原创谱例、一个长答案页、一个和声页和综合实战页；检查手机宽度下表格可读、必要符号未丢失，不做配色或装饰调整。验证原5条及新增3条搜索实际排名，错误时先修内容标题／索引和查询衔接，勿静默降低 maxRank。
- [ ] Obsidian 打开 `content/`，离线检查新路线、读谱页、小调页、实战页、综合测验，核对图片、双链和答案；恢复临时网络／开发者工具设置。应用不可访问时如实记录未验证条件，不推断通过。
- [ ] 所有修正结束后重新执行 `npm run verify:release`，保留最终退出状态和字节指标；`git diff --check` 无错误，确认没有无关文件、依赖、部署或旧正文身份变化。
- [ ] 验收报告明确“本轮已验证／未验证／历史基线”，逐文件提交 `docs: record intermediate theory content acceptance`；交付时给新路线链接、主要深化主题及使用方法，不重复整套过程日志。

## 计划自查与来源入口

设计 §1–4 对应 Task 2–7 的逐页主讲点与36页核心内容契约；§5 对应 Task 8 的身份／依赖／双端结构；§6 对应 Task 1／8；§7 对应每批次来源证据与 Task 8 审计；§8–10 对应 Task 9 和提交边界。所有新增页面、共享文件、测试与报告均有唯一负责人，任务接口未引入未定义的生产函数。

规划时已核对的教学入口（2026-10-02；不是替代逐课研究的整库来源审计）：[Open Music Theory：复拍子](https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/)、[Open Music Theory：小调](https://viva.pressbooks.pub/openmusictheory/chapter/minor-scales/)、[Puget Sound：七和弦](https://musictheory.pugetsound.edu/mt21c/SeventhChordsIntroduction.html)。本计划中的具体原创例题答案仍需执行者独立推导和交叉审校，不能把教材一般规则写成来源直接给出的本站答案。

本计划只在用户审核确认后开始执行。已选择的方式为子代理驱动、独立任务并行、直接 `main`，无需再次选择执行方式。
