# 音高、读谱与音程批次审校

2026-10-02。主执行者按用户要求自审六页；不是独立复核，也没有真人弹奏或听辨证据。

## 逐页证据

| 页面               | 目标与推导                             | 迁移／反例                                    | 吉他应用                       | 题答核算                                                    | 来源与遗留                                                                |
| ------------------ | -------------------------------------- | --------------------------------------------- | ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| 音高音名与唱名     | “先把音名与音区分开”；B跨到C才换八度号 | C、G大调中固定音C的唱名不同；限定大调首调口径 | 六根空弦的实响音区             | R1/D1/A1：G3 A3 B3 C4 D4，移调C4 D4 E4→G4 A4 B4             | Hutchinson Octave Registers；音区与唱名不混用，旧编配先修已移除           |
| 指板上的音名       | 0–12品逐半音、十二品八度               | 跨2/3弦为4半音；旧E0/F1表明确是弦品简写       | B3、C4跨弦同音；6弦12=4弦2=E3  | R1/D1/A1：D弦自然音品0/2/3/5/7/9/10；B3 C4 D4两套坐标相符   | 标准定弦＋半音规则；旧生成图保留，未实弹                                  |
| 全音与半音         | 升降还原与两半音构成全音               | 等音不等拼写；E♯、B♭♭不是禁止音名             | 单弦品距与跨弦先读音高         | R1/D1/A1：F→G、B→C、E→E♯；C上方3半音的字母D要求D♯           | Hutchinson Accidentals；限定十二平均律                                    |
| 音程入门           | 先数字母再查半音；16行完整对照         | 增二与小三、增四与减五、减七与大六            | 开放G3/B3大三；第一弦E4/G4小三 | R1/D1/D2/A1：D4小六=B♭4；F4大七=E5；B3减五=F4               | Augmented and Diminished Intervals；名称不再受旧基础范围限制              |
| 音程转位与复音程   | “转位”“复音程”：度数和9、还原减7       | 同时移高不是转位；上音移高是扩展              | G3/B4与G2/B3均大十；不强求伸指 | R1/D1/D2/A1：A3/C4→C4/A4；D3/F4小十；A1原配置已满足无需移动 | OMT Intervals及Hutchinson Inversion；后续链接待集成                       |
| 五线谱简谱与六线谱 | 三谱各自最小读法；逐列事件换算         | 谱面E5实响E4；TAB0与简谱0；同音异位不改实响   | G3 C4 D4 E4=3/0、2/1、2/3、1/0 | R1/D1/D2/A1：3弦5仍C4；G调转写；无点5与G3矛盾的两种修正     | Yamaha、MusicXML、LilyPond、学校简谱资料、制谱软件官方教程；SVG已渲染核对 |

## 来源核查与修正

上述正文的新脚注均为本轮实际打开过的原始教材／官方资料。读谱页原拟OMT地址错误且正确页面不覆盖临时记号作用范围，改用LilyPond §1.1.3 的 default / voice 说明；MuseScore页面访问失败，没有标成成功来源。简谱的数字与音区点由苏州市实验小学校资料支持，时值及休止另引作曲大师官方教程，仅采用对应论断。原创例子、弦品、图与答案是本站推导，并非来源原谱。

## 验证

- RED：局部7项全部失败，缺页／缺表／缺练习契约；GREEN：7/7。
- 两个错误副本分别改变D♯拼写、B3音区，均被真实正文表检查拒绝。
- SVG以sharp渲染并查看：四个四分符头与谱面G4 C5 D5 E5位置一致，下点5正确，TAB弦序与数字相符，中文无重叠裁切；原图有title/desc与完整替代事件表，低于16KiB。
- `npx tsc --noEmit`、`git diff --check` 通过。
- 整库283项：261通过、22失败。不是发布通过；日志为本任务工作区 `task-3-suite.log`。

### 整库失败契约

节奏报告的15项集成失败仍在；新增7项均来自 `task-7-theory-curriculum.test.ts`：

1. all eight exact theory lesson files exist with no extra formal page
2. frontmatter, headings, manifest order, and backward prerequisites match the exact DAG
3. claim-level source references, exact definitions, and unified safety blocks match the contract
4. theory tables lock pitch, fretboard, interval, scale, key, triad, and diatonic facts
5. full-path target-alias pairs, route handoff, and plain future handoffs match the boundary
6. original exercises, three-stage ladders, observable checks, and scope boundaries hold
7. temporary mutation copies reject every high-risk theory boundary break

原因是旧八页理论清单、精确来源／文字／练习快照与禁止进阶内容的范围契约待Task8迁移。未跳过检查或削弱发布门槛；manifest、引用目录、新课入链、实际双端验收均尚待后续任务。
