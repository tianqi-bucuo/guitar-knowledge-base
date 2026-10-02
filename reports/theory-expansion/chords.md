# 和弦批次内容审校

2026-10-02，五页由主执行者自审；用户要求不使用子代理，未声称独立复核或真人弹奏。

| 页面                 | 目标／推导                              | 迁移／对比                            | 吉他应用                                          | 题答核算                                                      | 来源与遗留                                                                               |
| -------------------- | --------------------------------------- | ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 三和弦构成           | 四类根到三五距离与相邻三度分开          | D、B♭、F♯根音；增五需C𝄪，减五可F♭     | C/Am开放音逐弦；增加E2不改C根音                   | R1/D1/D2/A1完整；F♯增三F♯ A♯ C𝄪；C3/G3缺三不能判大小          | Hutchinson三和弦历史脚注＋本轮Inverted Triads；无新增图                                  |
| 常用七和弦           | 大三加小七；结构与功能不同              | E/E7、A/A7、D/D7只改重复根音的位置    | E2 B2 D3 G♯3 B3 E4；A2 E3 G3 C♯4 E4；D3 A3 C4 F♯4 | R1/D1/A1完整；D7二弦不响只剩D大三集合                         | 保留Fender/BAPAM旧日期；新七和弦理论来源，按法课先修不变                                 |
| 七和弦构成           | 根三五七字母先行，再改性质              | C/D两根完整五类；F♯练习；小大七不矛盾 | Cmaj7全组成，C7省G，Dm7换第一弦变D7               | R1/D1/A1完整；Ddim7七音C♭，F♯dim7七音E♭                       | Hutchinson Seventh Chords与Jazz Chord Basics；未展开高阶扩展                             |
| 和弦转位与低音       | 组成、音区、最低音依次判断              | 未排序表、非和弦低音、整体与吉他局部  | C/E与C/G；G/B=x20003；合奏G1改变整体低音          | R1/D1/A1完整；D7四套配置低音分别D/F♯/A/C                      | OMT Inversion、Hutchinson Inverted Triads与Figured Bass；不继承来源图注的A♭小三和弦C误写 |
| 挂留和弦与附加音和弦 | sus替代、add添加、9含七；静态与动态分开 | C/D/G迁移；C9与maj9七音差半音         | Csus2、Csus4、Cadd9、C9四tuple逐音相符；C9明确省G | R1/D1/D2/A1完整；Csus2误放开一弦得到Cadd9；缺准备不称完整挂留 | Hutchinson Simple Sus、Jazz Chord Basics、Suspension；动态挂留需后续课深化               |

## 来源与实际检查

本轮实际打开并核对正文新脚注：Puget Sound的 [Seventh Chords](https://musictheory.pugetsound.edu/mt21c/SeventhChordsIntroduction.html)、[Inverted Triads](https://musictheory.pugetsound.edu/mt21c/InvertedTriads.html)、[Simple Sus Chords](https://musictheory.pugetsound.edu/mt21c/SimpleSusChords.html)、[Jazz Chord Basics](https://musictheory.pugetsound.edu/mt21c/JazzChordBasics.html)、[Suspension](https://musictheory.pugetsound.edu/mt21c/Suspension.html)、[Figured Bass](https://musictheory.pugetsound.edu/mt21c/FiguredBassInversionSymbols.html)，以及OMT的 [Inversion](https://viva.pressbooks.pub/openmusictheory/chapter/inversion/)。只引用相应结构定义，不把来源中的简化假设推广为所有和弦规则。本站例题与实际配置独立推导。

- RED局部6/6失败；GREEN局部6/6，联合既有和弦图测试13/13。
- 独立按标准定弦MIDI `[40,45,50,55,59,64]` 核对正文七个tuple与实响；转位表对所有实响取最小值，不按数组首位猜低音。
- 错误副本将减七B♭♭改B♭、sus加入三音、C/E中的C4改C2，均拒绝。
- `npm run diagrams:check`：17张旧图当前；`npx tsc --noEmit`、`git diff --check`通过。
- 全库295项，272通过、23失败；沿用pitch报告22项，新增 `task-3-chord-curriculum.test.ts` 的 `page-local sources and exact safety blocks match the contract`（七和弦课新增来源与旧精确集合冲突）。日志 `task-5-suite.log`。未跳过测试，非发布通过。

遗留：清单、来源目录、路线与未落地后续链接待集成；实际Quartz／Obsidian与听辨未在本批验证。没有改变按法图、依赖、安全边界或既有页面身份。
