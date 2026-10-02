# Release presentation and static-output QA

Date: 2026-10-02. Tested build: Quartz 4.5.2, `npm run build:site`, 75 Markdown inputs and 228 emitted files in `public/`. Git base: `ef87e4bc505b0c2eb80cf6d0d33e0a1b73d6e69b` plus the approved, uncommitted Task 3 presentation/test changes. This report describes that working-tree build; a later release rebuild is a separate gate.

The controller inspected the actual built site in Codex's in-app browser through the existing loopback-only `http://127.0.0.1:8080` serve-handler preview. The supported interface does not expose the browser engine/version. Viewports were 1440×900 and 390×844, each in light and dark themes. The implementer ran the static/automated checks and did not operate the browser. All named product findings passed their bounded rechecks. The isolated SVG/browser console limitation below remains disclosed.

## Page, viewport, and theme matrix

Each PASS covers the observed criteria: no horizontal page overflow, readable navigation, visible search, applicable SVG labels, non-overlapping applicable TOC, usable backlinks, readable theme contrast, and meaningful article-image alternatives. The applicability table below supplies page-specific exceptions and measurements. Mobile TOC is intentionally hidden; pages without images have N/A SVG/alt criteria. PASS denotes this bounded inspection, not an accessibility certification.

| Page                   | 1440×900 light | 1440×900 dark | 390×844 light | 390×844 dark |
| ---------------------- | -------------- | ------------- | ------------- | ------------ |
| 民谣吉他知识库         | PASS           | PASS          | PASS          | PASS         |
| 学习路线总览           | PASS           | PASS          | PASS          | PASS         |
| 正确按弦               | PASS           | PASS          | PASS          | PASS         |
| C和弦                  | PASS           | PASS          | PASS          | PASS         |
| 基础八分音符扫弦       | PASS           | PASS          | PASS          | PASS         |
| 指板上的音名           | PASS           | PASS          | PASS          | PASS         |
| 疼痛疲劳与停止练习边界 | PASS           | PASS          | PASS          | PASS         |
| 吉他术语表             | PASS           | PASS          | PASS          | PASS         |

All 32 states were visited and DOM-measured. Desktop document width was 1440px; mobile width was 390px. Navigation and search remained readable and visible in each state. Every sampled page rendered one visible article H1. Desktop TOC stayed separate from the article; mobile TOC stayed hidden. Backlinks remained in their intended column/flow, and image alternatives were meaningful in each applicable state.

| Page                   | Images loaded / meaningful alt, all four states | SVG-label evidence                                                                                   | Backlinks |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------: |
| 民谣吉他知识库         | N/A                                             | N/A                                                                                                  |         6 |
| 学习路线总览           | 3/3 PASS                                        | Chord plus wide rhythm/fretboard previews; redundant text and original-image links                   |        19 |
| 正确按弦               | N/A                                             | N/A                                                                                                  |        15 |
| C和弦                  | 1/1 PASS                                        | Chord image 240px wide; labels legible                                                               |        10 |
| 基础八分音符扫弦       | 1/1 PASS                                        | Wide preview 671.98px desktop / 357.98px mobile, supplemented by text/original link                  |         8 |
| 指板上的音名           | 1/1 PASS                                        | Wide preview 671.98px desktop / 357.98px mobile; equivalent note table and original-image navigation |         5 |
| 疼痛疲劳与停止练习边界 | N/A                                             | N/A                                                                                                  |         7 |
| 吉他术语表             | N/A                                             | N/A                                                                                                  |         7 |

Small mobile labels in wide diagrams use their existing equivalent text and original-image route. The original fretboard was actually opened and exposed its intrinsic 720px image and full 24-position accessible description. This does not claim physical pinch-zoom testing.

## Reproduced findings, fixes, and rechecks

| Finding                         | Before                                                                                                          | Narrow fix                                                                                     | Observed recheck                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 inactive TOC contrast        | Opacity .35; light 2.04:1 / dark 2.90:1                                                                         | Scoped CSS uses full-opacity darkgray; current sections use tertiary color and underline       | PASS: inactive light 7.86:1 / dark 12.19:1; active light 6.55:1 / dark 8.64:1                                                                                                            |
| P2 repeated article title       | ArticleTitle plus source Markdown H1 repeated the same title                                                    | Conditional ArticleTitle on content pages with a top-level H1                                  | PASS: one H1 on all eight pages; source H1s untouched; generated folder/tag titles preserved                                                                                             |
| P1 mobile Explorer semantics    | Unnamed button and missing expanded state; listener only changed parent state                                   | Localized `探索` name, controls relationship, initial state, synchronized toggle/content state | PASS: pointer false→true→false, desktop true→false→true; visible state agreed                                                                                                            |
| P2 mobile header crowding       | Lone final title character, vertical search label, small controls                                               | Local two-row header grid and 44px control targets                                             | PASS: one-line title and horizontal search label; Search 238×44, theme/reading/menu 44×44 on glossary                                                                                    |
| P2 open-menu overflow           | Desktop-open resize to mobile produced document width 406px at 390px viewport                                   | Fixed viewport-sized, box-sized Explorer overlay                                               | PASS: open light/dark mobile width 390px; desktop-open resize and close worked                                                                                                           |
| P2 mobile search excerpt length | At 390×844, query 变调夹 gave cards 1452.09 / 965.66 / 1324.09px; first paragraph 1382.48px and 1054 characters | Root-approved follow-on: mobile-only three-line excerpt clamp in existing custom.scss          | PASS: first three cards each 146.41px, descriptions 76.80px with ellipsis; complete 1054/757/935-character text remained in DOM; Enter opened the full course; desktop preview unchanged |

Contrast calculations use relative luminance of observed colors: inactive light `(78,78,78)` on `(250,248,248)`; inactive dark `(212,212,212)` on `(22,22,24)`; active light `(57,97,89)` and dark `(136,190,176)` on the corresponding backgrounds. Body uses the same inactive foreground/background pairs. Existing fade effects at scroll-container edges are not an every-pixel contrast certification. Header target sizes do not describe every link/control on the site.

The initial five findings were repaired in one bounded batch. The mobile-search issue was newly reproduced during the actual interaction recheck, separately authorized, and repaired in one focused follow-on. Only mobile search and desktop preview were rechecked after that CSS-only follow-on; the unaffected 32-state matrix was not repeated. No search encoder, content, diagram, color system, or navigation feature was replaced.

## Actual Chinese search and interaction checks

These are actual rendered search results, mapped from Chinese file slugs to canonical manifest permalinks. Static index membership complements this runtime evidence and does not simulate ranking.

| Query    | Canonical target          | Actual rank | Limit | Result |
| -------- | ------------------------- | ----------: | ----: | ------ |
| 横按     | /chords/barre-and-movable |           3 |     5 | PASS   |
| 六八拍   | /rhythm/six-eight         |           1 |     5 | PASS   |
| 手腕     | /basics/fretting-hand     |           1 |     5 | PASS   |
| 变调夹   | /accompaniment/capo       |           1 |     5 | PASS   |
| 顺阶和弦 | /theory/diatonic-chords   |           1 |     5 | PASS   |

- Keyboard Enter on Search opened the modal with its textbox focused. Enter on the focused 变调夹 textbox opened the first course and closed the overlay. Mobile search returned the same first result; Escape closed it and returned focus to Search. Full tab-order/arrow-navigation coverage is not claimed.
- Tag `#变调夹` opened the generated `标签: 变调夹` title and its one-note course link returned to the article. A folder breadcrumb opened the retained `文件夹: 05-弹唱与伴奏` title. Clicking `和弦级数与移调` within Backlinks changed the actual URL and H1 to that course.
- Populated local/global graphs were observed. Global Graph opened a 1152×720 canvas; Escape on its focused opener hid the overlay. Canvas-node navigation was not tested.
- Desktop Explorer expanded true→false→true agreed with visibility. Resizing while open to 390px retained the mobile expanded state without overflow; pointer activation closed it. Both mobile themes had a visible 44px toggle and no open-menu overflow.
- Enter on the exact original-image link reached `/assets/diagrams/fretboard-c-major-scale.svg`, confirmed by URL, screenshot and its accessible description. Browser Back returned to the actual 指板上的音名 URL/H1.
- After the excerpt fix, mobile 变调夹 search displayed several compact choices and Enter still opened complete course content. At 1440×900, the two-column search and full right-hand preview remained visible and correct; Escape closed the modal without horizontal regression.

## Static-output acceptance and byte budgets

The separate `tests/site/build-output.test.ts` requires an existing production build and remains outside generic pre-build `npm test`. It checks all 75 required canonical outputs, each real target article and its membership/content in the exact `public/static/contentIndex.json`, all five production search assertions, article-title/Explorer markup, meaningful local image alternatives/SVG titles, the compiled mobile clamp, and byte ceilings. Missing-coverage fixtures use temporary output and never delete valid `public/` to manufacture RED. The original `scripts/check-site-output.ts` was preserved and run against production output.

| Metric                  | Approved pre-polish baseline bytes | Final bytes | Approved ceiling bytes | Result |
| ----------------------- | ---------------------------------: | ----------: | ---------------------: | ------ |
| All CSS                 |                              44681 |       46515 |                  56320 | PASS   |
| All JS                  |                             712064 |      712157 |                 890880 | PASS   |
| Largest SVG             |                              12604 |       12604 |                  16384 | PASS   |
| Exact contentIndex.json |                             404448 |      406925 |                 505856 | PASS   |
| Entire public tree      |                            6134470 |     6146646 |                7668736 | PASS   |

The approved baseline was the earlier 75-page precheck on content commit `bf7c920`. Immediately before Task 3, the accepted `ef87e4b` output already measured contentIndex 406925 and total 6139853 bytes; this explains the content-index delta without attributing it to UI edits. CSS totals include both shipped giscus theme files. The scoped excerpt follow-on adds 140 CSS/total bytes to the first Task 3 build. File sizes are not browser loading-time or CPU benchmarks; ceilings were not raised.

Verification chronology:

- Initial RED: 15/20 combined manifest/site checks; optional assertions were ignored, the incomplete-output fixture was accepted, production search assertions were absent, and duplicate article H1s were detected. Two subsequent fixture expectation mistakes were corrected before accepting their GREEN results.
- First fresh build: 75 inputs / 228 outputs; site checks 6/6, original output checker, TypeScript, changed-file Prettier, and diff checks passed. Release validation returned 0 errors and 0 warnings.
- Full-suite integration RED: `npm test` passed 262/264. The failing tests were `source CLI writes deterministic bytes, checks without mutation, rejects arguments and confines loading` and `online CLI keeps health warnings non-blocking and cannot follow an output symlink`. Both cloned the production manifest and replaced its page inventory while retaining now-invalid production search targets. A controller-approved two-line fixture correction deletes that optional field after each replacement; existing assertions were preserved. Covering source/manifest tests then passed 29/29 and fresh `npm test` passed 264/264. The existing Node punycode deprecation warning remains non-blocking.
- Focused mobile-search RED: site checks 6/7 on the unbounded build. After the approved CSS follow-on and rebuild, site checks passed 7/7; original checker, TypeScript, formatting, and diff checks passed again. The generic 264-test suite preceded this CSS-only follow-on; final release-chain verification is Task 4-owned.
- The sandbox blocked the `tsx` CLI's local IPC socket on the initial direct invocation. `node --import tsx --test` ran equivalent installed tests without that IPC server; authorized `npm test` and release checks subsequently ran with local execution permission. No dependency installation occurred.
- Controller corroboration after final QA independently observed site tests 7/7 with the same final byte metrics and the original output checker exit 0. Its nonwriting source-audit check also exited 0: 75 pages, 81 sources, 0 structural errors. Source-audit report bytes were unchanged.

## Evidence limits and bounded assessment

Controller screenshots cover all eight desktop-light and all eight mobile-dark pages, plus home/glossary in the other combinations, mobile diagram/text regions, menus, search, graph, and the raw SVG. They are native browser tool outputs in the parent release chat, not saved local image files; this report invents no screenshot links. All 32 layout states were DOM-measured, but a separate screenshot for every cell is not claimed. The controller's detailed scratch evidence is `.superpowers/sdd/2026-08-22-guitar-kb-release-plan/visual-final-recheck.md`; this report carries the essential results itself.

Final browser logs include `Uncaught (in promise) TypeError: Cannot use 'in' operator to search for 'animation' in undefined`, seen in the earlier precheck and raw-SVG navigation. The controller reproduced it in a fresh temporary in-app-browser tab opening only the local SVG: `contentType=image/svg+xml`, root `svg`, zero script elements. Shipped Quartz scripts have no corresponding singular animation check. Reproduction without Quartz page scripts establishes an SVG/browser inspection limitation, not its internal cause or a Quartz attribution. The image and Back navigation worked; no additional error appeared during the post-fix search checks. A zero-console-error claim is not made. The probe tab was closed and the temporary viewport override reset.

An earlier pointer-centre attempt on a wrapped original-image anchor was inconclusive: its bounding-box centre hit the surrounding paragraph, while keyboard activation on the exact anchor worked. This does not establish a product defect or physical pointer/touch correctness. Physical touch/pinch, complete keyboard traversal, screen readers, other browser engines, OS-level offline behavior, live reload, custom directory redirects, and whole-WCAG compliance were not tested.

The bounded polish assessment finds the named contrast, title, control-state, responsive header/menu, and excerpt issues repaired. The incumbent theme, authored content, local diagrams and navigation identity remain coherent. Static-output gates pass; runtime performance beyond file-byte budgets remains unmeasured. The impeccable context/detector launcher was unavailable earlier in this session, so no detector-clean claim is made. Manual controller evidence and incumbent Quartz/spec authority guided the narrow refinements.
