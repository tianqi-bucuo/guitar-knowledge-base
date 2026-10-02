# 节奏批次内容审校

日期：2026-10-02。范围：4 篇深化、2 篇新增、1 个原创 SVG。按用户要求由主执行者自审，无独立审校者；没有声称完成真人演奏或听觉验收。

## 逐页核对

| 页面                 | 目标／推导定位                                                        | 迁移与对比                                                   | 可执行应用                                                         | 题答对应                                                                        | 来源论断与遗留                                                     |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 节拍拍号与小节       | “先约定分类口径”“从总音值推导主拍”：主拍细分与拍数组合分开；9÷3、12÷3 | 3/4 与 6/8；固定八分速度与固定主拍速度不同；明确中文分类口径 | 六格拍手位置 1/3/5 对照 1/4                                        | R1/R2/D1/D2/A1 均有推导或观察标准；60 BPM 例分别 3 秒、2 秒                     | OMT Meter 与 Compound Meter 支持分类；零先修落实；未做实际听辨     |
| 四分八分与十六分音符 | “从整体到时值比例”“速度单位必须一起读”：1、0.5、0.25 与秒数换算       | 80/120 BPM、4/4 与 6/8；音符名称不等于固定秒数               | 单弦／拍手逐拍 1、2、4、1 次起音，主拍不漂移                       | R1/D1/D2/A1 完整；100 BPM 0.6/0.15/1.8 秒；剩四个十六分                         | OMT Rhythmic values 支持符号比例；旧来源保留历史日期               |
| 六八拍伴奏           | “同样六格”“把脉冲落实为可核对的弦音”：主拍与格数分离                  | 普通三分非三连音；Em→Am 换低音弦；固定层级才能比较秒数       | Em 6/3/2 弦 E2/G3/B3；Am 5/3/2 弦 A2/A3/C4，与标准定弦逐弦核算一致 | R1/D1/D2/A1 完整；72 BPM 主拍5/6秒、八分5/18秒、小节5/3秒                       | OMT Compound Meter 支持复二拍；旧生成图未改；实际弹奏待使用者验证  |
| 切分节奏入门         | “弱位发声不自动等于切分”：同一背景下对照重奏、延音、休止              | 不把一切拍间音都判为切分；延音线与连音线不混用               | 保留旧响／空网格；新增 1、2&、4 起音版本，并比较第3拍持续／止音    | R1/D1/A1 完整；四音符符号、三起音、四拍核对一致                                 | Hutchinson §4.6 支持弱位强调及跨强拍延音；保留旧来源作延伸         |
| 休止附点与延音线     | “附点是相加”“延音线、连音线与连音比例”：单／双附点及跨小节延音        | 同时值不同起音数；休止不是放任余音                           | 原创4/4事件表和SVG同一时间轴；第3拍止音                            | R1/R2/D1/D2/A1 完整；附点二分3、附点八分0.75、双附点四分1.75；跨小节2拍仅一起音 | OMT Rhythmic values、Hutchinson §4.3 支持定义；无外部媒体依赖      |
| 连音与节奏分组       | “先确定正常值，再应用比例”：3:2与2:3，统一四分单位                    | 三连音与6/8普通三分；四分三连不机械当一拍                    | 两分／三分交替；带一拍休止的4/4，起点0/0.5/1/4⁄3/5⁄3/3             | R1/D1/D2/A1 完整；休止替音不缩总长；1秒主拍二连每音0.5秒                        | OMT Beams and borrowed divisions 支持定义；综合实战链接待Task7落地 |

## 来源核查

本轮实际打开并核对 OMT 的 [Meter](https://open-musictheory.github.io/docs/fundamentals/meter/)、[Rhythmic values](https://open-musictheory.github.io/docs/fundamentals/rhythmic-values/)、[Beams and borrowed divisions](https://open-musictheory.github.io/docs/fundamentals/beams/)、[Compound Meter](https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/)，以及 Robert Hutchinson 的 [Dots and Ties](https://musictheory.pugetsound.edu/mt21c/DotsAndTies.html)、[Common Rhythmic Notation Errors](https://musictheory.pugetsound.edu/mt21c/CommonRhythmicNotationErrors.html)。新事件、例题、计算及SVG均为本站原创，没有转用教材谱例。

Pressbooks 的 Notating Rhythm、Simple Meter、Other Rhythmic Essentials 本次请求遇到403；不把它们登记为本轮成功访问。旧脚注的2026-10-01日期保留；新论断使用本轮可访问的教材页。可访问性不代替论断审查，来源总表统一在Task8集成。

## 验证证据

- 初次测试：5 项均在缺页／缺表／缺练习契约处失败；实施后局部 5/5 通过。
- 错误副本核对：主拍2改6会拒绝；时值1.5改1.25会拒绝。中途发现替换命中正文前面的算式而未命中事件表，现限定目标章节并验证表格确实发生变化。
- `npm run diagrams:check`：17张既有生成图全部当前；新谱例位于独立 examples 目录。
- 实际SVG 3,157字节，包含title/desc；真实附件走链接安全校验；sharp渲染后人工查看了节奏符号、时间轴、数值和中文标签，无裁切或遮挡。图与事件表相符。
- `npx tsc --noEmit` 与 `git diff --check` 通过。
- `npm test`：276项，261通过、15失败；这不是发布通过。失败为下面既有的清单／来源／旧文字契约，按批准计划在Task8集中迁移。

### 整库诊断失败清单

1. `links.test.ts` — all seventy-five published pages have no link diagnostics
2. `task-10-reference-curriculum.test.ts` — source catalog equals actual cited URLs, deduplicates identity and uses latest real citation dates
3. 同上 — all 75 pages are reachable and validators accept publication without errors or warnings
4. `task-2-entry-curriculum.test.ts` — the existing validators accept Task 2 pages with current link-resolution context
5. `task-3-chord-curriculum.test.ts` — the existing validators accept the expanded content set
6. `task-4-rhythm-curriculum.test.ts` — all ten exact rhythm lesson files exist with no extra formal page
7. 同上 — frontmatter, headings, manifest order, and backward prerequisites match the contract
8. 同上 — page-local sources, access dates, and exact safety blocks match the contract
9. 同上 — meter, accent, syncopation, originality, and practice boundaries stay explicit
10. 同上 — full-path navigation links and the two earlier-page handoffs match the published boundary
11. 同上 — the existing validators accept all seventy-five published pages
12. `task-5-technique-curriculum.test.ts` — the existing validators accept all seventy-five published pages without diagnostics
13. `task-6-accompaniment-curriculum.test.ts` — the existing validators accept all seventy-five published pages without diagnostics
14. `task-7-theory-curriculum.test.ts` — the existing validators accept all seventy-five published pages without diagnostics
15. `task-8-practice-curriculum.test.ts` — author and release modes accept all 75 published pages without diagnostics

遗留：新增页尚未进manifest、来源总表未接入、旧精确快照需迁移、综合实战尚未创建、双端阅读验收待Task9。未发现本批算术或题答矛盾；自审不是独立复核。
