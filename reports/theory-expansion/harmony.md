# 功能和声批次审校

2026-10-02；七页由主执行者自审，不声称独立审校或真人演奏／听觉验证。

| 页面           | 目标／推导定位                         | 迁移与对比                                                  | 吉他应用                                       | 题答核算                                                         | 来源及遗留                                                                              |
| -------------- | -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 顺阶和弦与级数 | 从调内隔音取三项再判质量；新增G完整表  | C/G/D/F；级数移调与声部音区重配分开                         | G/Em/C/D实际低音G2 E2 C3 D3                    | R1/D1/A1全；D调iii=F♯ A C♯，vii°=C♯ E G                          | 旧Puget来源保持日期；移除不必要移调先修                                                 |
| 和声功能       | T/PD/D与主音延长，级数非永久功能       | C/G/F；vi放不同句法位置；拨弦与和声节奏分开                 | G7高两弦B3/F4→C4/E4，标准tuple核算             | R1/D1/A1全；F调Gm–C7–F，E→F/B♭→A；4/2/2/8=16                     | Harmonic Function/Rhythm；不把古典流程强制给流行循环                                    |
| 终止式与乐句   | 句末→低音→顶音→时值；完全正格三条件    | 甲乙丙仅改变低音或顶音；V–vi顶音也可主音                    | 外声部G2/B3→C3/C4；明确补伴奏不能高于顶音      | R1/D1/A1全；F调C–F、Gm–C、C–Dm三种，外声部相符                   | Cadences/PAC；统一声明翻译口径，不从两和弦自动推断句末                                  |
| 小调和声       | 自然i/ii°/III/iv/v/VI/VII与变化导音    | A/E/D；自然v和V/V7、G与G♯dim                                | B7=x21202，B2 D♯3 A3 B3 F♯4                    | R1/D1/A1全；D调导音减七C♯ E G B♭；D自然与B7三音冲突明确          | Diatonic Chords in Minor；内部级数与大调参照分别声明                                    |
| 副属和弦       | 目标→属根→大三/属七→后续检验           | C:D7→G与G:D7→G；D调V7/ii、V7/V                              | D7→G高弦F♯4→G4；原创C调四小节后回原调          | R1/D1/A1全；D调B7→Em、E7→A；G迁移A7后Am回C自然                   | Tonicization；变化音孤立不足以判断，罗马斜线非低音                                      |
| 调式借用       | 同主音小调材料，根音变化与三音变化分开 | Fm=iv非♭IV；G调Cm/E♭/F；与副属对照                          | F/Fm高三弦A3 C4 F4→A♭3 C4 F4，注明局部转位     | R1/D1/A1全；E→E♭→D可2弦5/4/3，固定E旋律不能盲换Cm                | Mode MixtureSection；♭VII有其他模式解释，不声称唯一来源                                 |
| 转调入门       | 原中心→候选→终止→维持→回找枢纽         | 甲C D7 G G7 C，乙C Am D7 G；Am D7 G，真实外声部支持不同结论 | 甲1弦0/2/3/1/0，乙0/0/2/3；0/2/3；低音单独核算 | R1/D1/A1全；乙移高全音D Bm E7 A；Bm E7 A，G♯导音；开放题评分条件 | TonicizationVsModulation、Pivot、WithoutPivot；原猜DirectModulation地址失败已换实际页面 |

## 来源与自审过程

本轮实际阅读Hutchinson教材 [Harmonic Function](https://musictheory.pugetsound.edu/mt21c/HarmonicFunction.html)、[Harmonic Rhythm](https://musictheory.pugetsound.edu/mt21c/HarmonicRhythm.html)、[Cadences](https://musictheory.pugetsound.edu/mt21c/cadences.html)、[Perfect Authentic Cadence](https://musictheory.pugetsound.edu/mt21c/PerfectAuthenticCadence.html)、[Diatonic Chords in Minor](https://musictheory.pugetsound.edu/mt21c/DiatonicChordsInMinor.html)、[Tonicization](https://musictheory.pugetsound.edu/mt21c/Tonicization.html)、[Mode Mixture](https://musictheory.pugetsound.edu/mt21c/ModeMixtureSection.html)、[Tonicization versus Modulation](https://musictheory.pugetsound.edu/mt21c/TonicizationVersusModulation.html)、[Pivot Chords](https://musictheory.pugetsound.edu/mt21c/ModulationsWithDiatonicPivotChords.html)、[Without Pivot Chords](https://musictheory.pugetsound.edu/mt21c/ModulationsWithoutPivotChords.html)。引用是定义与分析方法，不复制教材歌曲；本页例句均原创。

复算两套调性变化：甲每和弦4拍，F♯在D7后回F自然/G7，句末E4在C和弦且低音C3；乙Am在两调均顺阶，D7的F♯4到G4与D3到G2满足原位属主及顶音主音，后续Am–D7–G持续支持G。判断来自完整例子，不存在自动转调分类器。补和弦音时不得越过声明的最高声部；这项限制正文已明确。

## 验证与遗留

- RED局部7/7失败；GREEN7/7；真实正文表包含目标、实际组成、低音、顶音与句末。
- 错误副本将V7/V改V7/vi、E7导音G♯改G、完全正格低音G2改B2均拒绝。
- `npx tsc --noEmit`、`git diff --check`通过。
- 全库302项：278通过、24失败。前23项见chords及pitch报告，新增 `task-8-practice-curriculum.test.ts` 的 `route and the two earlier lessons hand off to published practice pages`：理论旧尾课现在接新功能课，不再用原精确“下一步进入有效练习流程”句子。该练习链接仍保留，Task8将语义迁移旧导航契约；不绕过发布检查。日志 `task-6-suite.log`。
- 来源目录、清单、公共导航和后续三篇应用课仍待集成；实际双端阅读验收待Task9。无依赖、布局或旧页面身份变动。
