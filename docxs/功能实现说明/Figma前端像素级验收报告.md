# FoodMate Figma 前端像素级验收报告

更新时间：2026-09-05

## 1. 结论

本报告记录两类不同验收结果：

1. Figma 文件内部结构、组件系统、Prototype 和画板截图回读已完成。
2. 前端代码与 Figma 画板的自动化像素差异已覆盖 105 个已建立映射的页面/状态，105 个结果均为 `DIFF_REVIEW`，不能标记为像素级通过。

因此当前不能宣称“Figma 105 张画板已全部像素级通过”。已经完成的是可复核的 Figma 全量结构验收、105 个画板的路由/状态映射、差异证据收集，以及运行时几何、可见文字、DPR 和 105/105 人工视觉复核登记；由于仍存在可见差异，结果继续保留为 `DIFF_REVIEW`。

## 2. Figma 文件内部验收

来源文件：[Fintech dashboard Community](https://www.figma.com/design/MX18RZCfAmgprNzxItkHUH/Fintech-dashboard--Community-?node-id=0-1)

| 项目 | 结果 |
|---|---:|
| 文件 key | `MX18RZCfAmgprNzxItkHUH` |
| `🎨 :: Design` 顶层画板 | 105 |
| Design 页递归节点 | 19,985 |
| Prototype reaction | 1,940 |
| 无效 Prototype 目标 | 0 |
| Figma 画板截图请求 | 105/105 成功 |
| User Component Set | 24 |
| Admin Component Set | 14 |
| Foundations Variables 集合 | 5 |
| 已回读本地样式 | 8 |

实际设计系统页面为 `01 Foundations`、`02 Components - User`、`03 Components - Admin`。`🎨 :: Design` 页面自身没有 Component Set，这不影响全文件 User/Admin 组件集已经建立。

## 3. 像素差异方法

脚本：[png-diff.mjs](../../foodmate-ui/scripts/png-diff.mjs)

脚本比较 RGB/RGBA PNG 的同尺寸像素，输出：不同像素数、差异比例、平均绝对误差、RMSE 和最大通道差异。浏览器截图在固定视口采集，Figma PNG 与浏览器 PNG 尺寸不一致时先记录尺寸问题，不强行比较。

当前验收口径：

- `PASS`：尺寸一致，且差异结果与人工截图检查均满足当前页面的验收阈值。
- `DIFF_REVIEW`：尺寸一致但存在需要人工复核或继续修正的像素差异。
- `SIZE_MISMATCH`：尺寸不同，不能作为像素结论。
- `UNMAPPED`：Figma 画板尚未映射到独立前端路由和状态。

## 4. 已映射页面结果

以下为代表性页面结果；105 项完整字段、路由、query 状态、视口、PNG 路径和 diff 锚点以 [`figma-105-mapping.json`](../../foodmate-ui/.qa/figma-pixel-acceptance/figma-105-mapping.json) 为准。结果来自 2026-08-18 运行的 `generate-figma-105-diff.mjs`，认证页使用 `1440×900`，其它画板按各自 Figma 目标尺寸记录。

| 页面/状态 | Figma 节点 | 尺寸 | 差异比例 | RMSE | 结论 |
|---|---|---:|---:|---:|---|
| Workspace Home | `640:256` | 1440×1024 | 24.4219% | 19.28 | `DIFF_REVIEW` |
| Agent Chat | `640:428` | 1440×1024 | 11.7176% | 17.25 | `DIFF_REVIEW` |
| Diet Records | `640:588` | 1440×1024 | 37.94% | 17.38 | `DIFF_REVIEW` |
| Intake Analysis | `640:773` | 1440×1024 | 28.07% | 18.50 | `DIFF_REVIEW` |
| Meal Planning | `640:901` | 1440×1024 | 23.83% | 16.80 | `DIFF_REVIEW` |
| Admin Overview | `995:977` | 1440×1024 | 33.57% | 19.58 | `DIFF_REVIEW` |
| Admin Tool Registry | `692:3847` | 1440×1024 | 21.43% | 18.84 | `DIFF_REVIEW` |
| Admin Deleted Resources | `692:4104` | 1440×1024 | 26.04% | 17.05 | `DIFF_REVIEW` |
| User Knowledge Empty | `795:786` | 1440×1024 | 21.91% | 12.25 | `DIFF_REVIEW` |
| User Knowledge Default | `795:838` | 1180×1024 主区域 | 70.62% | 143.65 | `DIFF_REVIEW` |
| User Knowledge Search Failed | `795:968` | 1440×1024 | 35.24% | 16.58 | `DIFF_REVIEW` |
| User Knowledge Source Unavailable | `795:1151` | 1440×1024 | 35.16% | 16.95 | `DIFF_REVIEW` |
| Profile Basic | `806:1119` | 1440×1024 | 67.46% | 20.74 | `DIFF_REVIEW` |
| Profile Memories | `806:1281` | 1440×1024 | 50.35% | 23.05 | `DIFF_REVIEW` |
| Profile Security | `806:1445` | 1440×1024 | 60.25% | 19.68 | `DIFF_REVIEW` |
| Profile Privacy | `806:1585` | 1440×1024 | 37.09% | 17.96 | `DIFF_REVIEW` |
| Login | `647:214` | 1440×900 | 99.19% | 7.50 | `DIFF_REVIEW` |
| Admin User Detail | `801:215` | 1440×1024 | 22.36% | 17.62 | `DIFF_REVIEW` |

Login 的高差异比例主要来自大面积抗锯齿、透明叠加和斜向背景边界；几何已按 Figma 读取结果对齐：表单 `400×471`，位置 `x=490,y=214.5`，品牌区 `163px`，字段区 `156px`，按钮 `52px`，分隔区 `56px`，注册行 `44px`。该页仍保留 `DIFF_REVIEW`，不将人工“基本重合”写成自动化 PASS。

证据目录：[`.qa/figma-pixel-acceptance`](../../foodmate-ui/.qa/figma-pixel-acceptance)

## 5. 全量画板映射

Figma Design 页共有 105 张顶层画板。本轮已为 105 张画板建立独立前端路由或 query 状态、同尺寸浏览器视口和 PNG 证据；当前 `UNMAPPED=0`、`SIZE_MISMATCH=0`。完整逐项清单不在本报告重复展开，以映射 JSON 作为机器可读的唯一清单来源。

每一项均记录 Figma 节点 ID、画板名称、画板尺寸、前端路由、query 状态、浏览器视口、Figma PNG、浏览器 PNG、diff JSON 锚点和人工复核结论。当前 `figma-105-runtime-checks.json` 已通过 DPR 1 复采集，运行时汇总为 `geometryPass=105/105`、`textPass=105/105`、`dprPass=105/105`；这只关闭分辨率门禁，不能替代自动 diff 和人工视觉复核，因此仍不能将 `DIFF_REVIEW` 改为 `PASS`。

## 6. 其它检查

- 页面级横向溢出检查：已覆盖多个桌面和移动视口，当前记录为通过；这只证明没有页面级横向溢出，不等于像素级通过。
- Figma 可见文字边界：此前全文件扫描未发现越界或零尺寸文本；浏览器运行时的 105 项可见文本边界检查也均通过。
- Prototype：所有带目标的 reaction 目标均有效；该结果不等于浏览器端每条交互已经真实接通。
- 字体：生产构建已使用 `@fontsource/noto-sans-sc`、`@fontsource/space-mono` 和 `@fontsource/montserrat` 的真实 woff2 产物。
- iconfont：仍为 `BLOCKED`，因为实体字体包、CSS 映射、来源和授权尚未提供。

## 6.1 2026-08-30 Chat 助手消息背景收口

- Figma 节点 `640:428` 的助手消息外层背景已依据已登记 PNG 对齐为 `#f9fafb`；前端仅在 `.designChatPage` fixture 作用域定义 `--fm-fixture-assistant-surface`，真实模式和其他页面不受影响。
- Chat 与 Workspace 定向测试共 `38/38` 通过；浏览器 `1440×1024` 实测字体为 `loaded`、页面无横向溢出，前端左上角红黄绿窗口控制点数量为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- 新增 RGBA 浏览器证据 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-surface-browser-2026-08-30-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-assistant-surface-2026-08-30-diff.json`；同尺寸结果为 `30.9938% / MAE 3.868814 / RMSE 19.521027 / maxChannelDelta 255`，较上一份 Chat 证据有小幅改善，结论仍为 `DIFF_REVIEW`。
- `figma-105-mapping.json` 与 `figma-105-diff-results.json` 已切换到本次证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。iconfont 仍为 `BLOCKED`，shadcn 全量逐页迁移仍未完成。

## 6.2 2026-08-30 Chat Composer 输入行背景收口

- Figma 节点 `640:428` 的 Composer 输入行背景已依据已登记 PNG 对齐为 `#fcfcfc`；前端通过继承的 `--fm-fixture-composer-input-surface` 作用于 Figma fixture，真实模式继续使用 `--fm-bg-soft` fallback。
- Chat 与 Composer 定向测试共 `35/35` 通过；浏览器 `1440×1024` 实测输入行背景为 `rgb(252, 252, 252)`、字体为 `loaded`、页面无横向溢出，前端左上角红黄绿窗口控制点数量为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- 新增 RGBA PNG 和独立 diff：`agent-chat-v2-composer-surface-browser-2026-08-30-rgba.png`、`agent-chat-v2-composer-surface-2026-08-30-diff.json`；同尺寸结果为 `27.8977% / MAE 3.693984 / RMSE 19.488887 / maxChannelDelta 255`，结论仍为 `DIFF_REVIEW`。
- `figma-105-mapping.json` 与 `figma-105-diff-results.json` 已切换到本次证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。iconfont 仍为 `BLOCKED`，shadcn 全量逐页迁移仍未完成。

## 7. 后续验收门槛

1. 对 105 个已映射画板逐项完成几何、文字、颜色、状态和像素差异复核。
2. 使用同一视口、同一 DPR、同一字体加载完成条件补采或修正存在差异的浏览器截图。
3. 只有在自动 diff、几何检查、文字检查和人工复核都满足时，才将单页从 `DIFF_REVIEW` 改为 `PASS`。
4. iconfont 资源登记必须在收到真实包、CSS、来源和许可证后单独关闭，不能用 Lucide 或虚构字体替代。

## 7.1 2026-09-05 Auth 实时 Figma 参考与 Login Motion 证据

本节补充认证主画板的最新实时 Figma PNG 与浏览器 PNG。此前报告中的旧版认证 PNG 和历史截图保留为历史记录；本节路径为本次复采集的当前证据。Figma 文件保持只读。

| 画板 | Figma 节点 | Figma PNG | 浏览器 PNG | 视口 / DPR | diff 比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Login | `647:214` | `recaptured-figma/auth-login-647-214-live-2026-09-05.png` | `recaptured/dpr1-login-v2-browser-2026-09-05.png` | `1440×900 / 1` | `3.7962%` | `0.566035` | `7.555450` | `213` | `DIFF_REVIEW` |
| Register | `680:216` | `recaptured-figma/auth-register-680-216-live-2026-09-05.png` | `recaptured/dpr1-register-page-browser-2026-09-05.png` | `1440×900 / 1` | `4.2780%` | `0.567688` | `6.677208` | `198` | `DIFF_REVIEW` |
| Forgot Password | `680:275` | `recaptured-figma/auth-forgot-680-275-live-2026-09-05.png` | `recaptured/dpr1-forgot-password-page-browser-2026-09-05.png` | `1440×900 / 1` | `3.0128%` | `0.648710` | `7.311507` | `188` | `DIFF_REVIEW` |
| Reset Password | `680:307` | `recaptured-figma/auth-reset-680-307-live-2026-09-05.png` | `recaptured/dpr1-reset-password-page-browser-2026-09-05.png` | `1440×900 / 1` | `3.8650%` | `1.093539` | `10.593789` | `213` | `DIFF_REVIEW` |
| Token Invalid | `680:738` | `recaptured-figma/auth-token-invalid-680-738-live-2026-09-05.png` | `recaptured/dpr1-token-invalid-browser-2026-09-05.png` | `1440×900 / 1` | `1.8195%` | `0.101208` | `2.509056` | `204` | `DIFF_REVIEW` |

- [x] 五张 Figma 参考图与五张浏览器图均为 `1440×900`，浏览器使用 Chrome CDP、DPR `1`、字体 `loaded` 和 `visual-qa=1`；页面主内容已加载，无横向溢出。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和运行时 URL 记录已同步；三条空 query 页面不再登记 `?null&visual-qa=1`。
- [x] Login 实时 Motion 数据来自 `get_motion_context(fileKey=MX18RZCfAmgprNzxItkHUH,nodeId=647:214,recursive=true)`：时间线 `4500ms`、`loopMode=loop`，包含 `647:275`、`660:212`、`647:236`、`647:237`、`647:240`、`647:250`、`647:253` 和 `647:278`；代码侧继续使用 GSAP 适配这些关键帧。
- [ ] 五张当前参考图对比均存在非零差异，且尚未全部完成独立人工视觉复核，因此保持 `DIFF_REVIEW`；不能以 DPR、几何和字体检查通过替代像素级 `PASS`。

## 8. 餐食规划状态补充验收

## 9. 2026-09-02 Admin 操作审计页当前证据

本轮依据 Figma 节点 `995:1499` 收口 `/admin?view=audit` 的前端 fixture，Figma 设计稿保持只读。前端新增并保留生产环境标记、结果/目标类型/动作筛选、`request_id / trace_id` 搜索、三张统计卡、十列表格、分页、底部分析卡和只读详情 Dialog；真实模式继续使用既有操作审计 API、导出任务和权限逻辑。

- [x] 浏览器使用本地 Edge `1440×1024`、强制 DPR 1、字体加载完成条件采集；页面根节点为 `1440×1024`，`body` 无横向溢出，文字溢出检查通过。
- [x] 实际交互验证结果筛选、`request_id` 搜索、详情 Dialog；详情包含动作、操作者、目标、创建时间、请求摘要、前后状态、错误码、`trace_id` 和客户端信息。
- [x] 前端左上角 macOS 红、黄、绿窗口装饰点候选数量为 `0`；该检查只针对前端，未修改 Figma 设计稿；业务状态点保留。
- [x] 当前浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-operation-audit-browser-2026-09-02.png`，Figma 参考为 `docxs/设计/figma-png/admin-operation-audit.png`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=157231`、差异比例 `10.6629%`、`MAE=3.015004`、`RMSE=17.033025`、最大通道差异 `241`；独立结果已同步至 `figma-105-diff-results.json#admin-operation-audit`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已同步当前审计页证据；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 当前页面仍有文字光栅化、头像素材和局部视觉像素差异，因此保留 `DIFF_REVIEW`；本项不能宣称该画板或 105 张画板像素级 PASS。

本轮补充餐食规划 Loading、Empty、Error 三种前端状态的独立映射。Figma 来源节点均为完整 `1440×1024` 画板；浏览器入口复用 `/planning?state=`，只用于复现设计状态，不代表真实计划数据或任务闭环已经完成。

| 状态 | Figma 节点 | 前端入口 | Figma 证据 | 浏览器证据 | 结果 |
|---|---|---|---|---|---|
| Loading | `692:2256` | `/planning?state=loading` | `meal-planning-loading-figma-live-2026-08-26.png` | `meal-planning-loading-browser-current-2026-08-26.jpg` / `meal-planning-loading-browser-current-2026-08-26-rgba.png` | `DIFF_REVIEW` |
| Empty | `692:2446` | `/planning?state=empty` | `meal-planning-empty-figma.png` | `meal-planning-empty-browser-stable.png` / `meal-planning-empty-browser-stable-rgba.png` | `DIFF_REVIEW` |
| Error | `692:2542` | `/planning?state=error` | `meal-planning-error-figma-live-2026-08-26.png` | `meal-planning-error-browser-current-2026-08-26-rgba.png` | `DIFF_REVIEW` |

| 状态 | 尺寸 | 差异比例 | RMSE | 结论 |
|---|---:|---:|---:|---|
| Loading | 1440×1024 | 18.1852% | 9.65195 | `DIFF_REVIEW` |
| Empty | 1440×1024 | 16.98% | 16.88 | `DIFF_REVIEW` |
| Error | 1440×1024 | 13.2237% | 9.91903 | `DIFF_REVIEW` |

三个状态均确认 `document.body.scrollWidth === window.innerWidth`。Empty 的“创建首个规划方案”已实际进入 `/chat?prompt=请为我创建本周餐食规划`；Error 的“重新加载”已实际恢复 `/planning` 默认态。这些是前端状态交互证据，不等价于真实计划数据、生成任务或后端错误闭环。

## 12. 2026-08-26 餐食规划错误态实时 Figma 几何收口

- [x] 重新读取实时 Figma 节点 `692:2542` 与元数据，确认主区为 `1180px`、顶部栏为 `68px`、错误卡片为 `520×417px`，内边距 `48px`，图标容器 `100×100px`，错误图标背景为 `rgba(255,117,118,0.06)`。
- [x] 前端 `/planning?state=error` 仅收口错误态：卡片改为等效 `inset` 描边避免边框占用尺寸，错误码行高对齐到 `13px`，操作文字行高对齐到 `18px`，未改变空态、真实模式或 Figma 文件。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体已加载、无横向溢出；卡片为 `x=590,y=315.5,width=520,height=417`，错误图标为 `100×100`，前端左上角红黄绿窗口控制点为 `0`，业务状态点保留。
- [x] 使用实时 Figma PNG `meal-planning-error-figma-live-2026-08-26.png` 与浏览器 RGBA PNG `meal-planning-error-browser-current-2026-08-26-rgba.png` 运行 `scripts/png-diff.mjs`：差异比例 `13.2237%`、`MAE=1.23294`、`RMSE=9.91903`、最大通道差异 `244`。
- [ ] 该画板仍为 `DIFF_REVIEW`：错误卡片局部几何和层级已对齐，但整页壳层、头像、图标和浏览器光栅化仍存在可见差异，不能标记像素级 `PASS`。

## 9. 餐食规划流程状态补充验收

本轮继续补齐已存在前端入口的餐食规划流程状态。所有画板与浏览器截图均为 `1440×1024`；`-rgba.png` 是浏览器 JPEG 证据的 RGBA 归一化副本，供 `png-diff.mjs` 使用。

| 状态 | Figma 节点 | 前端入口 | Figma 证据 | 浏览器证据 | 差异比例 | RMSE | 结果 |
|---|---|---|---|---|---:|---:|---|
| 向导步骤 1 | `692:2801` | `/planning?state=wizard-step1` | `meal-plan-wizard-step1-figma.png` | `meal-plan-wizard-step1-browser-stable-rgba.png` | 40.49% | 21.93 | `DIFF_REVIEW` |
| 向导步骤 2 | `692:2934` | `/planning?state=wizard-step2` | `meal-plan-wizard-step2-figma.png` | `meal-plan-wizard-step2-browser-stable-rgba.png` | 42.86% | 22.56 | `DIFF_REVIEW` |
| 向导步骤 3 | `692:3078` | `/planning?state=wizard-step3` | `meal-plan-wizard-step3-figma.png` | `meal-plan-wizard-step3-browser-stable-rgba.png` | 43.15% | 23.92 | `DIFF_REVIEW` |
| 冲突解决 | `692:3375` | `/planning?state=conflict` | `meal-plan-conflict-figma.png` | `meal-plan-conflict-browser-stable-rgba.png` | 37.28% | 25.12 | `DIFF_REVIEW` |
| 购物清单 | `692:3569` | `/planning?state=shopping-list` | `meal-plan-shopping-list-figma.png` | `meal-plan-shopping-list-browser-stable-rgba.png` | 24.35% | 17.23 | `DIFF_REVIEW` |
| 生成中 | `692:3746` | `/planning?state=generating` | `meal-plan-generating-figma.png` | `meal-plan-generating-browser-stable-rgba.png` | 13.69% | 16.84 | `DIFF_REVIEW` |
| 计划列表 | `692:2662` | `/planning?state=list` | `recaptured-figma/meal-plan-list-live-2026-08-29.png` | `recaptured/meal-plan-list-tabs-gap-browser-2026-08-29-rgba.png` | 21.6817% | 13.77 | `DIFF_REVIEW` |

计划列表最新证据使用原始 `1440×1024` Figma 截图和浏览器 RGBA 截图，`png-diff.mjs` 结果为 `differentRatio=21.6817%`、`MAE=2.37253`、`RMSE=13.77192`、`maxChannelDelta=232`。浏览器运行时视口和 DPR 均通过，页面无横向溢出、可见文字无越界；列表 Tab 的位置为 `x=292/374/456`、间距 `8px`，三张计划卡和新建按钮均已复核。整体壳层、内容密度、字体和图标光栅化仍存在差异，继续保留 `DIFF_REVIEW`。前端未渲染 Figma 中的左上角红黄绿窗口装饰点，Figma 文件未修改。

浏览器 smoke 已实际确认：向导步骤推进和取消生成、冲突方案应用、购物清单初始采购数量及导出反馈均可操作；七个入口均无页面级横向溢出。流程 fixture 只复现前端设计状态，不代表真实餐食生成、冲突解决、购物清单持久化或异步任务后端闭环完成。

## 10. Knowledge 状态补充验收

本轮补充了 Knowledge 默认态、检索失败和来源不可用三种前端状态的独立浏览器证据。Figma 结构依据为 `795:838`、`795:968`、`795:1145`、`795:1151` 和 `795:1328`；状态卡在完整画板中的绝对位置均为 `x=550,y=300`、`600×260`，空态仍使用已有 `560×220` 画板。

| 状态 | Figma 证据 | 浏览器证据 | 结果 |
|---|---|---|---|
| 默认态 | `recaptured/user-knowledge-default-fixture-figma-white-2026-08-28.png` | `recaptured/user-knowledge-default-fixture-browser-content-2026-08-28.png` | `DIFF_REVIEW` |
| 检索失败 | `user-knowledge-search-failed-figma-latest.png` | `recaptured/user-knowledge-search-failed-browser-dpr1-2026-08-29-rgba.png` | `DIFF_REVIEW` |
| 来源不可用 | `user-knowledge-source-unavailable-figma-latest.png` | `recaptured/user-knowledge-source-unavailable-browser-dpr1-2026-08-29-rgba.png` | `DIFF_REVIEW` |

默认态 Figma 节点本身是主区域 `1180×1024`，因此浏览器证据按 `x=260` 裁剪后比较；本轮重新采集的默认态完整浏览器视口为 `1440×1024`、DPR `1.25`，顶栏品牌块为空、侧栏品牌块保留 `F`，窗口装饰点数量为 `0`。Figma 参考图先合成白底，再使用 `scripts/png-diff.mjs` 比较，结果为 `49.8610% / MAE 3.2238 / RMSE 14.1849`，仍为 `DIFF_REVIEW`，不满足 DPR 1 的 `PASS` 门禁。检索失败和来源不可用状态使用完整 `1440×1024`、DPR1 浏览器截图，最新结果分别为 `35.2425% / MAE 3.88158 / RMSE 16.57742 / maxChannelDelta 255` 与 `35.1598% / MAE 3.94340 / RMSE 16.95234 / maxChannelDelta 255`；三组结果均没有将视觉接近写成 `PASS`。状态层的半透明遮罩、色条、状态标签、标题、技术字段和重试入口均已通过截图人工复核。

本轮默认态 fixture 收口的独立证据为 `foodmate-ui/.qa/figma-pixel-acceptance/user-knowledge-default-fixture-2026-08-28-diff.json`，对应原始浏览器截图、内容区裁剪图、Figma 原始 PNG 和白底归一化 PNG。默认态现在固定使用 Figma 示例账号 `Anddy / 1234567` 与会话列表；真实模式仍不启用 fixture 覆盖。

本轮只补齐前端状态映射和像素差异证据，不代表真实 RAG 检索、文档导入、ACL 过滤、引用详情接口或 iconfont 实体资源已经完成。

## 11. Admin User Detail 补充验收

本轮完成 Figma `801:215` 到 `/admin/users` 的独立前端映射。Figma 画板关键几何为：侧栏 `260px`、顶栏 `64px`、左侧用户列表 `x=284,y=88,w=692,h=912`、右侧详情 `x=996,y=88,w=420,h=912`；列表为 4 行 `60px`，详情卡内边距 `20px`，详情说明卡位于卡内 `x=19,y=454,w=380,h=220`。

前端 mock fixture 按 Figma 示例登记 `usr_098a1`、`usr_112b9`、`usr_774x2`、`usr_889d4`，包含角色、状态、邮箱、活跃会话数和选中用户详情。详情 Tab 顺序为 `资料`、`饮食`、`登录会话`、`历史`、`业务会话`；状态变更和撤销会话继续复用 Admin 页面已有的二次确认、提交中、成功/失败和审计状态机。真实模式仍调用 `/api/admin/users`、用户状态 PATCH 和撤销全部会话 POST，不替换真实响应。

证据文件：

- Figma：`admin-user-detail-figma.png`
- 浏览器原始截图：`admin-user-detail-browser.png`
- RGBA 归一化截图：`admin-user-detail-browser-rgba.png`
- diff：`1440×1024`，差异比例 `22.36%`，RMSE `17.62`，结论 `DIFF_REVIEW`

历史首轮浏览器验证曾为 `DPR 1.25`，因此当时 diff 使用 RGBA 归一化副本；2026-08-18 已按 `DPR 1` 重新采集并纳入当前 105 项运行时复核。`重置凭证` 当前只有明确的未接入提示，不执行伪造请求。

## 12. Admin Operation Status 补充验收

本轮完成 Figma 工具注册表五个操作状态节点到 `/admin/tools?tab=registry` 的代码映射：

| 状态 | Figma 节点 | 前端行为 |
|---|---|---|
| 无权限 | `692:4319` | Operator 顶层信息横幅，写操作按钮锁定 |
| 确认操作 | `692:4539` | `480px` 确认弹窗、影响资源说明、取消/确认 |
| 提交中 | `692:4766` | 保持确认标题、`4px` 红色进度条、禁用按钮和同步文案 |
| 成功 | `692:4995` | 顶层成功横幅，列表状态局部更新 |
| 失败 | `692:5207` | 错误原因、集群未响应说明、错误码、请求 ID、关闭/重试 |

浏览器已实际检查默认注册表、配置详情后的确认弹窗、提交中弹窗和成功横幅；默认状态下列表、统计卡、筛选和分页保持可见，提交中状态没有页面级横向溢出或意外重叠。证据截图保存在 `.qa/figma-pixel-acceptance/admin-operation-status-*.png`。

本轮状态截图是浏览器行为证据，不等价于五个节点的自动化像素 PASS。Figma 五个状态与浏览器截图仍需在相同 DPR、字体加载完成条件下独立运行 `png-diff.mjs` 后，才能更新为单状态 `PASS` 或 `DIFF_REVIEW`。

## 13. 认证页面与异常状态代码迁移

本轮按 Figma 实际节点补齐认证页面代码和状态入口，视觉来源仍为 Figma，不使用旧前端样式反推。

| 页面/状态 | Figma 节点 | 前端入口 | 浏览器证据 | 像素结论 |
|---|---|---|---|---|
| 注册 | 680:216 | /register | register-page-browser.png、register-page-browser-mobile.png | DIFF_REVIEW |
| 找回密码 | 680:275 | /forgot-password | forgot-password-page-browser.png、forgot-password-page-success-browser.png | DIFF_REVIEW |
| 重置密码 | 680:307 | /reset-password | reset-password-page-browser.png | DIFF_REVIEW |
| 登录默认 | 647:214 | /login | login-default-browser-rgba.png | DIFF_REVIEW |
| 登录提交中 | 680:408 | /login?state=submitting | login-submitting-browser-rgba.png | DIFF_REVIEW |
| 登录字段错误 | 680:445 | /login?state=field-error | login-field-error-browser-rgba.png | DIFF_REVIEW |
| 登录凭证错误 | 680:483 | /login?state=credential-error | login-credential-error-browser-rgba.png | DIFF_REVIEW |
| 账号锁定 | 680:524 | /login?state=account-locked | login-account-locked-browser-rgba.png | DIFF_REVIEW |
| 账号禁用 | 680:564 | /login?state=account-disabled | login-account-disabled-browser-rgba.png | DIFF_REVIEW |
| 服务不可用 | 680:606 | /login?state=service-unavailable | login-service-unavailable-browser-rgba.png | DIFF_REVIEW |
| Token 无效 | 680:738 | /token-status?state=invalid | token-invalid-browser-current-2026-08-29-rgba.png | DIFF_REVIEW |
| Token 过期 | 680:757 | /token-status?state=expired | token-expired-browser-rgba.png | DIFF_REVIEW |
| Token 已使用 | 680:776 | /token-status?state=used | token-used-browser-current-2026-08-29-rgba.png | DIFF_REVIEW |

新增状态在 1440x900、DPR 1 的浏览器截图与 Figma PNG 上运行了 scripts/png-diff.mjs。结果全部保留 DIFF_REVIEW：登录默认 99.19% / RMSE 7.54；提交中 99.92% / 10.83；字段错误 99.98% / 18.92；凭证错误 99.52% / 20.53；账号锁定 100.00% / 31.18；账号禁用 99.99% / 14.02；服务不可用 99.99% / 13.41；Token 过期 99.99% / 9.67；Token 已使用 99.99% / 10.76。Token 无效的旧基线为 99.99% / RMSE 9.39，最新 2026-08-29 同尺寸证据已在第 52 节更新为 51.07% / RMSE 2.34。

浏览器行为检查确认：字段错误和凭证错误保留可用登录按钮；提交中、账号锁定、账号禁用和服务不可用禁用登录按钮；Token 三态均能进入找回密码或返回登录。移动注册页的四个输入控件完整位于 390x844 视口内。

本节不代表认证服务的所有异常一定能由 mock 状态触发，也不代表真实后端错误码已全部联调。真实 /api/auth/* 调用仍由 authService.ts 保持；mock 状态 query 只用于设计验收和前端状态复现。

## 40. 2026-08-14 Figma Agent 空态迁移与验收

本轮完成 Figma `agent-empty` 画板到独立前端状态的首轮迁移。视觉来源为 Figma 节点 `687:219`，不从旧前端反推颜色、字体、尺寸、间距或状态。

| 项目 | 结果 |
|---|---|
| Figma 节点/画板 | `687:219` / `1440×1024` |
| 前端入口 | `/chat?state=empty` |
| 空态结构 | 无 Trace 右栏；居中引导、三张推荐问题卡、底部 Composer |
| 桌面几何 | 推荐卡区域约 `720×123`，卡片间距 `16px`；Composer 位于 `y=912`，高度 `112px` |
| Figma 证据 | `chat-agent-empty-figma.png` |
| 浏览器证据 | `chat-agent-empty-browser-1440x1024.png`、`chat-agent-empty-browser-390x844.png` |
| RGBA 证据 | `chat-agent-empty-browser-1440x1024-rgba.png`、`chat-agent-empty-browser-390x844-rgba.png` |
| 自动 diff | 差异比例 `15.7739%`，RMSE `14.7325`，`DIFF_REVIEW` |

- [x] 桌面 `1440×1024` 实测 `document.body.scrollWidth === 1440`；标题、说明、推荐卡和 Composer 无页面级裁切或横向溢出。
- [x] 移动 `390×844` 实测页面宽度与视口一致；三张推荐卡改为单列，Composer 完整位于视口底部。为修复移动端 Composer 被百分比高度裁切的问题，空态页在移动断点使用 `calc(100dvh - 96px)` 的明确内容区高度。
- [x] 点击推荐卡会将真实推荐文案写入 Composer；点击发送后 URL 进入 `/chat?prompt=...`，不伪造后端 Agent 完成结果。
- [x] `ChatPage` 定向测试 `2/2`、`npm run typecheck` 和本次触及文件的 Prettier 检查通过；`git diff --check` 通过。
- [ ] 全量 `npm run format:check` 仍被工作区原有的 8 个未涉及文件阻断：`ClarificationCard.tsx`、`EmptyState.tsx`、`TaskCard.tsx`、`Composer.tsx`、`AdminPage.tsx`、`agentRunService.ts`、`sessionService.ts`、`agent.ts`；本轮未扩大范围改动这些文件。
- [ ] 本轮不关闭 iconfont 实体资源登记；当前仍缺少真实字体包、CSS 映射、来源 URL 和许可证，标准命令图标继续使用 Lucide。shadcn/Radix 基础设施迁移仍作为后续逐页重构的既定前置约束。

## 41. 2026-08-14 Figma Agent Planning 状态迁移与验收

本轮完成 Figma `agent-planning` 画板到 `/chat?state=planning` 的独立状态迁移。视觉来源为 Figma 节点 `687:342`，不从普通对话旧样式反推。

| 项目 | 结果 |
|---|---|
| Figma 节点/画板 | `687:342` / `1440×1024` |
| 前端入口 | `/chat?state=planning` |
| 状态差异 | 隐藏 Trace 右栏；显示 Planning 状态条、用户消息、四行规划步骤卡和红色停止按钮 |
| 核心几何 | 主区 `1180px`；状态条 `45px`；Composer `y=912/h=112`；规划卡约 `x=340/y=237/w=161/h=162` |
| Figma 证据 | `chat-agent-planning-figma.png` |
| 浏览器证据 | `chat-agent-planning-browser-1440x1024.jpg`、`chat-agent-planning-browser-390x844.jpg` |
| RGBA 证据 | `chat-agent-planning-browser-1440x1024-rgba.png`、`chat-agent-planning-browser-390x844-rgba.png` |
| 自动 diff | 差异比例 `14.9956%`，RMSE `14.0682`，`DIFF_REVIEW` |

- [x] 桌面 `1440×1024` 实测页面宽度与 Figma 画板一致，无页面级横向溢出；状态条、用户消息、规划卡和 Composer 均可见。
- [x] 移动 `390×844` 实测 `document.body.scrollWidth === 390`；规划卡自然保留四行内容，Composer 完整可见，停止按钮可用。
- [x] Planning 状态的输入框按设计禁用，停止按钮保留可用状态；本地 query fixture 只复现前端状态，不声明真实 AgentRun 后端完成。
- [x] `ChatPage` 定向测试 `3/3`、`npm run typecheck`、本次触及文件 Prettier 和 `git diff --check` 通过。
- [ ] diff 仍为 `DIFF_REVIEW`，WorkspaceLayout 头像、账号文案等共享壳层差异不能被本状态单独关闭；iconfont 实体资源继续为 `BLOCKED`。

## 42. 2026-08-14 Figma Agent Tool Executing 状态迁移与验收

本轮完成 Figma `agent-tool-executing` 画板到独立前端状态的迁移。视觉来源为 Figma 节点 `687:475`，实现严格读取节点颜色、字体、尺寸、间距和状态语义，不从旧前端反推。

| 项目 | 结果 |
|---|---|
| Figma 节点/画板 | `687:475` / `1440×1024` |
| 前端入口 | `/chat?state=tool-executing` |
| 主结构 | `260px` 侧栏、`860px` 对话区、`320px` Trace rail；保留完整共享工作站壳层 |
| 状态条 | `Planning ✓`、`Retrieving ✓`、`Executing ●`、`Composing ○` |
| 工具卡 | 完成、运行中、待处理三行；运行中橙色边框与加载图标，待处理降低强调度 |
| Composer | `y=912`、`h=112`；输入禁用，停止按钮保持可用 |
| Figma 证据 | `chat-agent-tool-executing-figma.png` |
| 浏览器证据 | `chat-agent-tool-executing-browser-1440x1024.jpg`、`chat-agent-tool-executing-browser-390x844.jpg` |
| RGBA 证据 | `chat-agent-tool-executing-browser-1440x1024-rgba.png`、`chat-agent-tool-executing-browser-390x844-rgba.png` |
| 自动 diff | 差异比例 `50.5259%`，RMSE `23.1703`，`DIFF_REVIEW` |

- [x] 桌面几何已实际核对：主区 `x=260,w=860`，Trace body `y=107`，首个 Trace 卡 `y=135`，工具气泡 `181×250`，用户气泡 `228×49`，Composer `y=912/h=112`。
- [x] 移动 `390×844` 实测 `document.body.scrollWidth === 390`；Trace rail 按窄屏规则隐藏，工具卡和停止按钮没有页面级横向溢出。
- [x] Trace 状态真实渲染 `fst_trace_9821aa`、意图解析、向量检索、数据库调用和结果合成；query fixture 只用于设计验收，不代表真实 AgentRun/SSE 后端闭环。
- [x] `ChatPage` 定向测试 `4/4`、`npm run typecheck`、本次触及文件 Prettier 和 `git diff --check` 通过。
- [ ] diff 仍为 `DIFF_REVIEW`；当前账户文案、字体光栅化和 Figma/前端头像位图差异未被伪装成 PASS。
- [ ] iconfont 实体资源仍为 `BLOCKED`；标准命令图标继续使用 Lucide，未写入虚构字体包、类名或 Unicode。
- [ ] `agent-awaiting-clarification` 已完成当前版本证据复核；下一步按顺序复核 `agent-write-confirmation`、`agent-budget-limit`，再处理失败、降级、取消和 SSE 重连状态。

## 43. 2026-08-15 Agent Awaiting Clarification 状态迁移与验收

本轮完成 Figma `agent-awaiting-clarification` 状态到独立前端 fixture 的迁移。唯一视觉来源为 Figma 文件 `MX18RZCfAmgprNzxItkHUH` 的节点 `687:642`，画板尺寸为 `1440×1024`；前端入口为 `/chat?state=awaiting-clarification`。该 query 只复现可重复的前端视觉和交互状态，不代表真实 AgentRun、SSE、澄清提交或后端任务闭环。

| 验收项 | 实测结果 |
|---|---|
| 桌面视口 | `1440×1024`，`document.body.scrollWidth === 1440` |
| 桌面澄清卡 | `x=340,y=237,w=222,h=193` |
| 桌面 Composer | `x=260,y=912,w=1180,h=112`，保持可输入 |
| 移动视口 | `390×844`，`document.body.scrollWidth === 390`，侧栏隐藏 |
| 移动澄清卡 | `x=64,y=251.8,w=222,h=193` |
| 移动 Composer | `x=0,y=732.8,w=375.2,h=112` |
| 共享布局状态 | 顶部“工作台”和侧栏“Agent 对话”均显示 Figma 选中态；fixture 覆盖 `Anddy / 1234567` |
| 资源 | 已登记 sidebar、topbar、message 三个 Figma 头像资源；路径位于 `foodmate-ui/public/assets/figma/agent-chat/awaiting-clarification/` |
| 定向测试 | `ChatPage.test.tsx`：`5/5` 通过；`npm run typecheck` 通过 |
| 桌面自动 diff | `differentRatio=0.1600301`，`meanAbsoluteError=1.9716`，`RMSE=13.5626`，结论 `DIFF_REVIEW` |
| 移动自动 diff | 当前只有 `1440×1024` Figma 参考图，移动截图实际为 `390×843` PNG；与桌面参考图尺寸不同，结论 `SIZE_MISMATCH`，不输出像素通过结论 |

- [x] 澄清卡选项支持选中态和回调；Composer 在 awaiting 状态保持可输入。
- [x] 共享布局在视觉 fixture 存在 override 时优先使用 override，不被当前认证用户状态覆盖。
- [x] 桌面和移动浏览器截图、RGBA 归一化截图与 Figma 参考图已保存到 `foodmate-ui/.qa/figma-pixel-acceptance/`。
- [ ] 自动 diff 仍为 `DIFF_REVIEW`；不能以人工接近替代像素级 PASS。
- [ ] iconfont 实体包、CSS 映射、来源 URL、许可证和 glyph 登记仍为 `BLOCKED`；标准命令图标继续使用 Lucide。
## 45. 2026-08-15 全量映射与 PNG 证据复核

本轮按实时 Figma 文件 `MX18RZCfAmgprNzxItkHUH` 的 `🎨 :: Design` 页面重新核对 105 个顶层画板，并补齐此前缺失的 11 张原始 Figma PNG。验收清单和自动汇总分别位于：

- `foodmate-ui/.qa/figma-pixel-acceptance/figma-105-mapping.json`
- `foodmate-ui/.qa/figma-pixel-acceptance/figma-105-diff-results.json`
- `foodmate-ui/scripts/generate-figma-105-diff.mjs`

本轮汇总结果：

| 状态 | 数量 | 说明 |
|---|---:|---|
| `DIFF_REVIEW` | 105 | Figma 与浏览器 PNG 尺寸一致，已运行 `scripts/png-diff.mjs`；仍有视觉差异，且当前 Chat 历史页复核的 DPR1 门禁未关闭 |
| `UNMAPPED` | 0 | 105 张画板均已有可验证的浏览器 fixture/路由证据 |
| `SIZE_MISMATCH` | 0 | 本轮没有把尺寸不一致伪装成像素通过 |
| `PASS` | 0 | 未满足自动 diff、几何、文字和人工复核四项条件 |

此前由 JPEG 字节误命名为 `.png` 导致的 `DIFF_ERROR` 已从当前 105 条输入中排除：汇总脚本会校验 PNG 文件头，并优先选择同尺寸的 RGBA 证据。当前清单引用的 105 个 Figma PNG 与 105 个浏览器 PNG 均已通过文件头和尺寸校验。历史基线运行时检查的 `viewportPass`、`geometryPass` 和 `textPass` 为 `105/105`，当前更新后的 `dprPass=102/105`，字体状态均为 `loaded`；人工视觉复核仍为 `0/105`。新增 Agent 六个状态均已建立 `/chat?state=...` fixture、浏览器 PNG 和 diff 记录，但结果继续保持 `DIFF_REVIEW`。

本轮已关闭 `UNMAPPED` 映射缺口，但没有关闭任何 `PASS`。部分 Admin 操作弹窗、Profile 异步操作、历史会话交互和 Workspace 输入状态均使用独立 query fixture，不能与默认页面截图混淆。iconfont 实体资源仍为 `BLOCKED`；后端真实 Agent/SSE 闭环也不作为本轮 fixture 完成标准。

## 46. 2026-08-22 shadcn 控件迁移后的运行时复核

本轮完成的是业务页面控件基础设施迁移，不重新生成 105 张画板的 Figma PNG 或像素 diff，因此不改变上一节的全量结论。

- Planning `/planning?state=wizard-step2` 浏览器复核确认：步骤导航控件为 `32px`，过敏源 Chip 和添加入口为 `26px`；修正前 shadcn 默认高度曾将 Chip 撑到 `40px`，已通过页面 CSS 显式覆盖并重新截图确认。
- Profile `/profile?state=basic` 浏览器复核确认：资料操作按钮和过敏原标签均保持设计 CSS 尺寸，过敏原标签为 `32px`；未发现页面级横向溢出。
- 业务页面源码扫描结果：原生 `<button>` 数量 `0`，`AdminPrimitives` 直接依赖数量 `0`；这项结果只证明控件实现边界，不证明页面与 Figma 已像素一致。
- Planning 冲突解决页 `/planning?state=conflict` 已实测两个 `radiogroup`、4 个可访问 radio、默认选中态和切换态；菜系选择 `/planning?state=wizard-step2` 已实测 shadcn Select 的三个 option 和受控值更新。
- Chat 历史写入确认卡 `/chat?state=history-page-2` 已实测两个可访问 radio，默认“添加到今天的午餐”，点击后可切换到“仅作为对话参考”。
- 当前页面级原生 `<button>`、`<select>`、`type="radio"`、`type="checkbox"` 均为 `0`；仅保留 3 个文件上传输入，属于浏览器文件选择 API 的必要入口；`AdminPrimitives` 直接依赖仍为 `0`。
- Planning 定向测试 `7/7`、Chat 定向测试 `25/25`，全量测试 `25` 个测试文件、`136/136`；`npm run typecheck`、`npm run build` 与 `git diff --check` 均通过。
- `MealPlanningFlow.tsx` 定向 Prettier 已通过；全量 `format:check` 仍受其他未提交文件阻塞，未把该阻塞写成当前页面运行失败。

本次不更新 105 条 diff 状态：仍为 `DIFF_REVIEW=105`、`PASS=0`，人工视觉复核仍未完成；iconfont 资源继续为 `BLOCKED`。

## 51. 2026-08-22 Agent Chat 会话操作面板复核

本轮重新读取 Figma 节点 `806:212`，并对 `/chat?state=session-actions` 完成代码、交互和同尺寸截图复核。Figma 关键几何为遮罩起点 `x=260`、操作面板 `x=470,y=90,w=760,h=316`、选中会话卡 `w=712,h=72`；浏览器实测保持这些尺寸，关闭按钮会隐藏面板并写入 `role=status` 提示。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点 | `806:212`，画板 `1440×1024` |
| 浏览器截图 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-session-actions-browser-current.png` |
| diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-session-actions-current-diff.json` |
| PNG diff | `differentRatio=40.11095%`、`MAE=4.91090`、`RMSE=19.75133`、`maxChannelDelta=255`，保持 `DIFF_REVIEW` |
| 几何与运行时 | `1440×1024`、DPR `1`、面板 `760×316`、会话卡 `712×72`、根节点无滚动溢出 |
| 行为回归 | Chat 定向测试 `25/25`；关闭操作后 `dialogCount=0`；`npm run typecheck` 与目标文件 Prettier 通过 |

- [x] 当前画板已完成自动 diff、几何检查、文字检查和人工视觉复核登记；结果仍为 `DIFF_REVIEW`，没有把面板几何通过写成像素 `PASS`。
- [ ] 底层 Workspace 壳层、字体渲染、图标、遮罩合成和对话/Trace 内容仍与 Figma 存在差异；后续继续逐页修正。
- [ ] iconfont 实体资源登记继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 59. 2026-08-22 Chat 历史分页当前版本证据更新

本轮重新读取实时 Figma 节点 `740:212`、`740:426`、`742:212`，并按当前前端代码重新采集三个 Chat 历史状态。前端保留用户要求的约束：只移除实现页面左上角的红、黄、绿三色窗口装饰点，Figma 画板不做修改；Figma 节点中的 `Space Mono` 助手正文、确认卡和 Trace 结构已按上下文保留。

| 状态 | Figma 节点 | 浏览器 PNG | PNG diff | 结论 |
|---|---|---|---|---|
| 历史第 2 页 | `740:212` | `agent-chat-history-page-2-browser-current.png` | `35.11997% / MAE 4.80656 / RMSE 21.57858` | `DIFF_REVIEW` |
| 历史第 3 页 | `740:426` | `agent-chat-history-page-3-browser-current.png` | `35.12099% / MAE 4.80661 / RMSE 21.57857` | `DIFF_REVIEW` |
| 搜索结果 | `742:212` | `agent-chat-search-results-browser-current.png` | `34.61378% / MAE 4.66959 / RMSE 21.26354` | `DIFF_REVIEW` |

三页均为 `1440×1024`，字体状态为 `loaded`，根节点无横向或纵向溢出，前端窗口装饰点数量为 `0`。当前 in-app 浏览器实际报告 `devicePixelRatio=1.25`，不满足计划要求的 DPR 1，因此本轮没有将几何检查写成 DPR 通过，也没有将任何页面标记为 `PASS`。本机 Chrome 的隔离 DPR1 截图尝试受当前执行策略拦截，未伪造替代证据。

- [x] 三个状态的当前前端 PNG、自动 diff 和映射字段已更新到 `foodmate-ui/.qa/figma-pixel-acceptance/`。
- [x] 旧人工结论中“缺少助手响应、来源、确认控件和 Trace”的描述已修正；当前 fixture 已包含这些结构。
- [ ] DPR1 浏览器截图仍待可验证的浏览器环境；三个状态继续保持 `DIFF_REVIEW`。
- [ ] iconfont 实体包、CSS 映射、来源、许可证和 glyph-Figma 映射仍缺失，继续保持 `BLOCKED`。

## 53. 2026-08-22 Agent Chat 归档结果卡复核

本轮重新读取 Figma 节点 `806:662`，并对 `/chat?state=archived` 完成同尺寸截图和交互复核。设计卡片为 `x=540,y=286,w=620,h=276`，浏览器已对齐 `ARCHIVED` 状态、归档会话条、保留说明、恢复按钮和关闭按钮；恢复与关闭均保留独立状态提示。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点 | `806:662`，画板 `1440×1024` |
| 浏览器截图 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-archived-browser-current.png` |
| diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-archived-current-diff.json` |
| PNG diff | `differentRatio=38.11252%`、`MAE=3.88295`、`RMSE=17.12204`、`maxChannelDelta=255`，保持 `DIFF_REVIEW` |
| 几何与运行时 | `1440×1024`、DPR `1`、卡片 `620×276`、归档条 `556×56`、根节点无滚动溢出 |
| 行为回归 | Chat 定向测试 `25/25`；恢复/关闭动作已在浏览器验证；`npm run typecheck` 与目标文件 Prettier 通过 |

- [x] 当前画板已完成自动 diff、几何检查、文字检查和人工视觉复核登记；结果仍为 `DIFF_REVIEW`，没有把归档卡几何通过写成像素 `PASS`。
- [ ] 底层 Workspace 壳层、字体渲染、图标、遮罩合成和对话/Trace 内容仍与 Figma 存在差异；后续继续逐页修正。
- [ ] iconfont 实体资源登记继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 52. 2026-08-22 Agent Chat 会话重命名结果卡复核

本轮重新读取 Figma 节点 `806:438`，并对 `/chat?state=renamed` 完成同尺寸截图和交互复核。设计卡片为 `x=540,y=300,w=620,h=244`，浏览器已对齐 `SAVED` 状态、同步说明、关闭按钮和 `148×44` 返回按钮；关闭结果后不会继续保留遮罩。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点 | `806:438`，画板 `1440×1024` |
| 浏览器截图 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-renamed-browser-current.png` |
| diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-renamed-current-diff.json` |
| PNG diff | `differentRatio=37.23843%`、`MAE=3.76595`、`RMSE=16.77892`、`maxChannelDelta=255`，保持 `DIFF_REVIEW` |
| 几何与运行时 | `1440×1024`、DPR `1`、卡片 `620×244`、返回按钮 `148×44`、根节点无滚动溢出 |
| 行为回归 | Chat 定向测试 `25/25`；返回/关闭动作已在浏览器验证；`npm run typecheck` 与目标文件 Prettier 通过 |

- [x] 当前画板已完成自动 diff、几何检查、文字检查和人工视觉复核登记；结果仍为 `DIFF_REVIEW`，没有把成功卡几何通过写成像素 `PASS`。
- [ ] 底层 Workspace 壳层、字体渲染、图标、遮罩合成和对话/Trace 内容仍与 Figma 存在差异；后续继续逐页修正。
- [ ] iconfont 实体资源登记继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 47. 2026-08-22 注册页布局层级收敛

本轮重新读取 Figma 节点 `680:216`，并在 `1440×900`、DPR 1、字体加载完成条件下重新采集 `/register`。改动范围仅限注册页结构：将 Figma 中独立的四字段组 `680:227`、密码规则组 `680:250` 和底部操作组 `680:263` 从平铺表单间距改为对应的嵌套层级，保留 `form` 语义、真实注册接口和 shadcn `Input`/`Button` 控件。

| 验收项 | 当前证据 |
|---|---|
| 卡片几何 | `x=490,y=34.4,w=460,h=831.2`；内容宽 `380px` |
| 输入几何 | 四个输入 `y=235.2/320.8/406.4/492px`，均为 `380×50px` |
| Figma 参考 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/register-page-latest.png` |
| 浏览器 RGBA | `foodmate-ui/.qa/figma-pixel-acceptance/register-page-browser-current-rgba.png` |
| PNG diff | `differentRatio=54.06998%`、`meanAbsoluteError=0.80904`、`RMSE=5.52169`，保持 `DIFF_REVIEW` |
| 行为回归 | `AuthPages.test.tsx`：`13/13`；`npm run typecheck` 通过；触及文件 Prettier 通过 |

- [x] 注册页的卡片、字段、密码规则和操作区已按 Figma 层级分组，按钮与页脚不再受字段组平铺间距影响。
- [x] 注册页保留空值交互状态，用户输入后密码规则按真实值更新；Figma 静态参考图中的示例值和全绿规则因此继续作为状态差异记录。
- [ ] 该画板仍不能标记 `PASS`：当前浏览器交互态与 Figma 示例填充态不同，且完整人工视觉复核尚未关闭；不得用本轮几何通过替代像素验收。
- [ ] iconfont 实体资源继续为 `BLOCKED`，本轮未添加虚构字体包、Unicode 或 CSS 映射。

## 48. 2026-08-22 找回密码页布局层级收敛

本轮重新读取 Figma 节点 `680:275`，并按实时画板重构 `/forgot-password` 的左右卡片层级。左卡片的邮箱字段与操作区由卡片的 `28px` 间距直接分隔；右卡片将成功图标、标题和说明归入 `16px` 内容组，返回按钮独立使用 Figma 的 `360×46px`、`12px` 圆角样式。表单仍保留真实 `requestPasswordReset` 接口和提交后的状态提示。

| 验收项 | 当前证据 |
|---|---|
| 桌面视口 | `1440×900`，DPR `1.0000000149011612`，页面宽度 `1440` |
| 左侧几何 | 卡片 `x=260,w=440,h=416.4`；输入 `y=452.2,h=50`；发送按钮 `y=530.2,h=50` |
| 右侧几何 | 卡片 `x=740,w=440,h=306.4`；返回按钮 `x=780,y=462.2,w=360,h=46` |
| Figma 参考 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/forgot-password-page-latest.png` |
| 浏览器 RGBA | `foodmate-ui/.qa/figma-pixel-acceptance/forgot-password-page-browser-current-rgba.png` |
| PNG diff | `differentRatio=99.92716%`、`meanAbsoluteError=1.10110`、`RMSE=6.82914`，保持 `DIFF_REVIEW` |
| 行为回归 | `AuthPages.test.tsx`：`13/13`；`npm run typecheck` 通过；触及文件 Prettier 通过 |

- [x] 左右卡片均无页面级横向溢出，右侧成功卡片的默认结构与 Figma 成功态保持一致。
- [x] 发送重置邮件、返回登录和提交后 `role=status` 提示继续保持可操作；真实模式仍只调用既有密码找回接口。
- [ ] 该画板仍不能标记 `PASS`：PNG 自动 diff 与完整人工视觉复核门槛尚未关闭；`differentRatio` 不能被“视觉接近”替代。
- [ ] iconfont 实体资源继续为 `BLOCKED`，本轮继续使用 Lucide 标准图标。

## 49. 2026-08-22 重置密码页布局层级收敛

本轮重新读取 Figma 节点 `680:307`，并按 `680:318`、`680:331`、`680:340` 将 `/reset-password` 的密码字段组、强度组和提交操作组拆为卡片的独立层级。字段组内部使用 `16px` 间距，卡片组间使用 Figma 的 `28px` 间距；标题组和字段标签行高也按实时节点的 `8px`/`normal` 约束覆盖。真实 token 校验、密码确认、提交和返回登录行为保持不变。

| 验收项 | 当前证据 |
|---|---|
| 桌面视口 | `1440×900`，DPR `1.0000000149011612`，页面宽度 `1440` |
| 卡片几何 | `x=490,y=166.2,w=460,h=567.6`；内容宽 `380px` |
| 输入几何 | 两个输入 `y=376.6/467.8px`，均为 `380×50px` |
| 强度/操作组 | 强度条 `y=571.8,h=6`；确认按钮组 `y=605.8,h=88` |
| Figma 参考 | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/reset-password-page-latest.png` |
| 浏览器 RGBA | `foodmate-ui/.qa/figma-pixel-acceptance/reset-password-page-browser-current-rgba.png` |
| PNG diff | `differentRatio=99.13426%`、`meanAbsoluteError=1.46441`、`RMSE=10.02255`，保持 `DIFF_REVIEW` |
| 行为回归 | `AuthPages.test.tsx`：`13/13`；`npm run typecheck` 通过；触及文件 Prettier 通过 |

- [x] 字段、强度条和提交操作已按 Figma 层级拆分，页面无横向溢出。
- [x] 前端保持空值密码输入和 token 缺失保护；真实模式仍调用既有 `confirmPasswordReset`，不伪造成功响应。
- [ ] 该画板仍不能标记 `PASS`：Figma 静态示例值与交互页面 placeholder 状态不同，自动 diff 和完整人工复核门槛尚未关闭。
- [ ] iconfont 实体资源继续为 `BLOCKED`，本轮未添加虚构字体包、Unicode 或 CSS 映射。

## 50. 2026-08-22 Token 状态页结构与资产对齐

本轮重新读取 Figma 节点 `680:738`、`680:757`、`680:776`，并按各自的 `error-card`、状态内容组和操作组重构 `/token-status?state=invalid|expired|used`。Figma 返回的真实 SVG 已登记到 `foodmate-ui/public/assets/figma/auth/`：品牌 fork-knife、错误三角、过期时钟和已使用信息图标。未创建虚构 iconfont glyph。

| 状态 | Figma 卡片 | 浏览器卡片 | 操作结构 | PNG diff |
|---|---|---|---|---|
| 无效 `680:738` | `x=490,y=242,w=460,h=416` | `x=490,y=242,w=460,h=416` | 重新发送 `380×52`；返回登录行 `380×25` | `differentRatio=99.99877%`，`MAE=14.14673`，`RMSE=25.36159`，`DIFF_REVIEW` |
| 过期 `680:757` | `x=490,y=242,w=460,h=416` | `x=490,y=242,w=460,h=416` | 重新发送 `380×52`；返回登录行 `380×25` | `differentRatio=99.99877%`，`MAE=14.18704`，`RMSE=25.47945`，`DIFF_REVIEW` |
| 已使用 `680:776` | `x=490,y=197,w=460,h=506` | `x=490,y=197,w=460,h=506` | 重新发送/联系客服均 `380×52`；返回登录行 `380×25` | `differentRatio=99.99414%`，`MAE=14.27139`，`RMSE=25.74397`，`DIFF_REVIEW` |

| 验收项 | 当前证据 |
|---|---|
| Figma 节点 | `680:738`、`680:757`、`680:776`；卡片内层均为 `380px` |
| 浏览器桌面 | `1440×900`、DPR `1.0000000149011612`、字体状态 `loaded`、三态 `scrollWidth=clientWidth=1440` |
| 浏览器移动 | `390×844`；三态 `scrollWidth=clientWidth=390`，所有图标均完成加载 |
| Figma PNG | `docxs/设计/figma-png/token-invalid.png`、`token-expired.png`、`token-used.png` |
| 浏览器 PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-invalid-browser.png`、`token-expired-browser.png`、`token-used-browser.png` |
| diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/figma-105-diff-results.json#token-invalid|token-expired|token-used` |
| 行为回归 | `TokenStatusPage.test.tsx` 与 `AuthPages.test.tsx`：`16/16`；`npm run typecheck`、目标文件 Prettier 和 `git diff --check` 通过 |

- [x] 品牌、状态内容、操作组已按 Figma 层级拆分；三态真实导航行为保持不变。
- [x] 使用 Figma 节点返回的真实 SVG 资产；标准按钮继续使用 shadcn `Button`。
- [ ] 三态仍不能标记 `PASS`：自动 diff 仍存在差异，完整 105 画板人工视觉复核也未关闭。
- [ ] iconfont 实体资源继续为 `BLOCKED`，本轮没有创建字体包、CSS/Unicode 映射或伪造许可证信息。

## 52. 2026-08-29 Token 无效页斜线边界收口

本轮重新读取 Figma 节点 `680:738` 的最新设计上下文和 `1440×900` PNG，并复测 `/token-status?state=invalid`。对照像素边界后确认 Figma 斜线在视口顶部的交点比共享认证背景多 `8px`；仅对 Token 页面覆盖层增加 `clip-path` 的 `calc(100% + 8px)`，没有改变登录、注册或其它认证状态，也没有修改 Figma。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点与视口 | `680:738`，`1440×900` |
| 页面几何 | 卡片 `x=490,y=241.8,w=460,h=416.4`；内层 `380px`；背景根节点 `1440×900` |
| Figma PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-invalid-figma-current-2026-08-29.png` |
| 浏览器 RGBA PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-invalid-browser-current-2026-08-29-rgba.png` |
| PNG diff | `differentPixels=661829`、差异比例 `51.0671%`、`MAE=0.437377`、`RMSE=2.339229`、最大通道差异 `154`；`DIFF_REVIEW` |
| 运行时 | `1440×900`、DPR `1.0000000149011612`、字体已加载、无横向溢出 |
| 回归 | Token/Auth/Workspace/Knowledge 定向测试 `38/38`；`npm run typecheck`、`npm run build`、`git diff --check` 通过 |
| 窗口装饰检查 | 前端左上角红黄绿装饰候选数量 `0`；业务状态圆点保持不变 |

- [x] Token 无效页背景斜线边界已按最新 Figma 像素测量收口。
- [x] 105 画板映射已更新为本轮 Figma/浏览器证据；聚合状态仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本页仍不能标记 `PASS`：自动 diff 仍存在文本、图标和浏览器光栅化差异；本轮不以视觉接近替代像素级通过。
- [ ] iconfont 实体资源继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 136. 2026-08-29 Token 已使用页当前证据收口

本轮重新读取 Figma 节点 `680:776` 并复测 `/token-status?state=used`。运行时确认该状态的两按钮操作组、信息图标状态层、卡片高度和已验证的共享斜线背景边界均符合当前设计稿结构；本轮没有新增源码改动，也没有修改 Figma。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点与视口 | `680:776`，`1440×900` |
| 页面几何 | 卡片 `x=490,y=196.6,w=460,h=506.8`；内层 `380px`；两个操作按钮均 `380×52px`，间距 `16px` |
| Figma PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-used-figma-current-2026-08-29.png` |
| 浏览器 RGBA PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-used-browser-current-2026-08-29-rgba.png` |
| PNG diff | `differentPixels=674374`、差异比例 `52.0350%`、`MAE=0.551200`、`RMSE=3.350627`、最大通道差异 `149`；`DIFF_REVIEW` |
| 独立 diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-used-current-diff-2026-08-29.json` |
| 运行时 | `1440×900`、DPR `1.0000000149011612`、字体已加载、无横向溢出 |
| 状态行为 | 重新发送进入 `/forgot-password`；联系客服入口保留；返回登录进入 `/login`；未伪造客服或邮件结果 |

- [x] Token 已使用页已完成最新设计稿读取、同尺寸浏览器截图、几何检查和 diff 登记。
- [x] `figma-105-mapping.json` 保留完整 105 项字段，并将本状态指向最新证据；聚合状态仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本页仍不能标记 `PASS`：自动 diff 仍存在文本、图标和浏览器光栅化差异；不能用视觉接近替代像素级通过。
- [ ] iconfont 实体资源继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 135. 2026-08-29 Token 过期页当前证据收口

本轮重新读取 Figma 节点 `680:757` 并复测 `/token-status?state=expired`。该状态与 Token 无效页共享认证壳层；运行时确认卡片和内层内容几何符合节点规格，已验证的 Token 页面斜线边界修正同时生效。本轮没有新增源码改动，也没有修改 Figma。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点与视口 | `680:757`，`1440×900` |
| 页面几何 | 卡片 `x=490,y=241.8,w=460,h=416.4`；内层 `380px`；背景根节点 `1440×900` |
| Figma PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-expired-figma-current-2026-08-29.png` |
| 浏览器 RGBA PNG | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-expired-browser-current-2026-08-29-rgba.png` |
| PNG diff | `differentPixels=661762`、差异比例 `51.0619%`、`MAE=0.446812`、`RMSE=2.399694`、最大通道差异 `154`；`DIFF_REVIEW` |
| 独立 diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/token-expired-current-diff-2026-08-29.json` |
| 运行时 | `1440×900`、DPR `1.0000000149011612`、字体已加载、无横向溢出 |
| 状态行为 | 重新发送重置邮件进入 `/forgot-password`；返回登录进入 `/login`；未伪造邮件投递结果 |

- [x] Token 过期页已完成最新设计稿读取、同尺寸浏览器截图、几何检查和 diff 登记。
- [x] `figma-105-mapping.json` 保留完整 105 项字段，并将本状态指向最新证据；聚合状态仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本页仍不能标记 `PASS`：自动 diff 仍存在文本、图标和浏览器光栅化差异；不能用视觉接近替代像素级通过。
- [ ] iconfont 实体资源继续为 `BLOCKED`；本轮没有创建虚构字体包、Unicode 或 CSS 映射。

## 51. 2026-08-23 餐食规划列表默认态卡片复核

本轮重新读取 Figma 节点 `692:2662`，并修正 `/planning?state=list` 前端 fixture 的默认展示规则。Figma 默认画板在“进行中”标签选中时仍同时呈现进行中、草稿和已归档三张计划卡；原实现只呈现进行中卡片，造成主内容区域与 Figma 不一致。当前实现默认展示三张卡，切换到“草稿箱”或“已归档”后继续按状态筛选；真实模式仍按服务端计划状态筛选。

| 验收项 | 当前证据 |
|---|---|
| Figma 节点与视口 | `692:2662`，`1440×1024` |
| 前端入口 | `/planning?state=list` |
| 浏览器检查 | 字体 `loaded`；三张计划卡、三种状态标签、进入计划和更多操作均存在；`document/body` 无横向溢出 |
| Figma 参考 | `docxs/设计/figma-png/meal-plan-list.png` |
| 浏览器 RGBA | `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-browser-current-rgba.png` |
| diff JSON | `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-current-diff.json`、`figma-105-diff-results.json#meal-plan-list` |
| PNG diff | `differentRatio=28.28437%`、`MAE=3.94548`、`RMSE=19.39610`，保持 `DIFF_REVIEW` |
| 行为回归 | `PlanningPage.test.tsx`：`8/8`；`npm run typecheck`、Prettier、`git diff --check` 通过 |

- [x] 本轮仅修改前端列表默认展示逻辑和对应测试；Figma 设计稿未修改。
- [x] 前端左上角红、黄、绿窗口装饰点检查结果为 `0`；业务状态圆点不属于窗口装饰点，继续保留。
- [ ] 该画板仍不能标记 `PASS`：卡片几何、内容密度、字体和图标光栅化仍存在差异；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`。
- [ ] iconfont 实体资源继续为 `BLOCKED`，本轮未创建虚构字体、Unicode 或 CSS 映射。

## 52. 2026-08-23 餐食规划列表菜单图标复核

- [x] Figma 节点 `692:2662` 的计划卡更多操作图标已重新核对为三条横线菜单图标；前端使用已存在的 Lucide `Menu`，不创建未经登记的 iconfont 资源。
- [x] `/planning?state=list` 浏览器复核确认三个计划卡的更多操作按钮均存在，`scrollWidth=1440`，无页面级横向溢出。
- [x] 当前证据继续使用 `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-browser-current-rgba.png`，独立 diff 为 `meal-plan-list-current-diff.json`；PNG diff 为 `28.3198% / MAE 3.9498 / RMSE 19.4020`，保持 `DIFF_REVIEW`。
- [ ] 该画板仍不能标记 `PASS`；剩余卡片几何、内容密度、字体与图标光栅化差异仍需后续逐项收口，iconfont 实体资源继续为 `BLOCKED`。

## 53. 2026-08-23 餐食规划列表顶部头像资源复核

- [x] 实时读取 Figma `692:2662` 的原始图片资产，确认顶部用户头像应使用 Figma 返回的男性肖像，而不是旧的渐变字标图；新增本地资源 `foodmate-ui/public/assets/figma/planning/meal-plan-list-topbar-avatar.png`。
- [x] `/planning?state=list` 浏览器实测顶部头像 `src` 为 `/assets/figma/planning/meal-plan-list-topbar-avatar.png`，图片加载完成；Figma 设计稿未修改，业务默认头像资源未改写。
- [x] 当前浏览器 RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-browser-current-rgba.png`，PNG diff 为 `28.3485% / MAE 3.9456 / RMSE 19.3731`，保持 `DIFF_REVIEW`。
- [ ] 卡片几何、内容密度、字体和图标光栅化仍需继续验收；iconfont 实体资源继续为 `BLOCKED`。

## 54. 2026-08-23 餐食规划列表排版尺寸复核

- [x] `/planning?state=list` 继续以 Figma 节点 `692:2662` 和 `1440×1024` 为唯一视觉依据，收紧列表副标题、新建按钮、Tab、计划日期的字号和行高。
- [x] 最新浏览器截图已完成字体加载和同尺寸转换，证据为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-browser-current-rgba.png`；页面几何检查保持通过，未发现横向溢出。
- [x] `scripts/png-diff.mjs` 最新结果：`differentPixels=411560`、差异比例 `27.9107%`、`MAE=3.8105`、`RMSE=18.9605`、最大通道差异 `255`；机器结果锚点为 `figma-105-diff-results.json#meal-plan-list`。
- [x] 排版调整后差异指标相较头像资源版本有所下降，但仍存在卡片几何、内容密度、字体和图标光栅化差异。
- [ ] 该画板继续保持 `DIFF_REVIEW`，不能因局部指标改善标记为像素级 `PASS`；iconfont 实体资源继续为 `BLOCKED`。

## 55. 2026-08-23 餐食规划列表顶部头像圆形裁切复核

- [x] 修正 WorkspaceLayout 顶部头像容器的裁切边界：头像保持 `32×32`、`border-radius: 50%`，并增加 `overflow: hidden`；侧栏头像和业务状态圆点未改变。
- [x] 在 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded` 的浏览器环境重新采集截图；Figma 设计稿未修改。
- [x] 浏览器实测顶部头像资源加载成功，容器 `overflow=hidden`，前端左上角红、黄、绿窗口装饰点数量仍为 `0`。
- [x] 最新 PNG diff：`differentPixels=411026`、差异比例 `27.8745%`、`MAE=3.8013`、`RMSE=18.9252`、最大通道差异 `235`；机器结果锚点为 `figma-105-diff-results.json#meal-plan-list`。
- [ ] 该画板继续保持 `DIFF_REVIEW`；本项只完成头像边界修正，不代表整页像素级通过、全量 shadcn 迁移或 iconfont 解阻塞。

## 56. 2026-08-23 餐食规划列表底部说明面板几何复核

- [x] 依据 Figma 节点 `692:2662` 回读值，将桌面端“计划卡片操作与状态”面板对齐到 `x=260、y=802、width=1116、height=222、bottom=1024`；面板原有颜色、圆角、内边距和文字内容保持不变。
- [x] 计划卡片区域仍保持 `x=292、width=1116`，仅修正底部说明面板相对右侧内容区的左边界、固定高度和底部贴合关系；移动端恢复原有自适应高度和边距。
- [x] 浏览器验收使用 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`；最新 PNG diff：`differentPixels=340303`、差异比例 `23.0783%`、`MAE=3.6995`、`RMSE=18.7132`、最大通道差异 `235`。
- [ ] 该画板仍为 `DIFF_REVIEW`，剩余卡片细节、字体和图标光栅化差异需要继续收口；本项不代表整页 `PASS` 或全量页面迁移完成。

## 57. 2026-08-23 餐食规划列表操作组间距复核

- [x] 依据 Figma 节点 `692:2761`、`692:2778`、`692:2795` 的操作组定义，将三个计划卡“进入计划”和菜单按钮之间的间距从 `12px` 修正为 `16px`；菜单按钮右边界保持不变。
- [x] 浏览器实测三个操作组均为 `gap=16px`，无横向溢出；视口为 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`。
- [x] 最新 PNG diff：`differentPixels=340784`、差异比例 `23.1109%`、`MAE=3.6961`、`RMSE=18.7010`、最大通道差异 `235`。差异比例局部重排后略升，但 MAE/RMSE 下降，且 `16px` 是 Figma 明确几何值，因此保留设计对齐结果。
- [ ] 该画板继续保持 `DIFF_REVIEW`；不能以单一差异比例替代 Figma 几何证据，也不能标记整页 `PASS`。

## 58. 2026-08-23 餐食规划列表信息标签样式复核

- [x] 依据 Figma 节点 `692:2758`、`692:2775`、`692:2792`，将计划卡“经济适用/优质食材/家庭量贩”标签从共享状态样式中拆出，修正为 `12px`、粗体、`#c79654` 前景和 `rgba(255,246,226,0.1)` 背景。
- [x] 说明面板固定高度下补充顶部内容对齐，保留 Figma 要求的 `gap=8px`，避免 CSS Grid 将空余高度分配到文字行之间。
- [x] 浏览器实测标签样式与说明面板几何：标签 `font-size=12px`、`font-weight=700`、面板 `x=260,y=802,width=1116,height=222`；视口 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`。
- [x] 最新 PNG diff：`differentPixels=384882`、差异比例 `26.1015%`、`MAE=3.8913`、`RMSE=19.4011`、最大通道差异 `234`。
- [ ] 该画板仍保持 `DIFF_REVIEW`；该项按 Figma 样式值完成，不能因整页 diff 未下降而回退到错误的绿色 `11px` 标签。

## 60. 2026-08-23 Intake Analysis 当前版本验收证据更新

- [x] 重新核对实时 Figma 节点 `640:773` 与 `/analysis?state=v2`；本轮 Figma 参考图改用当前文件导出的 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-v2-current.png`，不再使用缺少会话列表和数据质量面板的旧基线。
- [x] 浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-current.png`；视口 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`、页面无横向或纵向溢出、文字越界 `0`。
- [x] 当前版本几何复核记录：侧栏品牌区 `y=52`、新建任务 `y=104`、搜索框 `y=161`、工作台 `y=217`、Agent 对话 `y=259`；账户停靠区折叠条 `y=866,h=28`、状态条 `y=910,h=38`、用户资料 `y=964,h=36`；Figma fixture 顶栏品牌宽 `136px`、导航起点 `x=444`、导航间距 `16px`、搜索框高 `32px`、用户区宽 `84px`。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；仅保留用于 Figma 垂直布局对齐的空白占位，未修改 Figma 设计稿；其它圆形业务控件未按窗口装饰点处理。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=396008`、差异比例 `26.8560%`、`MAE=3.2500`、`RMSE=17.4654`、最大通道差异 `234`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；图标处理、字体光栅化和主体视觉处理仍有可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 61. 2026-08-23 Meal Planning 当前版本验收证据更新

- [x] `640:901` `/planning?state=v2` 已使用当前 Figma 截图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/meal-planning-v2-current.png`，浏览器证据为同尺寸 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-browser-current-rgba.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出；默认目标文案为 `2,400千卡`，购物清单复选框为独立 `14×14px` 控件。
- [x] 前端左上角红、黄、绿窗口装饰点检查结果为 `0`，因此没有对应代码需要删除；首页活跃会话中的 `sessionDot` 属于业务状态指示器，不属于窗口装饰点，保留不变；Figma 设计稿未修改。
- [x] 当前 PNG diff：差异比例 `23.8253%`、`MAE=3.0472`、`RMSE=16.8015`、最大通道差异 `234`；机器结果锚点为 `figma-105-diff-results.json#meal-planning-v2`。
- [ ] 本页继续保持 `DIFF_REVIEW`；计划工具栏、导航、餐卡几何、字体和内容密度仍存在视觉差异，不能标记 `PASS`。

## 62. 2026-08-23 Agent Clarification 当前版本验收证据更新

- [x] `687:642` `/chat?state=awaiting-clarification` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-awaiting-clarification-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-awaiting-clarification-browser-current-rgba.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出；澄清选项文案与实时 Figma 完全一致：`补充食物和份量`、`上传照片识别`。
- [x] 前端左上角红、黄、绿窗口装饰点检查结果为 `0`；当前实现保留 Figma 所需的顶部空白布局占位，不包含窗口装饰点；Figma 设计稿未修改。
- [x] 当前 PNG diff：差异比例 `15.4844%`、`MAE=1.8229`、`RMSE=12.9095`、最大通道差异 `251`；机器结果锚点为 `figma-105-diff-results.json#agent-awaiting-clarification`。
- [ ] 本页继续保持 `DIFF_REVIEW`；剩余差异主要来自头像处理及字体/图标光栅化，不能标记 `PASS`。

## 63. 2026-08-23 Agent Write Confirmation 当前画板证据复核

- [x] `687:773` `/chat?state=write-confirmation` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-write-confirmation-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-write-confirmation-browser-current.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；写入目标、日期、食物、热量、蛋白质、来源、估算假设和确认/取消操作均存在。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；当前实现没有对应窗口装饰点，Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=379283`、差异比例 `25.7218%`、`MAE=2.9444`、`RMSE=16.2155`、最大通道差异 `237`；机器结果锚点为 `figma-105-diff-results.json#agent-write-confirmation`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；卡片几何、边框、操作样式、头像和字体/图标光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 64. 2026-08-23 Agent Budget Limit 当前画板证据复核

- [x] `687:918` `/chat?state=budget-limit` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-budget-limit-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-budget-limit-browser-current.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；`50,000 tokens`、`100%`、预计费用、追加预算和结束会话均存在。
- [x] 点击“追加 20,000 tokens”后的状态为“fixture 已记录追加预算动作，当前 Run 不会被伪造为新会话。”；真实模式继续使用既有预算追加接口，结束动作继续使用既有取消接口。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=373778`、差异比例 `25.3484%`、`MAE=3.7123`、`RMSE=18.7204`、最大通道差异 `240`；机器结果锚点为 `figma-105-diff-results.json#agent-budget-limit`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；卡片几何、状态色、头像和字体/图标光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 65. 2026-08-23 Agent Tool Failed Retryable 当前画板证据复核

- [x] `687:1439` `/chat?state=tool-failed-retryable` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-tool-failed-retryable-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-tool-failed-retryable-browser-current.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；工具超时、外部知识库不可用、错误码 `TOOL_TIMEOUT_001`、重试和跳过动作均存在。
- [x] 重试动作在 fixture 中只记录等待新工具事件；真实模式继续调用既有运行恢复接口，不把前端动作伪造成成功结果；跳过动作明确记录后续结果数据范围受限。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=319638`、差异比例 `21.6768%`、`MAE=3.0042`、`RMSE=15.9168`、最大通道差异 `245`；机器结果锚点为 `figma-105-diff-results.json#agent-tool-failed-retryable`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；告警卡几何、颜色、头像和字体/图标光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 66. 2026-08-23 Agent Safety Degraded 当前画板证据复核

- [x] `687:1563` `/chat?state=safety-degraded` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-safety-degraded-current.png`；浏览器原始截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-safety-degraded-browser-current.png`，用于 diff 的 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-safety-degraded-browser-current-rgba.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；安全降级警告、有限数据说明、个人高血压条件未完整应用提示和追问入口均存在。
- [x] 追问输入保持可用；页面明确说明结果基于有限数据，未把降级结果包装成完整分析或完整引用。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；Figma 设计稿未修改。
- [x] 本次按 Figma 结构完成安全降级局部对齐：警告卡使用 `⚠️ 安全降级提示` 文本层级，助手状态标签、`560×58` 警告卡、`560×125.1` 回答卡、灰色受限说明和 `Fustat-v2 Agent · 1:31 PM` 时间戳均已复核；用户消息时间为 `Anddy · 01:30 PM`。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=292529`、差异比例 `19.8383925%`、`MAE=2.9192213`、`RMSE=16.6107335`、最大通道差异 `249`；机器结果锚点为 `figma-105-diff-results.json#agent-safety-degraded`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；周边工作区、头像和字体/图标光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 67. 2026-08-23 Agent User Cancelled 当前画板证据复核

- [x] `687:1684` `/chat?state=user-cancelled` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-user-cancelled-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-browser-current.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；已接收部分文本、用户取消原因和重新开始入口均存在。
- [x] 运行时检查确认页面没有“运行失败”文案；重新开始动作显示“已准备重新开始；真实运行需要由后端创建新的 Run。”，未伪造新的运行结果。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=272934`、差异比例 `18.5095%`、`MAE=2.3318`、`RMSE=14.4348`、最大通道差异 `235`；机器结果锚点为 `figma-105-diff-results.json#agent-user-cancelled`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；取消后操作布局、头像和字体/图标光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 68. 2026-08-23 Agent SSE Reconnecting 当前画板证据复核

- [x] `687:1803` `/chat?state=sse-reconnecting` 已重新读取实时 Figma 画板并保存当前参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-sse-reconnecting-current.png`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-browser-current.png`。
- [x] 浏览器运行时实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`、`document` 和 `body` 均无横向溢出、文字越界 `0`；“第 2 次重连尝试 (最多 5 次)”和刷新提示均存在。
- [x] Composer 在重连期间保持禁用，已显示的查询文本保留；真实 SSE 使用 `Last-Event-ID` 和 `sse_event_id` 去重，终态完成/失败/取消/取代后关闭连接，达到上限进入稳定错误状态。
- [x] 前端左上角红、黄、绿窗口装饰点数量为 `0`；Figma 设计稿未修改。
- [x] 本次按 Figma 收口重连状态结构：补齐 Agent 头像、`560px` 回答气泡、`1132×66px` 全宽重连提示带，并使用已登记的 Figma loader SVG；前端左上角窗口装饰点仍为 `0`，Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=388529`、差异比例 `26.3488%`、`MAE=2.6880`、`RMSE=15.2945`、最大通道差异 `244`；机器结果锚点为 `figma-105-diff-results.json#agent-sse-reconnecting`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；工作区壳层、头像和字体光栅化仍存在可见差异。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 UNMAPPED / 0 SIZE_MISMATCH / 0 PASS`，iconfont 继续为 `BLOCKED`。

## 69. 2026-08-23 摄入分析错误态当前画板收口

- [x] `692:2139` `/analysis?state=error` 已重新读取当前 Figma 画板，并保存 `recaptured-figma/intake-analysis-error-current.png`；浏览器证据为 `recaptured/intake-analysis-error-browser-current.jpg` 和 RGBA 归一化 PNG。
- [x] 页面错误态不再显示 Figma 未包含的“自定义范围”和“全部餐次”控件；筛选容器收口为内容宽度，错误卡片高度、内部间距、重载按钮高度和警告色按当前 Figma 结构调整。
- [x] 浏览器实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`、根节点无横向溢出、文字越界 `0`；前端左上角红黄绿窗口装饰点仍为 `0`，Figma 设计稿未修改。
- [x] `scripts/png-diff.mjs` 同尺寸结果：`differentPixels=177158`、差异比例 `12.0143%`、`MAE=1.5468`、`RMSE=12.2186`、最大通道差异 `230`；独立结果见 `intake-analysis-error-current-diff.json`。
- [ ] 本页继续保持 `DIFF_REVIEW`，剩余差异主要为头像、侧栏/图标光栅化和字体渲染；不能标记像素级 `PASS`。iconfont 继续为 `BLOCKED`。

## 70. 2026-08-23 摄入分析加载态指标骨架对齐

- [x] 实时读取 Figma 节点 `692:1901`，前端入口为 `/analysis?state=loading`；Figma 参考图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-loading-current.png`。
- [x] 按 Figma 结构新增 loading 专用指标区域：三张卡均为 `126px` 高，卡内保持 `20px` padding、`12px` 间距、`32px` 主骨架和 `16px` 详情骨架；普通分析指标卡不受影响。
- [x] 浏览器实测三张指标卡均为 `126px` 高，指标容器为 `1116×126px`；视口为 `1440×1024`，字体加载完成，页面无横向溢出。
- [x] 浏览器原始截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-loading-browser-current.jpg`，RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-loading-browser-current-rgba.png`。
- [x] `scripts/png-diff.mjs` 同尺寸结果：`differentPixels=447209`、差异比例 `30.3283%`、`MAE=2.2087`、`RMSE=12.5071`、最大通道差异 `230`；结果锚点为 `figma-105-diff-results.json#intake-analysis-loading`，独立结果为 `intake-analysis-loading-current-diff.json`。
- [x] `AnalysisPage.test.tsx` loading/error/empty 定向测试 `4/4`，`npm run typecheck` 和 `git diff --check` 通过。
- [ ] 本页继续保持 `DIFF_REVIEW`，剩余导航上下文、头像、字体和图标光栅化差异不能被本次 loading 骨架对齐覆盖；不能标记 `PASS`。
- [ ] iconfont 实体包、CSS/Unicode 映射、来源和许可证仍为 `BLOCKED`；Figma 设计稿未修改，前端左上角红黄绿窗口装饰点仍为 `0`，业务状态圆点保留。

## 71. 2026-08-23 摄入分析空态图标资源对齐

- [x] 实时读取 Figma 节点 `692:2026`，前端入口为 `/analysis?state=empty`；当前 Figma 参考图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-empty-current.png`。
- [x] 空态图表区继续保持 Figma 的 `60px` padding、`64px` 图标容器、`20px` 内容间距、标题/说明/操作层级；空态图标改为 Figma 节点返回的真实 SVG `public/assets/figma/analysis/intake-analysis-empty-chart-column.svg`。
- [x] 浏览器实测空态图表卡为 `1116px` 宽、内容区域为 `1066.4×320px`，视口为 `1440×1024`，页面无横向溢出；浏览器原始截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-empty-browser-current.jpg`，RGBA 证据已生成。
- [x] `scripts/png-diff.mjs` 同尺寸结果：`differentPixels=274336`、差异比例 `18.6046%`、`MAE=2.4987`、`RMSE=15.8118`、最大通道差异 `237`；结果锚点为 `figma-105-diff-results.json#intake-analysis-empty`，独立结果为 `intake-analysis-empty-current-diff.json`。
- [x] `AnalysisPage.test.tsx` 定向测试 `4/4`，新增真实 Figma 图标资源路径断言；`npm run typecheck`、Prettier 和 `git diff --check` 通过。
- [ ] 本页继续保持 `DIFF_REVIEW`，剩余头像、字体和图标/浏览器光栅化差异不能标记 `PASS`；iconfont 实体资源继续为 `BLOCKED`。

## 72. 2026-08-23 餐食规划列表操作按钮高度复核

- [x] 依据 Figma 节点 `692:2762`、`692:2779`、`692:2796` 的 `px=14、py=8、36px` 操作 frame，将三个“进入计划”按钮显式设为 `height=36px`，覆盖 shadcn 默认 `h-10`，菜单按钮保持 `36px`。
- [x] 浏览器实测三个操作组的按钮均为 `36×81.6px`，菜单按钮均为 `36×36px`，共同垂直居中且间距保持 `16px`；页面无横向溢出。
- [x] 最新 PNG diff：`differentPixels=384908`、差异比例 `26.1032%`、`MAE=3.8917`、`RMSE=19.4005`、最大通道差异 `234`。
- [ ] 该画板继续保持 `DIFF_REVIEW`；本项完成按钮 frame 几何对齐，不代表整页像素级 `PASS`。

## 73. 2026-08-23 餐食规划列表更新时间文本行高复核

- [x] 依据 Figma 节点 `692:2760`、`692:2777`、`692:2794`，将三个“最后修改”文本保持为 `12px`、`font-weight=400`、`line-height=normal`、`#6b7280`，不再沿用 `1.3` 的共享行高。
- [x] 浏览器实测首张计划卡更新时间文本为 `12px / 400 / normal`，高度 `16.8px`；卡片操作按钮仍为 `36px`，页面无横向溢出。
- [x] 最新 PNG diff：`differentPixels=384990`、差异比例 `26.1088%`、`MAE=3.8937`、`RMSE=19.4070`、最大通道差异 `234`。
- [ ] 该画板继续保持 `DIFF_REVIEW`；本项只完成 Figma 指定的更新时间文本行高，不代表整页像素级 `PASS`。

## 74. 2026-08-23 餐食规划列表说明面板字体排版复核

- [x] 依据 Figma 节点 `976:3` 至 `976:8`，将说明面板字体入口调整为 `Noto Sans SC`；标题行盒为 `22px`，普通说明和绿色操作行盒为 `18px`，灰色辅助行也固定为 `18px`。
- [x] 浏览器实测面板外框仍为 `x=260,y=802,width=1116,height=222`，五个文字行保持顶部堆叠和 `8px` 间距；视口 `1440×1024`、字体 `loaded`、无横向溢出。
- [x] 最新 PNG diff：`differentPixels=384960`、差异比例 `26.1068%`、`MAE=3.8953`、`RMSE=19.4073`、最大通道差异 `234`。
- [ ] 该画板继续保持 `DIFF_REVIEW`；本项只完成说明面板字体和行盒对齐，不代表整页像素级 `PASS`。

## 75. 2026-08-23 餐食规划列表状态徽章文字复核

- [x] 依据 Figma 节点 `692:2753`、`692:2770`、`692:2787`，将三个状态徽章文字设为 `11px`、`font-weight=700`、`line-height=normal`；背景色和语义颜色保持进行中/草稿/已归档的独立值。
- [x] 浏览器实测三个状态徽章均为 `24px` 高、`11px` 粗体，页面视口 `1440×1024`、字体 `loaded`、无横向溢出。
- [x] 最新 PNG diff：`differentPixels=412502`、差异比例 `27.9746%`、`MAE=4.0662`、`RMSE=19.9112`、最大通道差异 `236`。
- [ ] 该画板继续保持 `DIFF_REVIEW`；本项按 Figma 文字行盒完成，不代表整页像素级 `PASS`。

## 76. 2026-08-23 餐食规划列表新建按钮文案结构对齐

- [x] 重新读取 Figma 节点 `692:2739/2740`，确认顶部操作是单一文本节点 `+ 新建膳食计划`，不是图标与文本的组合。
- [x] `/planning?state=list` 已移除该按钮中的 Lucide `Plus`，改为 Figma 对应的连续文案；真实导航仍进入 `wizard-step1`，真实模式测试已同步新的可访问名称。
- [x] 浏览器实测按钮名称为 `+ 新建膳食计划`，旧名称不存在；视口为 `1440×1024`，字体为 `loaded`，页面无横向溢出。
- [x] 前端左上角红、黄、绿窗口装饰点仍为 `0`，因此没有删除任何无关业务圆点；Figma 设计稿未修改。
- [x] 最新同尺寸 PNG diff：`differentPixels=411835`、差异比例 `27.9293%`、`MAE=4.0463`、`RMSE=19.8687`、最大通道差异 `236`；结果已写入 `meal-plan-list-current-diff.json` 和 `figma-105-diff-results.json#meal-plan-list`。
- [ ] 本次 in-app 浏览器实际 DPR 为 `1.25`，DPR 1 门禁未通过；同时卡片几何、内容密度、字体与图标光栅化仍有差异，画板继续保持 `DIFF_REVIEW`，不能标记 `PASS`。

## 77. 2026-08-23 餐食规划列表计划卡水平布局对齐

- [x] 依据 Figma 节点 `692:2749`、`692:2750` 和 `692:2761`，确认计划卡内容列宽 `936px`、操作组从卡片内部 `x=960` 开始，卡片容器不设置额外 flex gap。
- [x] 前端移除 `.planListCard` 的额外 `gap:24px`；浏览器实测内容列由 `908.8px` 增至 `932.8px`，操作组仍保持右侧对齐，卡片宽度 `1116px` 不变。
- [x] 本次调整后的截图与前一证据 SHA-256 相同，PNG diff 如实保持 `27.9293% / MAE 4.0463 / RMSE 19.8687`；未用无变化的 diff 数字冒充像素改善。
- [ ] 计划卡垂直行盒和总高度仍需后续按 Figma `133px` 卡片节点继续收口；当前画板保持 `DIFF_REVIEW`，DPR 1 门禁仍未通过，不能标记 `PASS`。

## 78. 2026-08-23 餐食规划列表计划卡文字行盒对齐

- [x] 依据 Figma `692:2750`、`692:2751`、`692:2756`、`692:2757` 和状态/标签子节点，将计划卡标题行、状态徽章、日期、详情、信息标签和更新时间分别收口到 `22px / 21px / 16px / 17px / 22px / 14px`。
- [x] 浏览器实测计划卡主列高度为 `85px`，与 Figma `692:2750` 的 `85px` 一致；三张卡文字行盒均无溢出，页面无横向溢出。
- [x] 最新同尺寸 PNG diff：`differentPixels=347138`、差异比例 `23.5418%`、`MAE=3.5356`、`RMSE=18.2830`、最大通道差异 `234`；结果已更新到 `meal-plan-list-current-diff.json` 和 `figma-105-diff-results.json#meal-plan-list`。
- [ ] 卡片总高度当前为 `134.6px`，Figma 节点为 `133px`，剩余约 `1.6px` 来自边框布局处理；画板继续 `DIFF_REVIEW`，不能标记 `PASS`。

## 79. 2026-08-23 餐食规划列表计划卡高度与边框对齐

- [x] 依据 Figma 计划卡节点 `692:2749`、`692:2766`、`692:2783` 的 `1116×133px` 规格，将前端计划卡的 1px 外边框改为等效 `inset` 描边，避免边框从 `24px` 内边距布局中额外扣除高度。
- [x] 浏览器实测三张计划卡均为 `1116×133px`，主内容列为 `85px`，列表卡片 y 坐标为 `244.6 / 393.6 / 542.6`，卡片间距保持 `16px`。
- [x] 最新同尺寸 PNG diff：`differentPixels=338673`、差异比例 `22.9677%`、`MAE=3.2275`、`RMSE=17.1978`、最大通道差异 `234`；结果已更新到当前列表 diff 和 105 画板汇总。
- [ ] 该项只关闭计划卡高度和边框布局差异；顶部壳层、操作按钮宽度、字体/图标光栅化等差异仍在，画板继续 `DIFF_REVIEW`，不能标记 `PASS`。

## 80. 2026-08-23 餐食规划列表操作按钮尺寸复核

- [x] 重新读取 Figma 节点 `692:2762`，确认“进入计划”按钮为 `80×32px`；操作组节点 `692:2761` 为 `132×36px`，菜单按钮为 `36×36px`。
- [x] 前端计划卡按钮已固定为 `80×32px`，浏览器实测三个按钮均为 `80×32px`，操作组均为 `132×36px`，三张计划卡仍为 `1116×133px`。
- [x] 浏览器证据视口为 `1440×1024`、字体 `loaded`、无横向溢出；前端左上角红黄绿窗口装饰点与窗口占位均为 `0`，Figma 设计稿未修改，业务状态圆点保留。
- [x] 最新同尺寸 PNG diff：`differentPixels=545675`、差异比例 `37.0059%`、`MAE=4.4041`、`RMSE=20.9698`、最大通道差异 `245`；证据为 `meal-plan-list-browser-current-rgba.png` 和 `meal-plan-list-current-diff.json`，汇总锚点为 `figma-105-diff-results.json#meal-plan-list`。
- [ ] 本项继续保持 `DIFF_REVIEW`，不代表整页像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。

## 81. 2026-08-23 个人中心账号注销成功与失败状态复核

- [x] Figma 节点 `795:499` `/profile?state=privacy-deletion-success` 已补齐成功卡：桌面 `560×250`、移动 `358.4×250`，保留绿色成功语义、request ID、关闭动作且不显示进度条；最新 diff 为 `42.1501% / MAE 3.2028 / RMSE 13.9386`。
- [x] Figma 节点 `795:642` `/profile?state=privacy-deletion-failed` 已补齐失败卡：桌面 `600×280`、移动 `358.4×280`，保留红色错误码、request ID、“重新创建注销请求”动作且不显示进度条；最新 diff 为 `34.1727% / MAE 2.6096 / RMSE 14.4439`。
- [x] 两个状态均在 `1440×1024` 和 `390×844` 实测，字体加载完成，根节点无滚动溢出，失败态和成功态的卡片/操作按钮均未发生文字重叠；前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点未删除，Figma 设计稿未修改。
- [x] 证据已登记到 `foodmate-ui/.qa/figma-pixel-acceptance/` 的当前桌面/移动 PNG、RGBA PNG、独立 diff JSON、`figma-105-mapping.json` 和 `figma-105-diff-results.json`。
- [x] `ProfilePage.test.tsx` 定向测试 `20/20`、`npm run typecheck`、本次文件 Prettier 检查和 `git diff --check` 通过。
- [ ] 两个状态继续保持 `DIFF_REVIEW`；整页壳层、字体和浏览器光栅化差异仍未满足像素级 `PASS`，105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。

## 82. 2026-08-23 摄入分析错误态侧栏图标与窗口装饰复核

- [x] 依据 Figma 节点 `692:2139`，仅在 Figma fixture 壳层将侧栏导航图标统一为 `16×16px`，`Agent 对话` 标题图标同步为 `16×16px`；普通页面未受影响。
- [x] `/analysis?state=error` 实测视口为 `1440×1024`、DPR `1.0000000149011612`、字体已加载、根节点无横向溢出；前端左上角红黄绿窗口装饰点为 `0`，Figma 设计稿未修改，业务状态圆点保留。
- [x] 最新同尺寸 PNG diff：`differentPixels=177280`、差异比例 `12.0226%`、`MAE=1.2604`、`RMSE=10.4082`、最大通道差异 `230`；结果已写入 `intake-analysis-error-current-diff.json` 与 `figma-105-diff-results.json#intake-analysis-error`。
- [ ] 该画板仍保持 `DIFF_REVIEW`，不能标记像素级 `PASS`；剩余差异包括头像、图标和字体光栅化，105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 83. 2026-08-23 摄入分析空态指标卡高度对齐

- [x] 重新读取 Figma 节点 `692:2026`，确认三张空态指标卡目标高度为 `100px`；前端仅对 Figma fixture 的分析区域增加作用域，将指标容器和三张卡从 `107px` 对齐为 `100px`，真实模式和其他分析状态不受影响。
- [x] 浏览器实测三张指标卡均为 `100px`，图表卡从原 `y=295px` 调整为 `y=288px`，与 Figma `692:2129` 的位置一致；页面 `1440×1024` 无横向溢出，当前前端没有左上角红黄绿窗口装饰点，业务状态圆点保留，Figma 设计稿未修改。
- [x] 当前浏览器截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-empty-browser-2026-08-23.jpg`，RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-empty-browser-current-rgba.png`；同尺寸 diff 为 `16.6444% / MAE 1.8523 / RMSE 13.0926 / maxChannelDelta 233`，已同步独立 diff 和 `figma-105-diff-results.json#intake-analysis-empty`。
- [x] `AnalysisPage.test.tsx` 定向测试 `4/4`、`npm run typecheck`、构建、目标文件 Prettier 和 `git diff --check` 通过。
- [ ] 该画板继续保持 `DIFF_REVIEW`：图表空态区域当前仍为 `320px` 高，Figma 目标为 `308px`；当前 in-app 浏览器 DPR 为 `1.25`，不能关闭 DPR 1 门禁，也不能标记像素级 `PASS`。iconfont 继续为 `BLOCKED`。

## 84. 2026-08-23 摄入分析空态图表区域高度与内容几何对齐

- [x] 重新读取 Figma 节点 `692:2026` 与子节点 `692:2129`、`692:2131`、`692:2132`、`692:2134`、`692:2137`，确认图表卡从全局 `y=288px` 开始，空态区域为 `1066×308px`，内边距 `60px`，图标 `64×64px`，说明组 `47px`，操作按钮 `118×37px`，两处内容间距均为 `20px`。
- [x] 前端仅在空态区域将说明正文行高调整为 `17px`、记录按钮调整为 `37px`，使 `.emptyChartArea` 的实际浏览器盒从 `314px` 收口到 Figma 的 `308px`；真实分析模式、错误态和业务状态圆点未改变。
- [x] 内置浏览器端点本轮不可用，使用 Chromium headless fallback 固定 `1440×1024`、DPR `1`、字体 `loaded` 完成复核；空态区域实测 `1066×308px`，页面无横向溢出，前端左上角红黄绿窗口装饰候选为 `0`，Figma 设计稿未修改。
- [x] 新截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-empty-browser-308-final.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=82885`、差异比例 `5.6210%`、`MAE=1.5111`、`RMSE=13.0804`、最大通道差异 `204`，结果已同步到独立 diff、`figma-105-mapping.json` 和 `figma-105-diff-results.json#intake-analysis-empty`。
- [x] `AnalysisPage.test.tsx` 定向测试 `4/4`、`npm run typecheck`、`npm run build`、目标 CSS Prettier 检查和 `git diff --check` 均通过。
- [ ] 该画板仍保持 `DIFF_REVIEW`，剩余头像、字体和光栅化差异不满足像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 85. 2026-08-23 摄入分析空态图表卡外框盒模型对齐

- [x] 重新读取 Figma 节点 `692:2129` 与 `692:2131`，确认外层图表卡为 `1116×391px`，内部空态区域为 `1068×308px`；Figma 的 1px 描边不改变这两个布局尺寸。
- [x] 前端仅将 `.emptyChartCard` 的外描边改为等效 `inset` 描边，保留边框视觉但不让 CSS border 占用内容盒；`.errorCard` 明确保留原有 border，避免错误态发生范围外变化。
- [x] 浏览器实测图表卡为 `1116×391px`，空态区域为 `1068×308px`，字体为 `loaded`，页面无横向溢出；前端左上角红黄绿窗口装饰候选为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 新截图为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-empty-browser-chart-card-fixed.png`；独立 diff 为 `14.7590% / MAE 1.4407 / RMSE 11.4045 / 最大通道差异 233`，结果登记在 `intake-analysis-empty-chart-card-fixed-diff.json` 和 `figma-105-diff-results.json#intake-analysis-empty`。
- [ ] 当前浏览器 DPR 为 `1.25`，DPR 1 门禁未通过；该画板继续保持 `DIFF_REVIEW`，不标记像素级 `PASS`，105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。

## 86. 2026-08-23 Chat 历史第 2 页助手字体对齐

- [x] 重新读取 Figma 节点 `740:212`，确认助手回答容器为 `560px`、正文使用 `Space Mono` `14px`、行高 `1.5`；没有扩大消息容器，也没有改动 Figma 画板。
- [x] 前端移除 `.designChatPage .assistant .messageText` 对 Figma 等宽正文的错误 UI 字体覆盖，恢复 `var(--fm-font-mono)`；左上角红、黄、绿窗口装饰点仍为 `0`，业务状态圆点保留。
- [x] `1440×1024`、DPR `1.0000000149011612`、字体加载完成、根节点无溢出；助手正文实际为 `Space Mono / 14px / 21px`，消息宽度 `560px`，分页实际为 `212×22px`。
- [x] 新浏览器 RGBA 证据为 `agent-chat-history-page-2-browser-2026-08-23-space-mono-rgba.png`，独立 diff 为 `33.97210% / MAE 4.14712 / RMSE 19.36440`，并已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json#agent-chat-history-page-2`。
- [x] `ChatPage.test.tsx` 定向测试 `25/25`、`npm run typecheck`、`npm run build`、目标 CSS Prettier 检查和 `git diff --check` 通过。
- [ ] 该画板仍保持 `DIFF_REVIEW`；字体差异已收口但整页壳层、头像、图标和光栅化差异仍未满足像素级 `PASS`，iconfont 继续为 `BLOCKED`。

## 87. 2026-08-23 Chat 历史第 3 页助手字体与证据更新

- [x] 重新读取 Figma 节点 `740:426`，确认历史第 3 页与第 2 页共用 `Space Mono` `14px`、`21px` 行高的助手正文规格；前端继续只移除左上角红、黄、绿窗口装饰点，不修改 Figma 画板。
- [x] `/chat?state=history-page-3` 已在 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded` 的视口重新采集；页面无根节点溢出，前端左上角窗口装饰候选为 `0`，业务状态圆点保留。
- [x] 新浏览器 PNG 证据为 `agent-chat-history-page-3-browser-2026-08-23-space-mono-rgba.png`；`scripts/png-diff.mjs` 结果为差异比例 `33.97210%`、`MAE=4.14716`、`RMSE=19.36452`、最大通道差异 `255`，已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json#agent-chat-history-page-3`。
- [x] Chat 定向测试 `25/25` 已在相同字体修正后通过；本项保留 `DIFF_REVIEW`，没有将自动 diff 误标记为像素级 `PASS`。
- [ ] 整页壳层、头像、图标和浏览器光栅化差异仍需后续收口；iconfont 实体资源继续为 `BLOCKED`。

## 88. 2026-08-23 Chat 搜索结果页内容与控件对齐

- [x] 重新读取 Figma 节点 `742:212`，确认搜索状态包含 `高蛋白` 查询、8 条会话结果，并且 Figma fixture 搜索框不显示清除 `X` 控件。
- [x] 前端搜索 fixture 已补齐 8 条结果：`蛋白质补充方案`、`高蛋白早餐建议`、`晚餐蛋白质补充`、重复历史结果、`睡前加餐建议`、`早餐碳水搭配`、重复晚餐结果和`低碳水饮食建议`；只在 `designChat` fixture 中隐藏清除控件，真实/普通布局仍保留清除搜索能力。
- [x] 浏览器实测 `/chat?state=search-results` 为 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`、8 条结果、查询值 `高蛋白`、清除按钮 `0`、前端左上角窗口控制点 `0`；业务状态圆点保留，Figma 画板未修改。
- [x] 新浏览器 PNG 证据为 `agent-chat-search-results-browser-2026-08-23-space-mono-rgba.png`；`scripts/png-diff.mjs` 结果为差异比例 `33.98051%`、`MAE=4.15039`、`RMSE=19.39200`、最大通道差异 `255`，已同步 `figma-105-mapping.json`、`figma-105-diff-results.json#agent-chat-search-results` 和独立 diff JSON。
- [x] `ChatPage.test.tsx` 与 `WorkspaceLayout.test.tsx` 定向测试 `28/28`，相关 TypeScript/TSX Prettier 检查通过。
- [ ] 该画板继续保持 `DIFF_REVIEW`；整页壳层、头像、图标和光栅化差异仍未满足像素级 `PASS`，iconfont 继续为 `BLOCKED`。

## 10. 本轮餐食规划空态实时验收

2026-08-23 重新从实时 Figma 节点 `692:2446` 获取 `1440×1024` PNG。仓库中较早的 `docxs/设计/figma-png/meal-planning-empty.png` 与当前实时文件不是同一版基线，本轮不使用旧 PNG 作为该画板的最新差异依据；实时证据登记为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-planning-empty-figma-live.png`。

| 项目 | 结果 |
|---|---|
| 前端入口 | `/planning?state=empty` |
| 卡片几何 | `x=590,y=340,width=520,height=368` |
| Figma 子节点对应 | 图标 `100×100`、文案组 `424×82`、按钮 `192×42`、提示行 `412×16` |
| 浏览器证据 | `meal-planning-empty-browser-current.jpg` / `meal-planning-empty-browser-current.png` |
| 视口 / DPR | `1440×1024` / `1.0000000149011612` |
| 页面溢出 | `body.scrollWidth <= innerWidth`，通过 |
| 前端左上角窗口装饰点 | `0`；Figma 设计稿未修改，业务状态圆点保留 |
| PNG diff | `13.2758% / MAE 1.2768 / RMSE 10.0411 / maxChannelDelta 244` |
| 结论 | `DIFF_REVIEW` |

本轮只调整前端空态卡片结构、间距、按钮图标容器和提示信息图标；真实计划接口、Figma 文件、iconfont 资源和其它页面不在本次修改范围。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。

## 11. 2026-08-26 餐食规划 Loading 实时 Figma 几何收口

- [x] 重新读取实时 Figma 节点 `692:2256` 和完整截图；确认画板为 `1440×1024`，主计划区为 `840px`、右栏为 `340px`，loading banner 为 `776×102px`，日期骨架卡为 `123.2×40px`，餐食骨架卡为 `123.2×74px`，右栏约束行分别为 `292×44px`。
- [x] 前端 `/planning?state=loading` 只调整 loading fixture：摘要、日期骨架卡、餐食骨架条、右栏约束骨架、购物清单骨架的颜色、尺寸、间距和渐变均按实时节点回读值实现；真实计划加载和接口逻辑未改变。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体已加载、页面无横向溢出；主区/右栏关键坐标与 Figma 对齐。前端左上角红黄绿窗口控制点检测为 `0`，没有删除会话状态点、购物清单复选框或其它业务圆点；Figma 设计稿未修改。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-planning-loading-figma-live-2026-08-26.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-loading-browser-radius-2026-08-28.jpg` 和 RGBA PNG；同尺寸 `scripts/png-diff.mjs` 结果为差异比例 `18.0048%`、`MAE=1.15954`、`RMSE=9.74272`、最大通道差异 `232`，已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json#meal-planning-loading`。
- [x] `PlanningPage.test.tsx` 定向测试 `9/9`、`npm run format:check` 和 `git diff --check` 通过；本次代码改动已由提交 `686bb9e` 独立提交。
- [ ] 该画板继续保持 `DIFF_REVIEW`，剩余整页壳层、头像、图标、字体和光栅化差异不满足像素级 `PASS`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 104. 2026-08-28 Meal Planning Loading 骨架圆角收口

- [x] 根据实时 Figma 节点 `692:2256` 的子节点 `692:2341`、`692:2346` 和 `692:2347`，将前端 Loading 标题骨架圆角从 `4px` 修正为 `6px`，两个顶部操作骨架圆角从 `4px` 修正为 `12px`。
- [x] 浏览器实测 `/planning?state=loading` 为 `1440×1024`、DPR `1.0000000149011612`、字体加载完成、无横向溢出；标题圆角为 `6px`，两个操作骨架圆角均为 `12px`；左上角红黄绿窗口控制点为 `0`，Figma 设计稿未修改。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-loading-browser-radius-2026-08-28.jpg` 及 RGBA PNG；同尺寸 diff 为 `differentPixels=265491`、差异比例 `18.0048%`、`MAE=1.15954`、`RMSE=9.74272`、最大通道差异 `232`。
- [ ] 该局部修正减少了像素差异，但整页仍有头像、壳层、图标和浏览器光栅化差异，继续保持 `DIFF_REVIEW`，不标记为 `PASS`。
## 88. 2026-08-26 摄入分析 Loading 实时 Figma 结构收口

- [x] 重新读取实时 Figma 节点 `692:1901`，前端入口为 `/analysis?state=loading`；画板与浏览器视口均为 `1440×1024`。
- [x] 按当前 Figma 结构收口 Loading 专属几何：指标区 `126px`，图表卡 `303px`（`y=314px`），图表骨架 `1068×160px`，洞察卡 `217px`（`y=641px`），洞察骨架列表 `1068×74px`；指标、图表和洞察外框使用等效内描边，不改变布局盒尺寸。
- [x] 浏览器实测字体已加载、页面无横向溢出、文字越界为 `0`；前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-loading-figma-live-2026-08-26.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-loading-browser-current-2026-08-26.jpg` 和 RGBA PNG；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=433106`、差异比例 `29.3719%`、`MAE=1.38677`、`RMSE=9.60788`、最大通道差异 `230`，独立结果为 `intake-analysis-loading-current-diff.json`。
- [ ] 当前画板继续保持 `DIFF_REVIEW`：导航上下文、头像、图标、字体和浏览器光栅化仍存在可见差异，不能标记像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。
## 89. 2026-08-26 饮食记录 Loading 实时 Figma 结构收口

- [x] 重新读取实时 Figma 节点 `692:1427`，前端入口为 `/analysis?view=records&state=loading`；Figma 与浏览器视口均为 `1440×1024`。
- [x] 按当前 Figma 结构收口 Loading fixture：指标区为 `1116×80px`，指标骨架为 `80×16px` 与 `120×24px`，四张指标卡间距为 `16px`；餐次容器与指标区间距为 `24px`，两张餐次卡分别为 `1116×118px` 和 `1116×168px`，餐次内容骨架为 `42px` 行高、`8px` 行间距。
- [x] 浏览器实测字体已加载、页面无横向溢出、`1440×1024` 视口和 DPR `1.0000000149011612` 均通过；前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/diet-records-loading-live-2026-08-26.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/diet-records-loading-browser-current-2026-08-26.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=228793`、差异比例 `15.5160%`、`MAE=1.33810`、`RMSE=11.19032`、最大通道差异 `230`，独立结果为 `diet-records-current-diff.json`。
- [ ] 当前画板继续保持 `DIFF_REVIEW`：工作区壳层、头像、图标、字体和浏览器光栅化仍存在可见差异，不能标记像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 90. 2026-08-26 饮食记录 Empty 实时 Figma 几何收口

- [x] 重新读取实时 Figma 节点 `692:1556`，前端入口为 `/analysis?view=records&state=empty`；Figma 与浏览器视口均为 `1440×1024`。
- [x] 按当前 Figma 结构收口 Empty fixture：营养指标卡为 `267×88px`，空态面板为 `1116×377px`，图标容器为 `80×80px`，文案组为 `182×47px`，按钮为 `132×42px`；副文案行高调整为 `17px`。
- [x] 浏览器实测字体已加载、页面无横向溢出、文字越界为 `0`、DPR `1.0000000149011612`；前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/diet-records-empty-live-2026-08-26.png` 和 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/diet-records-empty-browser-current-2026-08-26-rgba.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=217516`、差异比例 `14.7512%`、`MAE=1.63114`、`RMSE=12.22059`、最大通道差异 `230`，独立结果为 `diet-records-current-diff.json`。
- [ ] 当前画板继续保持 `DIFF_REVIEW`：工作区壳层、头像、图标、字体和浏览器光栅化仍存在可见差异，不能标记像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。
## 91. 2026-08-26 饮食记录 Error 实时 Figma 几何收口

- [x] 重新读取实时 Figma 节点 `692:1685`，前端入口为 `/analysis?view=records&state=error`；Figma 与浏览器视口均为 `1440×1024`。
- [x] 按当前 Figma 结构收口 Error fixture：错误面板为 `1116×457px`，垂直内边距为 `120px`，图标容器为 `80×80px`，文案组为 `144×47px`，重载按钮为 `132×42px`；副文案行高调整为 `17px`。
- [x] 浏览器实测字体已加载、页面无横向溢出、文字越界为 `0`、DPR `1.0000000149011612`；前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/diet-records-error-live-2026-08-26.png` 和 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/diet-records-error-browser-current-2026-08-26-rgba.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=176061`、差异比例 `11.9399%`、`MAE=1.38010`、`RMSE=11.40657`、最大通道差异 `230`，独立结果为 `diet-records-current-diff.json`。
- [ ] 当前画板继续保持 `DIFF_REVIEW`：工作区壳层、头像、图标、字体和浏览器光栅化仍存在可见差异，不能标记像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 92. 2026-08-27 Meal Planning 餐食卡长标题显示收口

- [x] 重新读取实时 Figma 节点 `640:901` 的餐食卡文字配置：长英文菜名使用 `13px`、单行、隐藏溢出和 `ellipsis`，前端已按该规则修正；Figma 设计稿未修改。
- [x] `/planning?state=v2` 浏览器实测餐食卡长标题均为 `13px`、`white-space: nowrap`、`overflow: hidden`、`text-overflow: ellipsis`；页面字体状态为 `loaded`，前端左上角红黄绿窗口装饰点为 `0`，业务状态圆点保留。
- [x] 补充证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-browser-meal-title-2026-08-27.png` 与 `meal-planning-v2-meal-title-2026-08-27-diff.json`；同尺寸 PNG diff 为 `348604` 个差异像素、`23.6412%`、`MAE=2.47720`、`RMSE=13.87382`、最大通道差异 `234`，相较此前 `23.8253%` 有所下降。
- [x] `PlanningPage.test.tsx` 定向测试 `8/8` 通过；本轮全量 `npm run test` 为 `38` 个测试文件、`192/192`，`npm run format:check`、`npm run typecheck`、`npm run build` 和 `git diff --check` 均通过。
- [ ] 补充截图实际 DPR 为 `1.25`，不满足 DPR 1 门禁；因此主映射仍保持 `DIFF_REVIEW`，105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。

## 93. 2026-08-27 Agent Chat 顶栏品牌方块与窗口装饰复核

- [x] 重新读取 Figma 节点 `640:428`：侧栏品牌标记为 `36×36px` 并显示 `F`，顶栏品牌方块为 `28×28px` 的空白绿色方块；Figma 画板中的 `window-controls` 仅作为设计参考，前端不实现该三色窗口装饰。
- [x] 前端 `BrandLogo` 增加字母显示控制，`designChat` 且隐藏知识库顶部导航时只隐藏顶栏 `F`；侧栏品牌标记继续显示 `F`，普通页面不改变原有品牌行为。
- [x] 浏览器实测 `/chat?state=figma-v2`：视口 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`、根节点无横向溢出；顶栏品牌方块为 `28×28px` 且文本为空，侧栏品牌标记为 `36×36px` 且文本为 `F`。
- [x] 左上角红、黄、绿窗口装饰候选数量为 `0`；业务会话状态圆点保留，Figma 设计稿未修改。
- [x] 新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-brand-mark-browser-2026-08-27.png`，Figma 参考为 `docxs/设计/figma-png/agent-chat-v2.png`；`scripts/png-diff.mjs` 结果为 `differentPixels=644755`、差异比例 `43.7252%`、`MAE=5.20864`、`RMSE=22.10895`、最大通道差异 `255`，继续登记为 `DIFF_REVIEW`。
- [x] 105 画板证据重新生成后仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，自动 diff 输入 `105`；本条只更新 `agent-chat-v2` 的浏览器证据映射。
- [x] `WorkspaceLayout` 定向测试 `5/5`、类型检查和本次涉及文件的 Prettier 检查通过。
- [ ] 本条不关闭 105 张画板像素级 `PASS`、shadcn 全量迁移或 iconfont 实体资源登记；iconfont 继续为 `BLOCKED`。

## 113. 2026-08-29 Agent Chat 侧栏选中态颜色核验

- [x] 依据实时 Figma 节点 `879:353` 和 `879:361`，将 `designChat` 前端壳层的“Agent 对话”选中态设为 `rgba(199,150,84,0.08)`，当前会话条目选中态设为 `rgba(255,246,226,0.2)`；普通页面选中态不受影响，Figma 设计稿未修改。
- [x] `/chat?state=figma-v2` 运行时核验确认两项计算颜色与 Figma 节点一致，字体状态为 `loaded`，页面无横向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [ ] 本次浏览器连接实际提供的视口为 `1280×720`、DPR `1.25`，未生成可用于 Figma `1440×1024` 像素级门禁的正式 PNG diff；本条仅记录颜色和窗口装饰点的运行时证据，不改变 `agent-chat-v2` 的 `DIFF_REVIEW` 结论。

## 107. 2026-08-28 Profile Basic 默认入口 fixture 收口

- [x] 重新读取实时 Figma 节点 `806:1119`；Figma 设计稿包含左上角红、黄、绿窗口装饰点，但前端 `WorkspaceLayout` 不渲染该内容，设计稿保持不变。
- [x] mock 模式直接访问 `/profile` 现在使用 Figma 默认账号与资料：`Anddy`、`anddy_operator_9`、`1234567`、`180cm`、`78kg`、`精益增肌`、`2500 kcal`、`150g protein`、`花生` 和 `乳糖`；`?state=basic` 仍作为显式 fixture 入口，real 模式无 query 时继续使用真实用户。
- [x] 浏览器实测 `/profile`：视口 `1440×1024`、DPR `1.25`、字体已加载、页面无横向溢出、左上角窗口装饰候选数量为 `0`；业务会话状态圆点保留，未修改 Figma 设计稿。
- [x] 新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/profile-basic-figma-live-2026-08-28.png`、`profile-basic-default-browser-2026-08-28.jpg` 和 `profile-basic-default-browser-2026-08-28-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/profile-basic-default-fixture-2026-08-28-diff.json`，同尺寸结果为 `67.8905% / MAE 4.87625 / RMSE 21.40682 / maxChannelDelta 244`。
- [ ] Profile Basic 继续保持 `DIFF_REVIEW`：实际截图 DPR 为 `1.25`，且仍存在头像、字体、壳层与页面细节差异；本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面视觉迁移或 iconfont `BLOCKED`。

## 106. 2026-08-28 餐食规划列表通知按钮样式与窗口装饰复核

- [x] 依据实时 Figma 节点 `692:2662` 的顶栏通知按钮节点 `692:2729`，仅在 `/planning?state=list` 的 Figma fixture 作用域将通知按钮收口为 `36×36px`、白色背景、`1px #f4f6f5` 边框和 `18px` 圆角；空态、加载态、错误态、普通页面和真实模式不受影响。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612` 下实测按钮尺寸为 `36×36px`，背景为 `rgb(255,255,255)`，边框颜色为 `rgb(244,246,245)`，圆角为 `18px`；列表态和空态的前端红、黄、绿窗口控制点数量均为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-plan-list-notification-2026-08-28.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=544162`、差异比例 `36.9033%`、`MAE=4.23171`、`RMSE=20.50580`、最大通道差异 `255`，已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json#meal-plan-list`。
- [x] `PlanningPage` 与 `WorkspaceLayout` 定向测试 `16/16` 通过，类型检查、相关文件 Prettier 检查、目标视口浏览器检查和 `git diff --check` 通过。
- [ ] `meal-plan-list` 继续保持 `DIFF_REVIEW`：整页壳层、内容密度、字体和图标光栅化仍存在差异；105 张画板汇总继续为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面视觉迁移和 iconfont 实体登记仍未完成。

## 104. 2026-08-28 餐食规划空态图标底色收口

- [x] 依据实时 Figma 节点 `692:2446` 的图标容器节点 `692:2529`，将前端 `/planning?state=empty` 空态图标底色从 `rgba(166,217,151,0.18)` 修正为设计稿精确值 `#EBF7ED`；仅修改前端，Figma 文件、错误态和真实模式未修改。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`、页面无横向溢出；运行时颜色为 `rgb(235, 247, 237)`，空态卡片为 `520×368px`，左上角红黄绿窗口控制点与 `window-controls` 均为 `0`。顶栏绿色方块保持空白，侧栏品牌 `F` 保留。
- [x] 新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-empty-icon-background-2026-08-28.png`，独立 diff 为 `meal-planning-empty-icon-background-2026-08-28-diff.json`；`scripts/png-diff.mjs` 结果为 `differentPixels=190726`、差异比例 `12.9344%`、`MAE=1.24123`、`RMSE=10.12835`、最大通道差异 `232`，较前一份 `13.1101%` 有改善。
- [x] `PlanningPage.test.tsx` 定向测试 `9/9` 通过，类型检查和 `git diff --check` 通过；CSS 文件仍存在本次之前的 Prettier 格式提示，因此未将其写成格式检查全通过。
- [ ] 该画板仍保持 `DIFF_REVIEW`：头像、图标形状、字体和壳层光栅化仍有差异；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 105. 2026-08-28 餐食规划空态图标线条颜色收口

- [x] 依据实时 Figma 节点 `692:2446` 导出的 `utensils-crossed` SVG，确认图标线条使用 `#89B27C`；前端 `/planning?state=empty` 仅将 `.feedbackIcon` 的语义颜色切换为 `--fm-color-success-strong`，Figma 文件、错误态和真实模式未修改。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`、页面无横向溢出；运行时图标颜色为 `rgb(137, 178, 124)`，背景为 `rgb(235, 247, 237)`，左上角红黄绿窗口控制点与 `window-controls` 均为 `0`。
- [x] 新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-empty-icon-color-2026-08-28.png`，独立 diff 为 `meal-planning-empty-icon-color-2026-08-28-diff.json`；`scripts/png-diff.mjs` 结果为 `differentPixels=190697`、差异比例 `12.9325%`、`MAE=1.24022`、`RMSE=10.12595`、最大通道差异 `232`，较前一份 `12.9344%` 有改善。
- [x] `PlanningPage.test.tsx` 定向测试 `9/9` 通过，类型检查、构建和 `git diff --check` 通过；CSS 文件仍存在本次之前的 Prettier 格式提示，因此未将其写成格式检查全通过。
- [ ] 该画板仍保持 `DIFF_REVIEW`：图标形状、头像、字体和壳层光栅化仍有差异；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 98. 2026-08-27 Agent Chat 助手正文排版收口

- [x] 重新读取 Figma 节点 `640:428`，确认助手正文使用 `Noto Sans SC Regular 14px`；前端仅对 `/chat?state=figma-v2` 的助手正文解除通用 `Space Mono` 覆盖，来源行和 Trace 数值仍保留设计稿指定的 Space Mono。
- [x] headless Chromium 使用 `1440×1024`、DPR `1`、禁用动画；浏览器实测助手正文由字体修正前的三行收口为 Figma 的两行，消息操作区保持 `x=292、y=543、w=796、h=150`；左上角红黄绿窗口装饰候选为 `0`，Figma 设计稿未修改。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-font-browser-2026-08-27.png`，Figma 参考为 `docxs/设计/figma-png/agent-chat-v2.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=525211`、差异比例 `35.6182%`、`MAE=5.03448`、`RMSE=23.05043`、最大通道差异 `239`，继续登记为 `DIFF_REVIEW`。
- [ ] 头像资产、图标光栅化和浏览器渲染仍有可见差异；本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面迁移或 iconfont 实体资源登记，iconfont 继续为 `BLOCKED`。

## 99. 2026-08-27 Agent Chat Trace 卡片状态样式收口

- [x] 依据 Figma 节点 `640:428` 的 Trace 四张卡结构，保留状态条中的 `Executing ●`，但移除前端通用 running 工具在设计 fixture 中额外添加的橙色外框；其他运行态页面不改变。
- [x] `TraceRail` 增加明确的 `designTracePanel` 作用域，浏览器实测最后一张 Trace 卡的 computed border 为透明；视口 `1440×1024`、DPR `1`、禁用动画，左上角红黄绿窗口装饰候选为 `0`，Figma 设计稿未修改。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-trace-background-browser-2026-08-27.png`，Figma 参考为 `docxs/设计/figma-png/agent-chat-v2.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=525213`、差异比例 `35.6183%`、`MAE=5.00323`、`RMSE=22.95874`、最大通道差异 `239`，继续登记为 `DIFF_REVIEW`。
- [ ] 页面仍存在头像、图标光栅化和其他浏览器渲染差异；本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面迁移或 iconfont 实体资源登记，iconfont 继续为 `BLOCKED`。

## 100. 2026-08-27 Agent Chat 窗口控制占位与侧栏基线收口

- [x] 依据 Figma 节点 `640:428`，前端继续不渲染左上角红、黄、绿窗口装饰点，同时在设计 fixture 侧栏保留其 `12px` 顶部占位；品牌、新建任务和会话搜索框实测起点分别为 `y=52/104/161`。
- [x] 仅修改 `designChat` 作用域，普通页面和业务状态圆点不受影响；浏览器实测三色窗口装饰候选为 `0`，视口 `1440×1024`、DPR `1`、禁用动画，Figma 设计稿未修改。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-sidebar-baseline-browser-2026-08-27.png`，Figma 参考为 `docxs/设计/figma-png/agent-chat-v2.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=509690`、差异比例 `34.5656%`、`MAE=4.61398`、`RMSE=21.70300`、最大通道差异 `239`，继续登记为 `DIFF_REVIEW`。
- [ ] 头像、图标光栅化和其他浏览器渲染差异仍存在；本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面迁移或 iconfont 实体资源登记，iconfont 继续为 `BLOCKED`。

## 95. 2026-08-27 Intake Analysis 洞察颜色与窗口装饰复核

- [x] 重新读取 Figma 节点 `640:773`，确认第三条营养洞察圆点使用 `#80E0E6`；前端 `.insightOrange` 已改用语义变量 `--fm-color-info-strong`，运行时计算值为 `rgb(128, 224, 230)`。
- [x] 浏览器 headless fallback 使用 `1440×1024`、DPR `1`、字体 `loaded`；前端左上角红、黄、绿窗口装饰候选数量为 `0`，Figma 设计稿未修改，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-color-dpr1.png`，Figma 参考为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-v2-current.png`；`scripts/png-diff.mjs` 结果为 `differentPixels=205554`、差异比例 `13.9400%`、`MAE=3.52169`、`RMSE=19.53109`、最大通道差异 `211`，已同步 105 画板映射和汇总结果。
- [x] `AnalysisPage.test.tsx` 定向测试 `4/4`、`npm run typecheck`、浏览器运行时颜色检查和 `git diff --check` 通过；目标 CSS 文件仍有既存 Prettier 格式提示，本次未扩大格式化范围。
- [ ] 当前画板继续保持 `DIFF_REVIEW`，不能将局部颜色修正等同于整页像素级 `PASS`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全量页面视觉迁移和 iconfont 实体登记仍未完成。

## 96. 2026-08-27 Intake Analysis 默认态垂直节奏复核

- [x] 依据 Figma 节点 `640:773`，仅对 `/analysis?state=v2` 默认态摘要区启用 `107px` 高度；Empty 仍为 `100px`，Loading 仍为 `126px`，Error 不显示摘要区。
- [x] headless Chromium 使用 `1440×1024`、DPR `1`、字体加载完成；浏览器实测摘要区 `y=164,h=107`，趋势卡 `y=295,h=303`，洞察卡 `y=622,h=219`，数据质量面板 `y=873,h=140`，根节点无横向溢出。
- [x] 四种分析状态的前端左上角红、黄、绿窗口装饰候选数量均为 `0`；业务状态圆点保留，Figma 设计稿未修改。
- [x] 当前浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-default-height-2026-08-27-dpr1.png`，Figma 参考为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-v2-current.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=123089`、差异比例 `8.3475%`、`MAE=2.82908`、`RMSE=17.57882`、最大通道差异 `211`。
- [x] 当前结果已同步 `figma-105-mapping.json` 和 `figma-105-diff-results.json`；相比上一份 `13.9400%` 证据有所改善，但图标、字体渲染和主体视觉处理仍有差异，画板继续为 `DIFF_REVIEW`。
- [ ] 本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面视觉迁移或 iconfont 实体资源登记；iconfont 继续为 `BLOCKED`。

## 101. 2026-08-28 摄入分析默认态筛选容器宽度收口

- [x] 重新读取实时 Figma 节点 `640:773`，确认默认态筛选容器目标尺寸为 `384×40px`；loading、empty、error 状态仍按各自三项筛选结构保留原有宽度。
- [x] 前端仅在 `/analysis?state=v2` 的 `.figmaDefault` 作用域将筛选容器固定为 `384px`，不影响真实模式或其他分析状态；浏览器实测位置为 `x=292,y=100,width=384,height=40`。
- [x] 浏览器使用 `1440×1024`、DPR `1`、字体状态 `loaded`；前端左上角红、黄、绿窗口装饰候选数量为 `0`，Figma 设计稿未修改，业务状态圆点保留。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-filter-width-2026-08-28.png`，独立 diff 为 `differentPixels=392790`、差异比例 `26.6378%`、`MAE=2.95915`、`RMSE=16.41815`、最大通道差异 `234`；结果已同步到 `figma-105-mapping.json` 和 `figma-105-diff-results.json#intake-analysis-v2`。
- [x] `AnalysisPage` 定向测试、类型检查、截图转换和 `png-diff.mjs` 均已执行；该项只收口筛选容器几何，不能将整页差异结果改写为像素级 `PASS`。
- [ ] `intake-analysis-v2` 继续保持 `DIFF_REVIEW`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全量视觉迁移和 iconfont 实体登记仍未完成。

## 102. 2026-08-28 摄入分析错误态描述行盒收口

- [x] 重新读取实时 Figma 节点 `692:2139`，确认错误态描述节点 `692:2237` 的目标行盒为 `17px`；前端仅给错误态主描述增加 `.stateCopy .errorDescription { line-height: 17px; }`，不改变真实模式附加错误详情。
- [x] 浏览器复测 `/analysis?state=error`：错误描述为 `238×17px`，错误卡片为 `1116×440.6px`，图标容器为 `64×64px`，页面无横向溢出，字体状态为 `loaded`；前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 本次证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-error-browser-error-description-2026-08-28-rgba.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=191076`、差异比例 `12.9582%`、`MAE=2.06843`、`RMSE=14.51005`、最大通道差异 `255`，独立结果见 `intake-analysis-error-current-diff.json`。
- [x] `AnalysisPage` 定向测试 `4/4`、`npm run typecheck`、截图转换、`png-diff.mjs` 和 105 画板映射重生成均已执行；本次 in-app 浏览器实际 DPR 为 `1.25`，因此该画板的 DPR 1 门禁保持未通过。
- [ ] 该画板继续保持 `DIFF_REVIEW`，剩余按钮高度、头像、侧栏/图标光栅化和字体渲染差异仍需后续逐点处理；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 103. 2026-08-28 摄入分析错误态重载按钮几何收口

- [x] 依据 Figma 节点 `692:2238/2239`，将 Figma fixture 的“重新加载”按钮收口为 `120×41px`，文本行盒为 `17px`，按钮位置实测为 `x=790,y=443`；真实模式按钮不受该 fixture 作用域规则影响。
- [x] 为避免边框参与错误卡片的最小内容计算，Figma fixture 的错误卡片改用 `box-shadow: inset 0 0 0 1px var(--fm-border)` 保留视觉描边；浏览器实测卡片为 `1116×440px`，图标容器为 `64×64px`，描述为 `238×17px`。
- [x] 本次证据为原始截图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-error-browser-reload-button-2026-08-28.jpg` 及 RGBA 归一化图 `intake-analysis-error-browser-reload-button-2026-08-28-rgba.png`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=189434`、差异比例 `12.8468%`、`MAE=2.00587`、`RMSE=14.19979`、最大通道差异 `255`，独立结果见 `intake-analysis-error-current-diff.json`。
- [x] `AnalysisPage` 定向测试 `4/4`、`npm run typecheck`、截图转换、`png-diff.mjs` 和 105 画板映射重生成均已执行；前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [ ] 本次 in-app 浏览器实际 DPR 为 `1.25`，DPR 1 门禁仍未通过；该画板继续为 `DIFF_REVIEW`，头像、侧栏/图标光栅化和字体渲染差异仍需后续逐点处理。

## 104. 2026-08-28 餐食规划列表 Tab 垂直几何验收

- [x] 验收节点为实时 Figma `692:2662`，路由为 `/planning?state=list`，基线与浏览器视口均为 `1440×1024`；Figma PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/meal-plan-list-live-2026-08-28.png`，浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-plan-list-tabs-geometry-2026-08-28-rgba.png`。
- [x] 前端标题组、Tab 容器和计划卡几何实测分别为 `x=292,y=100,h=50`、`x=292,y=174,h=45`、卡片起点 `y=243/392/541` 与尺寸 `1116×133px`；字体已加载、页面无横向溢出、DPR 为 `1.0000000149011612`。
- [x] 自动 diff 为 `321004/1474560` 个差异像素，差异比例 `21.7695%`，`MAE=2.40082`，`RMSE=13.86524`，最大通道差异 `232`；结果锚点为 `figma-105-diff-results.json#meal-plan-list`，独立结果为 `meal-plan-list-current-diff.json`。
- [x] 自动几何与文字检查通过；人工复核确认列表结构和三张卡片存在，但壳层、内容密度、字体及图标光栅化仍有差异，因此结论保持 `DIFF_REVIEW`，不能标记 `PASS`。
- [x] 前端左上角红、黄、绿窗口控制点及 `window-controls` 均为 `0`；业务状态圆点保留，Figma 设计稿保持只读。
- [ ] 105 张画板汇总继续为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`；shadcn 全量页面迁移和 iconfont 实体资源登记仍未完成，iconfont 继续为 `BLOCKED`。

## 105. 2026-08-28 餐食规划默认页计划横幅几何验收

- [x] Figma 节点 `640:901` 的计划横幅按实时元数据核对为 `776×97px`，两个操作按钮均为 `88×37px`；前端使用等效内描边保留边框视觉，同时避免边框参与内容盒尺寸计算。
- [x] 浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-banner-geometry-browser-2026-08-28.png`，RGBA 归一化证据为同名 `-rgba.png`；视口 `1440×1024`，字体已加载，页面无横向溢出。
- [x] 浏览器实测横幅 `776×97px`，重新生成按钮 `88×37px`，保存计划按钮 `88×37px`；前端左上角红黄绿窗口装饰候选为 `0`，Figma 设计稿保持只读。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=344235`、差异比例 `23.3449%`、`MAE=2.40089`、`RMSE=13.73352`、最大通道差异 `234`；独立结果见 `foodmate-ui/.qa/figma-pixel-acceptance/meal-planning-v2-banner-geometry-2026-08-28-diff.json`，并已登记到 105 画板映射的 `additionalVisualEvidence`。
- [ ] 当前浏览器采集实际 DPR 为 `1.25`，该记录只证明局部几何修正，不满足 DPR 1 和整页人工复核门禁；`meal-planning-v2` 以及 105 张画板继续保持 `DIFF_REVIEW`，不能标记 `PASS`。

## 115. 2026-08-29 Intake Analysis 趋势卡内容区边界收口

- [x] 重新读取实时 Figma 节点 `640:773`，确认趋势卡目标为 `1116×303px`、图表内容区目标为 `1068×220px`、洞察卡目标为 `1116×219px`；前端仅在 Figma fixture 作用域将趋势卡和洞察卡外描边改为等效内描边，真实模式不受影响。
- [x] 浏览器实测 `/analysis?state=v2`：视口 `1440×1024`、DPR `1.0000000149`、字体已加载、页面无横向溢出；趋势卡为 `1116×303px`，图表区为 `1068×220px`，洞察卡为 `1116×219px`，左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] 新增原始浏览器帧 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-card-inset-2026-08-29.jpg`、RGBA PNG `intake-analysis-v2-browser-card-inset-2026-08-29.png` 和独立 diff `intake-analysis-v2-card-inset-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=406148`、差异比例 `27.5437%`、`MAE=2.49562`、`RMSE=14.13861`、最大通道差异 `234`，结论继续为 `DIFF_REVIEW`。
- [x] `AnalysisPage` 定向测试 `5/5`、浏览器几何检查、截图格式归一化、`png-diff.mjs` 和窗口装饰源码/运行时检查均已执行；Figma 设计稿未修改。
- [ ] 本小点只收口趋势卡内容区边界，不代表该画板或 105 张画板达到像素级 `PASS`；整页字体、图标和其他视觉差异仍需复核，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 116. 2026-08-29 Intake Analysis 洞察操作按钮几何收口

- [x] 重新读取实时 Figma 节点 `640:895` 及子节点 `640:896/640:898`，确认“让 Agent 解读”目标为 `121×37px`、“基于分析制定计划”目标为 `144×37px`，两者间距为 `12px`。
- [x] 前端仅在 Figma fixture 作用域为两个按钮增加 `box-sizing: border-box` 和明确宽度；真实模式保持原有自适应按钮尺寸与交互。
- [x] 浏览器实测 `/analysis?state=v2`：第一按钮 `121×37px`、第二按钮 `144×37px`、间距 `12px`；视口 `1440×1024`、DPR `1.0000000149`、字体已加载、页面无横向溢出，左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 新增原始浏览器帧 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-insight-buttons-2026-08-29.jpg`、PNG `intake-analysis-v2-browser-insight-buttons-2026-08-29.png` 和独立 diff `intake-analysis-v2-insight-buttons-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=406120`、差异比例 `27.5418%`、`MAE=2.49371`、`RMSE=14.13255`、最大通道差异 `234`，结论继续为 `DIFF_REVIEW`。
- [x] `AnalysisPage` 定向测试 `5/5`、`npm run typecheck`、浏览器几何检查、截图格式归一化、`png-diff.mjs` 和 `git diff --check` 均通过；Figma 设计稿未修改。
- [ ] 本小点只收口洞察操作按钮几何，不代表该画板或 105 张画板达到像素级 `PASS`；整页字体、图标和其他视觉差异仍需复核，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 107. 2026-08-28 Agent Tool Failed Retryable 当前版本验收

- [x] 重新读取 Figma 节点 `687:1439`，确认侧栏窗口控制区域只提供 `y=24~36` 的顶部占位，品牌、新建任务、会话搜索和工作区导航目标起点为 `y=52/104/161/217`；前端仅移除左上角红、黄、绿窗口控制点，保留该占位，业务状态圆点不受影响。
- [x] 浏览器当前版本实测视口 `1440×1024`、字体已加载、无横向溢出、窗口控制候选数量为 `0`；Agent 头像 `x=292,y=237,w=36,h=36`，失败卡片 `x=340,y=237,w=560,h=160.6`，与 Figma 目标位置和主体宽度一致。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-tool-failed-retryable-browser-2026-08-28.png`，Figma 参考为 `docxs/设计/figma-png/agent-tool-failed-retryable.png`；独立 diff 为 `differentPixels=360281`、差异比例 `24.4331%`、`MAE=3.03221`、`RMSE=16.25115`、最大通道差异 `253`，见 `agent-tool-failed-retryable-current-diff.json`。
- [x] 交互回归保留“重试”和“跳过此步骤”两个入口，且仅在 `retryable` fixture 中显示重试；定向 ChatPage 测试与全量前端门禁已通过。
- [ ] 本次采集实际 DPR 为 `1.25`，因此运行时 `dprPass=false`；整页壳层、字体光栅化、图标及其他组合差异仍存在，画板继续为 `DIFF_REVIEW`，不能标记 `PASS`。shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 108. 2026-08-28 Agent Safety Degraded 当前版本验收

- [x] 对应 Figma 节点 `687:1563` 的 `/chat?state=safety-degraded` fixture 保留安全降级警告、有限数据范围、个人条件未完整应用提示和可继续追问入口；降级结果未包装为完整分析或完整引用。
- [x] 浏览器当前版本在 `1440×1024` 视口下实测字体已加载、`scrollWidth=clientWidth=1440`、窗口控制候选数量为 `0`；Figma 设计稿中的红黄绿装饰点未写入前端，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-safety-degraded-browser-2026-08-28.png`，Figma 参考为 `docxs/设计/figma-png/agent-safety-degraded.png`；独立 diff 为 `differentPixels=378158`、差异比例 `25.6455%`、`MAE=3.35588`、`RMSE=16.78875`、最大通道差异 `255`，见 `agent-safety-degraded-current-diff-2026-08-28.json`。
- [x] ChatPage 状态回归保留降级文案和启用的追问输入框；机器检查与人工复核均已更新，结论继续为 `DIFF_REVIEW`。
- [ ] 当前捕获实际 DPR 为 `1.0000000149`，但整页壳层、字体光栅化、图标和组合内容仍存在差异；该画板不能标记像素级 `PASS`。shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 109. 2026-08-28 Agent User Cancelled 当前版本验收

- [x] 对应 Figma 节点 `687:1684` 的 `/chat?state=user-cancelled` fixture 保留已接收的部分文本、用户取消原因和重新开始入口；取消态不显示为系统失败。
- [x] 浏览器当前版本在 `1440×1024` 视口下实测字体已加载、`scrollWidth=clientWidth=1440`、窗口控制候选数量为 `0`；Figma 设计稿中的红黄绿装饰点未写入前端，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-browser-2026-08-28.png`，Figma 参考为 `docxs/设计/figma-png/agent-user-cancelled.png`；独立 diff 为 `differentPixels=311770`、差异比例 `21.1433%`、`MAE=2.69148`、`RMSE=15.00025`、最大通道差异 `245`，见 `agent-user-cancelled-current-diff-2026-08-28.json`。
- [x] ChatPage 状态回归确认部分文本、取消提示和重新开始输入框存在，且页面正文不包含“运行失败”；机器检查与人工复核均已更新，结论继续为 `DIFF_REVIEW`。
- [ ] 整页壳层、字体光栅化、图标及其他组合差异仍存在；该画板不能标记像素级 `PASS`。shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 151. 2026-08-30 Agent SSE Reconnecting 时间文案收口

- [x] 依据 Figma 节点 `687:1803`，将 `/chat?state=sse-reconnecting` 的用户消息时间从共享默认时间修正为画板中的 `Anddy · 03:00 PM`；仅修改前端，未修改 Figma 设计稿。
- [x] 浏览器重新采集视口 `1440×1024`，字体已加载，`scrollWidth=clientWidth=1440`，助手行 `x=292,y=237,width=608,height=52`，助手气泡 `x=340,y=237,width=560,height=52`，重连提示带 `x=284,y=820,width=1132,height=66`，输入区 `x=260,y=912,width=1180,height=112`；前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-time-aligned-browser-1440x1024-2026-08-30.png`，Figma 参考为 `docxs/设计/figma-png/agent-sse-reconnecting.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-sse-reconnecting-time-aligned-2026-08-30-diff.json`，`differentPixels=373405`、差异比例 `25.3231%`、`MAE=2.19232`、`RMSE=13.47360`、最大通道差异 `234`，结论继续为 `DIFF_REVIEW`。
- [x] 映射 JSON 和聚合 diff 已更新；重连态测试通过，最新采集实际 DPR 为 `1.25`，因此不满足严格 DPR 1 的像素 `PASS` 门禁。
- [ ] 整页工作台壳层、头像、字体和图标光栅化仍存在差异；该画板不能标记像素级 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 152. 2026-08-30 Agent SSE Reconnecting 告警颜色收口

- [x] 依据 Figma 节点 `687:1803`，将 `/chat?state=sse-reconnecting` 重连提示带从通用告警颜色收口为 Figma 颜色：背景 `#FFEDD5`、描边 `#F97316`、标题和正文 `#C2410C`；仅修改前端，未修改 Figma 设计稿。
- [x] 浏览器运行时验证提示带计算样式为 `rgb(255,237,213)`、`rgb(249,115,22)`、`rgb(194,65,12)`，提示带 `x=284,y=820,width=1132,height=66`；视口 `1440×1024`、字体已加载、页面无横向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-warning-colors-browser-1440x1024-2026-08-30.png`，Figma 参考为 `docxs/设计/figma-png/agent-sse-reconnecting.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-sse-reconnecting-warning-colors-2026-08-30-diff.json`，`differentPixels=339487`、差异比例 `23.0229%`、`MAE=2.77881`、`RMSE=15.46246`、最大通道差异 `249`，较上一份时间文案证据的 `25.3231%` 有下降，结论继续为 `DIFF_REVIEW`。
- [x] 映射 JSON 和聚合 diff 已更新；重连态行为测试、类型检查、生产构建和 `git diff --check` 将在本小点提交前重新验证。
- [ ] 整页工作台壳层、头像、字体和图标光栅化仍存在差异；该画板不能标记像素级 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 110. 2026-08-28 Agent SSE Reconnecting 当前版本验收

- [x] 对应 Figma 节点 `687:1803` 的 `/chat?state=sse-reconnecting` fixture 保留已显示文本，展示第 `2/5` 次重连、等待重连状态和持续失败后的刷新提示；输入框保持禁用。
- [x] 浏览器当前版本在 `1440×1024` 视口下实测字体已加载、`scrollWidth=clientWidth=1440`、窗口控制候选数量为 `0`；Figma 设计稿中的红黄绿装饰点未写入前端，业务状态圆点保留。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-browser-2026-08-28.png`，Figma 参考为 `docxs/设计/figma-png/agent-sse-reconnecting.png`；独立 diff 为 `differentPixels=384243`、差异比例 `26.0581%`、`MAE=2.98683`、`RMSE=15.58692`、最大通道差异 `248`，见 `agent-sse-reconnecting-current-diff-2026-08-28.json`。
- [x] ChatPage 状态回归确认重连文案、重连次数、刷新提示、保留文本和禁用输入框存在；机器检查与人工复核均已更新，结论继续为 `DIFF_REVIEW`。
- [ ] 整页壳层、字体光栅化、图标及其他组合差异仍存在；该画板不能标记像素级 `PASS`。shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 106. 2026-08-28 Agent 完成态引用与蛋白质指标收口

- [x] 依据 Figma 节点 `687:1306`，为 `/chat?state=completed-with-citations` 增加独立完成态 fixture：完成响应、蛋白质指标卡、两条数据源引用和无 Trace 的完成态布局。
- [x] 完成态用户消息固定使用已登记的默认男头像；前端左上角红、黄、绿窗口装饰候选数量为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 浏览器实测视口 `1440×1024`、字体已加载、页面无横向溢出；用户气泡为 `186×49px`，指标卡宽度为 `528px`，引用标签数量为 `2`，Trace 数量为 `0`。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-completed-with-citations-browser-2026-08-28.png`，Figma 参考为 `docxs/设计/figma-png/agent-completed-with-citations.png`；独立 diff 为 `differentPixels=356152`、差异比例 `24.1531%`、`MAE=2.68472`、`RMSE=14.72847`、最大通道差异 `236`，见 `agent-completed-with-citations-current-diff.json`。
- [x] 已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json`，并保留 `DIFF_REVIEW`；定向测试和类型检查待本轮最终门禁统一复核。
- [ ] 整页壳层、字体光栅化、图标及其他组合差异仍存在，本小点不代表该画板或 105 张画板达到像素级 `PASS`；shadcn 全页面迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 97. 2026-08-27 Workspace Home 状态说明文案复核

- [x] 依据 Figma 节点 `640:256`，将 `/?state=figma-v2` 的状态说明从“待处理事项提醒 / 预算通知”修正为“待处理事项覆盖 / 预算追加”，与设计稿可见文案一致。
- [x] 工作台首页定向测试 `2/2` 通过；headless Chromium 使用 `1440×1024`、DPR `1`、禁用动画，页面无横向溢出。
- [x] 前端左上角红、黄、绿窗口装饰候选为 `0`；顶栏绿色品牌方块保持空白，侧栏品牌字母和业务状态圆点未删除，Figma 设计稿未修改。
- [x] 当前浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/workspace-home-v2-browser-dpr1-motionoff-2026-08-27.png`；与 `recaptured-figma/workspace-home-v2-figma.png` 的同尺寸 diff 为 `differentPixels=393796`、差异比例 `26.7060%`、`MAE=3.62688`、`RMSE=18.43240`、最大通道差异 `254`。
- [x] 已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json`；该画板仍为 `DIFF_REVIEW`，没有将单条文案修正标记为像素级 `PASS`。
- [ ] 本小点不关闭 105 张画板像素级 `PASS`、shadcn 全页面视觉迁移或 iconfont 实体资源登记；iconfont 继续为 `BLOCKED`。

## 94. 2026-08-27 Meal Planning 顶栏品牌标记 fixture 边界修正

- [x] 重新读取 Figma 节点 `692:2662`：规划列表顶栏绿色品牌方块为 `28×28px` 空白方块，侧栏品牌标记为 `36×36px` 并显示 `F`；Figma 画板中的 `window-controls` 仍只作为设计参考，前端不实现三色窗口装饰。
- [x] 修正 `WorkspaceLayout` 的 fixture 判断：规划页通过 `sidebarFixture`、Chat 页通过 `designChat`，二者在隐藏知识库顶部导航时都隐藏顶栏 `F`；普通页面和侧栏品牌标记不受影响。
- [x] 浏览器实测 `/planning?state=list`：视口 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded`、根节点无横向溢出；顶栏方块为 `28×28px` 且文本为空，侧栏标记为 `36×36px` 且文本为 `F`，左上角红黄绿窗口装饰候选为 `0`。
- [x] 新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-plan-list-brand-mark-browser-2026-08-27.png`，Figma 参考为 `docxs/设计/figma-png/meal-plan-list.png`；`scripts/png-diff.mjs` 结果为 `differentPixels=546504`、差异比例 `37.0622%`、`MAE=4.25977`、`RMSE=20.45833`、最大通道差异 `245`，继续登记为 `DIFF_REVIEW`。
- [x] 105 画板映射已指向本次规划列表证据，汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，自动 diff 输入 `105`。
- [x] `WorkspaceLayout` 定向测试 `5/5`、类型检查和本次涉及文件的 Prettier 检查通过。
- [ ] 本条不关闭 105 张画板像素级 `PASS`、shadcn 全量迁移或 iconfont 实体资源登记；iconfont 继续为 `BLOCKED`。

## 111. 2026-08-29 Workspace Home 待确认队列面板高度收口

- [x] 重新读取 Figma 节点 `640:256` 的实时元数据，确认“活跃会话”面板为 `546×305px`，“待确认队列”面板为 `546×228px`；前端此前因两个面板共用 `min-height: 305px` 将右侧面板错误拉伸。
- [x] 为 Workspace Home 的“待确认队列”增加独立几何约束：桌面端 `min-height: 228px` 且在网格行内顶端对齐；移动端恢复自然高度，避免窄视口内容被固定尺寸限制。
- [x] 浏览器实时复核 `/?state=figma-v2`：当前视口 `1280×720`、DPR `1.25`；“活跃会话”实测 `458.4×305px`，“待确认队列”实测 `458.4×228px`，页面无横向溢出，左上角红黄绿窗口装饰候选数量为 `0`。
- [x] Workspace Home 定向测试 `3/3`、`npm run typecheck`、`npm run build` 和 `git diff --check` 通过。
- [ ] 本条只证明 Workspace Home 局部几何收口；当前浏览器不是 Figma 要求的 `1440×1024 / DPR 1`，整页自动 diff 仍为 `DIFF_REVIEW`，不标记像素级 `PASS`。105 张画板汇总、shadcn 全量视觉迁移和 iconfont 实体资源登记状态不变。

## 112. 2026-08-29 Workspace Home Dashboard 内部间距收口

- [x] 依据 Figma 节点 `640:256` 实时元数据，确认 Dashboard 面板内边距为 `24px`，标题行高为 `22px`，标题到列表间距为 `16px`，列表项高度为 `65px`。
- [x] 修正 Workspace Home Dashboard CSS：面板桌面外框明确为 `305px`，待确认队列明确为 `228px`；移动端两者恢复自适应高度，避免固定桌面尺寸影响窄视口。
- [x] 浏览器实时复核 `/?state=figma-v2`：当前视口 `1280×720`、DPR `1.25`；活跃会话面板实测 `458.4×305px`，待确认队列实测 `458.4×228px`，标题行高 `22px`，列表项高度 `65px`，页面无横向溢出，左上角红黄绿窗口装饰候选数量为 `0`。
- [x] Workspace Home 定向测试 `3/3`、`npm run typecheck`、`npm run build` 和 `git diff --check` 通过。
- [ ] 本条只证明 Dashboard 局部几何收口；当前浏览器不是 Figma 要求的 `1440×1024 / DPR 1`，整页自动 diff 仍为 `DIFF_REVIEW`，不标记像素级 `PASS`。105 张画板汇总、shadcn 全量视觉迁移和 iconfont 实体资源登记状态不变。

## 114. 2026-08-29 Diet Records 详情行位收口

- [x] 依据 Figma 节点 `640:588` 和 `974:3` 的实时元数据，确认详情面板为 `1116×220px`，五行内容相对面板顶部的目标位置为 `16/46/74/102/130px`。
- [x] 修正 `DietRecordsPage` 详情面板的 Grid 对齐方式，使用顶部内容对齐，避免固定高度把五行文本拉伸到面板底部；浏览器实测行位为 `16.8/46.8/74.8/102.8/130.8px`，与 Figma 基准一致。
- [x] 浏览器实测视口为 `1440×1024`、DPR `1.0000000149`，详情面板实测尺寸为 `1116×220px`，页面无横向溢出，左上角红黄绿窗口装饰候选数量为 `0`。
- [x] Diet Records 定向测试 `10/10` 通过；本次修改未增加或删除业务交互，不改变真实模式接口行为。
- [ ] 本条只证明详情面板局部几何收口；整页自动 diff 仍为 `DIFF_REVIEW`，不能标记像素级 `PASS`。105 张画板汇总、shadcn 全页面视觉迁移和 iconfont 实体资源登记状态不变。

## 117. 2026-08-29 Meal Planning 列表创建按钮几何收口

- [x] 重新读取实时 Figma 节点 `692:2662`，确认列表页“+ 新建膳食计划”节点目标尺寸为 `128×37px`；仅修改前端 `MealPlanningFlow.module.css`，未修改 Figma 设计稿。
- [x] `/planning?state=list` 浏览器实测按钮位置为 `x=1280,y=106.5`，尺寸为 `128×37px`，字体为 `14px / 700 / 17px`；视口为 `1440×1024`，无横向溢出，字体已加载。
- [x] 前端源码和运行时均未发现左上角红、黄、绿窗口装饰点；侧栏会话状态圆点属于业务状态，继续保留。
- [x] 最新 Figma PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/meal-plan-list-live-2026-08-29.png`，浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-plan-list-create-button-browser-2026-08-29-rgba.png`；`scripts/png-diff.mjs` 结果为 `differentPixels=319327`、差异比例 `21.6557%`、`MAE=2.38728`、`RMSE=13.83342`、最大通道差异 `232`，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只收口列表创建按钮几何，不代表该画板或 105 张画板达到像素级 `PASS`；整页壳层、内容密度、字体和图标光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 118. 2026-08-29 Meal Planning 列表 Tab 水平间距收口

- [x] 重新读取实时 Figma 节点 `692:2662`，确认三个列表 Tab 的目标位置为 `x=292/374/456`，每项宽度 `74px`，水平间距为 `8px`；仅修改前端 `MealPlanningFlow.module.css`，未修改 Figma 设计稿。
- [x] `/planning?state=list` 浏览器在 `1440×1024 / DPR 1` 下实测三个 Tab 位置为 `x=292/374/456`、高度 `33px`，字体已加载且无页面横向溢出。
- [x] 前端源码和运行时均未发现左上角红、黄、绿窗口装饰点；会话状态圆点属于业务状态，继续保留。
- [x] 最新浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-plan-list-tabs-gap-browser-2026-08-29-rgba.png`；同尺寸 `scripts/png-diff.mjs` 结果为 `differentPixels=319709`、差异比例 `21.6817%`、`MAE=2.37253`、`RMSE=13.77192`、最大通道差异 `232`，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只收口 Tab 水平间距，不代表该画板或 105 张画板达到像素级 `PASS`；整页壳层、内容密度、字体和图标光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 119. 2026-08-29 Meal Planning 默认页右侧栏边界收口

- [x] 依据 Figma 节点 `640:901`、`640:1077`，将 `/planning?state=v2` fixture 的右侧栏左边界改为不参与布局计算的 `inset` 内描边，保持右侧栏 `x=1100、width=340px`，内部内容 `x=1124、width=292px`。
- [x] 浏览器实测约束行位置为 `y=54/111/168/225`、高度 `45px`；购物清单分组位置为 `y=348/446`、高度 `86px`；字体已加载，页面无横向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`，会话状态圆点保留；Figma 设计稿未修改。
- [x] 新增浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-right-rail-inset-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/meal-planning-v2-right-rail-inset-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=341860`、差异比例 `23.1839%`、`MAE=2.24425`、`RMSE=12.93822`、最大通道差异 `234`。
- [ ] 当前浏览器采集实际 DPR 为 `1.25`，DPR 1 门禁未通过；该局部修正不关闭 `meal-planning-v2` 或 105 张画板的像素级 `PASS`，主画板继续保持 `DIFF_REVIEW`。

## 122. 2026-08-29 Knowledge 来源不可用状态视觉收口

- [x] 依据 Figma 节点 `795:1151`，恢复 `/knowledge?state=source-unavailable` 的 `6px` 橙色左侧状态条、`PARTIAL ACCESS` 标签、橙色标题、`600×260` 卡片圆角和状态层背景；Figma 设计稿未修改。
- [x] 浏览器实测视口 `1440×1024`、DPR `1.0000000149`；卡片位置为 `x=550,y=300`、尺寸 `600×260`，状态标签为 `174×24`，左上角窗口装饰候选数量为 `0`，页面无横向溢出。
- [x] `KnowledgePage` 定向测试 `6/6` 通过；“稍后重试”仍可清除状态，`search-failed` 和真实模式检索逻辑未改变。
- [x] 最新浏览器 RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/user-knowledge-source-unavailable-browser-dpr1-2026-08-29-rgba.png`；独立 diff 为 `35.1598% / MAE 3.94340 / RMSE 16.95234 / maxChannelDelta 255`，结论继续为 `DIFF_REVIEW`。
- [ ] 整页壳层、头像、字体光栅化、图标和其他组合差异仍存在；本小点不代表该画板或 105 张画板达到像素级 `PASS`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 121. 2026-08-29 Knowledge 检索失败状态视觉收口

- [x] 依据 Figma 节点 `795:968`，恢复 `/knowledge?state=search-failed` 的 `6px` 红色左侧状态条、`ERROR · RETRY AVAILABLE` 标签、红色标题、`600×260` 卡片圆角和状态层背景；Figma 设计稿未修改。
- [x] 浏览器实测视口 `1440×1024`、DPR `1.0000000149`；卡片位置为 `x=550,y=300`、尺寸 `600×260`，状态标签为 `174×24`，左上角窗口装饰候选数量为 `0`，页面无横向溢出。
- [x] `KnowledgePage` 定向测试 `6/6` 通过；状态恢复入口仍可用，`source-unavailable` 的独立样式和真实模式错误处理未改变。
- [x] 最新浏览器 RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/user-knowledge-search-failed-browser-dpr1-2026-08-29-rgba.png`；独立 diff 为 `35.2425% / MAE 3.88158 / RMSE 16.57742 / maxChannelDelta 255`，结论继续为 `DIFF_REVIEW`。
- [ ] 整页壳层、头像、字体光栅化、图标和其他组合差异仍存在；本小点不代表该画板或 105 张画板达到像素级 `PASS`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 120. 2026-08-29 Knowledge 空态前端窗口装饰复核

- [x] 重新复核 Figma 节点 `795:786` 与 `/knowledge?state=empty`：Figma 画板保留左上角红、黄、绿窗口装饰，前端不渲染该设计参考内容；会话状态圆点属于业务状态，继续保留。
- [x] 浏览器使用 `1440×1024`、DPR `1.0000000149`、字体已加载；空态卡片实测 `x=570,y=320,width=560,height=220`，与 Figma 目标一致，页面无横向溢出。
- [x] 新增前端回归断言，确认该知识库 fixture 不包含 `window-controls`、`traffic-light` 或三色窗口控制标记；Figma 设计稿未修改。
- [x] 最新浏览器 PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/user-knowledge-empty-browser-dpr1-2026-08-29.png`；同尺寸 `scripts/png-diff.mjs` 结果为 `differentPixels=325786`、差异比例 `22.0938%`、`MAE=2.30524`、`RMSE=13.80022`、最大通道差异 `244`，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只确认并固化前端去除设计稿窗口装饰的行为，不代表该画板或 105 张画板达到像素级 `PASS`；整页壳层、头像、图标和文字光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 123. 2026-08-29 Admin Tool Calls 表格行高收口

- [x] 依据实时 Figma 节点 `797:359`、`797:453-462`，将 `/admin?state=tool-calls` 工具调用表收口为 `1132×87px`，表头 `38px`、数据行 `49px`；外描边改为不参与布局的 inset 描边，避免边框改变表格总高度。
- [x] 浏览器实测视口 `1440×1024`、DPR `1.0000000149`、字体状态 `loaded`；表格 `1132×87px`，载荷卡片 `1132×321.4px`，说明面板 `1132×250px`，页面无横向或纵向溢出。
- [x] 前端左上角红、黄、绿窗口装饰候选数量为 `0`；侧栏权限状态圆点保留，Figma 设计稿未修改。
- [x] 定向 Admin 测试 `8/8` 通过；实时 Figma 参考图与浏览器 RGBA PNG 的 PNG diff 为 `differentPixels=311840`、差异比例 `21.1480%`、`MAE=2.85604`、`RMSE=17.03777`、最大通道差异 `230`。证据和 105 画板映射已同步。
- [ ] 侧栏身份、图标光栅化、字体和其他整页组合差异仍存在；该画板继续为 `DIFF_REVIEW`，不能标记像素级 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 125. 2026-08-29 Admin Trace 事件面板几何收口

- [x] 依据实时 Figma 节点 `797:621`、`797:732`、`986:25`，仅修改前端 `AdminPage.module.css`：工具栏收口为 `34px`，运行表收口为 `1132×87px`，Trace 事件面板收口为 `1132×162px`，四张事件卡均为 `261×87px`，详情面板对齐到 `y=454`；未修改 Figma 设计稿。
- [x] 浏览器视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`；Trace 事件面板为 `y=257.28`、`1132×162px`，四张卡位置为 `x=304/581/858/1135`、`261×87px`，详情面板为 `y=454.08`、`1132×300px`；页面无横向或纵向溢出，左上角窗口装饰候选数量为 `0`。
- [x] 最新 Figma PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-figma-live-2026-08-29.png`，浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-height-browser-2026-08-29-rgba.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-height-2026-08-29-diff.json`；结果为 `differentPixels=366520`、差异比例 `24.8562%`、`MAE=2.743037`、`RMSE=15.440114`、最大通道差异 `230`。
- [ ] 事件面板局部几何已收口，但侧栏身份、图标处理、字体和其它整页渲染差异仍存在；该画板继续为 `DIFF_REVIEW`，不能标记 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移未完成，iconfont 继续为 `BLOCKED`。

## 126. 2026-08-29 Admin Run Detail 详情面板垂直位置收口

- [x] 依据实时 Figma 节点 `797:212` 与详情字段节点 `986:3`，仅修改前端 `AdminPage.module.css`：将 Run Detail 详情面板上间距从 `24px` 调整为 `34.8px`，从浏览器 `y=443` 对齐到目标 `y=454`；未修改 Figma 设计稿，也未删除业务状态圆点。
- [x] 浏览器视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`；详情面板为 `1132×300px`、位于 `y=453.998`，共享 Trace 面板为 `1132×162px`、位于 `y=257`；页面无横向或纵向溢出，左上角窗口装饰候选数量为 `0`。
- [x] 最新 Figma PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-run-detail-figma-live-2026-08-29.png`，浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-run-detail-height-browser-2026-08-29-rgba.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-run-detail-height-2026-08-29-diff.json`；结果为 `differentPixels=375726`、差异比例 `25.4806%`、`MAE=2.793519`、`RMSE=15.535898`、最大通道差异 `230`。
- [ ] 详情面板局部几何已收口，但侧栏身份、图标处理、字体和其它整页渲染差异仍存在；该画板继续为 `DIFF_REVIEW`，不能标记 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移未完成，iconfont 继续为 `BLOCKED`。

## 124. 2026-08-29 Admin SQL Audit 详情面板垂直位置收口

- [x] 依据实时 Figma 节点 `797:490` 与详情字段节点 `986:18`，仅修改前端 `AdminPage`：新增 SQL Audit 专属说明面板样式，将详情面板从浏览器 `y=656.4` 对齐到目标 `y=674`；未修改 Figma 设计稿，也未删除业务状态圆点。
- [x] 浏览器视口为 `1440×1024`、DPR `1.0000000149011612`、字体状态为 `loaded`；调用表为 `1132×87px`，Payload 卡片为 `1132×321.4px`，SQL Audit 详情面板为 `1132×250px`，位于 `y=674`；页面无横向或纵向溢出，左上角窗口装饰候选数量为 `0`。
- [x] 最新 Figma PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-sql-audit-figma-live-2026-08-29.png`，浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-sql-audit-notes-offset-browser-2026-08-29-rgba.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-sql-audit-notes-offset-2026-08-29-diff.json`；结果为 `differentPixels=289598`、差异比例 `19.6396%`、`MAE=2.520686`、`RMSE=16.064298`、最大通道差异 `230`。
- [ ] 局部几何已收口，但侧栏身份、图标处理、字体和其它整页渲染差异仍存在；该画板继续为 `DIFF_REVIEW`，不能标记 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移未完成，iconfont 继续为 `BLOCKED`。

## 127. 2026-08-29 Admin User Detail 筛选行垂直对齐收口

- [x] 依据 Figma 节点 `801:215` 的筛选行基线，仅修改前端 `AdminPage.module.css`：将“重置筛选”按钮从继承的 `40px` 高度固定为 `32px`，使搜索、角色、状态、日期和重置控件统一对齐到 `y=88`；未修改 Figma 设计稿，也未删除业务状态圆点。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下实测：筛选行 `692×32px at x=284,y=88`，搜索 `187×32px`，两个选择器 `107×32px`，日期筛选 `191×32px`，重置按钮 `52×32px`，用户表 `692×278px at x=284,y=144`，详情面板 `420×912px at x=996,y=88`；页面无横向或纵向溢出，左上角窗口装饰候选数量为 `0`。
- [x] 最新浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-user-detail-filter-aligned-browser-2026-08-29-rgba.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-user-detail-filter-aligned-2026-08-29-diff.json`；结果为 `differentPixels=330836`、差异比例 `22.4363%`、`MAE=3.276996`、`RMSE=17.607226`、最大通道差异 `233`，相较修正前 `29.3546%` 的结果有所改善。
- [x] Admin 定向测试 `8/8` 通过；几何收口已验证，但侧栏身份、图标、字体、头像和其它整页渲染差异仍存在，因此该画板继续为 `DIFF_REVIEW`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移未完成，iconfont 继续为 `BLOCKED`。

## 128. 2026-08-29 Admin Deleted Resources 导航文案与窗口装饰复核

- [x] 依据实时 Figma 节点 `692:4104`，将管理后台活动导航项从“软删除资源”修正为 Figma 中的“删除资源”；仅修改前端 `AdminShared.tsx` 和对应测试，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149`、字体加载完成条件下复核活动导航文案为“删除资源”，页面无横向溢出；前端左上角红、黄、绿窗口装饰候选数量为 `0`，品牌标识和业务权限状态圆点保留。
- [x] 新增浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-deleted-resources-nav-copy-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-deleted-resources-nav-copy-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=401129`、差异比例 `27.2033%`、`MAE=4.14668`、`RMSE=21.24401`、最大通道差异 `230`，结论继续为 `DIFF_REVIEW`。
- [x] Deleted Resources 定向测试 `11/11` 通过；`npm run typecheck`、`npm run build` 和 `git diff --check` 通过。
- [ ] 本小点只收口导航文案和窗口装饰复核，不代表该画板或 105 张画板达到像素级 `PASS`；头像、整页表格密度、字体和图标光栅化仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 129. 2026-08-29 Admin Deleted Resources 表格行高与内描边收口

- [x] 依据实时 Figma 节点 `692:4205`、`692:4215`、`692:4216`、`692:4236`、`692:4256`、`692:4276`，将删除者列内容宽度恢复为 `120px`，使 `anddy_operator_9` 按设计稿换行；表格数据行实测为 `70px / 58px / 70px / 58px`，与 Figma 一致。
- [x] 仅修改前端 `AdminPage.module.css`：表格外框和行分隔线改用内描边，保持 `1116×304px` 表格容器、`1116×48px` 表头以及操作列布局；未修改 Figma 设计稿，也未删除业务状态圆点。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下复核：页面无横向溢出，前端左上角红、黄、绿窗口装饰候选数量为 `0`，表格容器为 `1116×304px`，删除者内容宽度为 `120px`。
- [x] 新增浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-deleted-resources-table-row-height-browser-2026-08-29.jpg`、RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-deleted-resources-table-row-height-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-deleted-resources-table-row-height-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=383969`、差异比例 `26.0396%`、`MAE=3.10932`、`RMSE=17.05253`、最大通道差异 `230`，相较前一份 `27.2033%` 的 MAE/RMSE 有所改善。
- [x] `DeletedResourcesTab.test.tsx` 与 `AdminPage.test.tsx` 定向测试 `11/11` 通过，`npm run typecheck` 和 `git diff --check` 通过；目标 CSS 的 Prettier 检查仍有既有格式提示，未扩大格式化范围。
- [ ] 本小点只完成删除资源表格局部几何收口；该画板和 105 张画板仍为 `DIFF_REVIEW`，不代表像素级 `PASS`，身份头像、字体、图标、shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 130. 2026-08-29 Admin SQL Audit 风险筛选器列宽收口

- [x] 重新读取实时 Figma 节点 `797:575`、`797:578`，确认筛选行目标为 `1132×32px`，风险筛选器为 `94×32px`、位于 `x=516`，搜索框为 `794×32px`、位于 `x=622`；仅修改前端 `AdminPage.tsx` 和 `AdminPage.module.css`，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下实测上述几何，页面无横向或纵向溢出；风险文案实际宽 `50.7px`、下拉图标约 `11.7×12px`，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 新增浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-sql-audit-risk-filter-browser-2026-08-29.jpg`、转换后的 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-sql-audit-risk-filter-browser-2026-08-29.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-sql-audit-risk-filter-2026-08-29-diff.json`；`png-diff.mjs` 结果为 `differentPixels=287694`、差异比例 `19.5105%`、`MAE=2.491523`、`RMSE=15.989531`、最大通道差异 `230`。
- [x] Admin 定向测试 `11/11`、`npm run typecheck` 和 `git diff --check` 通过；本次确认的前端窗口装饰候选数量仍为 `0`，业务权限状态圆点不变。
- [ ] 该小点只收口 SQL Audit 筛选行局部几何；画板和 105 张画板汇总仍为 `DIFF_REVIEW`，不标记像素级 `PASS`；shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 131. 2026-08-29 Admin Trace 下载链接样式收口

- [x] 依据实时 Figma 节点 `797:621`、`797:737`，仅修改前端 `AdminPage.module.css`：下载链接对齐为 `#5da9b2`、Noto Sans SC Regular、`13px`、带下划线；交互行为保持不变，未修改 Figma 设计稿。
- [x] 浏览器视口 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`；链接 computed style 为 `rgb(93, 169, 178)`、`font-weight: 400`、`text-decoration-line: underline`，位置和尺寸为 `78×16px at x=1318,y=278.5`；页面无横向或纵向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 新增浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-download-link-browser-2026-08-29.jpg`、RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-download-link-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-trace-download-link-2026-08-29-diff.json`；`png-diff.mjs` 同尺寸结果为 `differentPixels=366952`、差异比例 `24.8855%`、`MAE=2.733262`、`RMSE=15.432517`、最大通道差异 `230`，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成 Trace 下载链接局部样式收口，不代表该画板或 105 张画板达到像素级 `PASS`；侧栏身份、其它字体/图标和整页组合差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 132. 2026-08-29 Admin Trace 状态与时间线颜色收口

- [x] 依据实时 Figma 节点 `797:704`、`797:705`、`797:706`、`797:707`、`797:741`、`797:747`、`797:753`、`797:759`，仅修改前端 `AdminPage.tsx` 与 `AdminPage.module.css`：失败/成功筛选改为 Figma 色值和 `11px`，失败符号改为 `✖`，四个时间线标题改为 `#5da9b2`、`#b58cc4`、`#c79654`、`#d67676`；未修改 Figma 设计稿。
- [x] 浏览器 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`；工具栏 `1132×34px`，搜索框 `663.375×32px at x=476,y=89`，失败/成功筛选分别为 `64.1875×25px`、`72.4375×25px`，页面无横向或纵向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 新增浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-status-style-browser-2026-08-29.jpg`、RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-status-style-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-trace-status-style-2026-08-29-diff.json`；`png-diff.mjs` 同尺寸结果为 `differentPixels=365602`、差异比例 `24.79397%`、`MAE=2.713447`、`RMSE=15.377519`、最大通道差异 `230`，较前项 `24.8855%` 有所改善，结论继续为 `DIFF_REVIEW`。
- [x] Admin 定向测试 `8/8`、`npm run typecheck`、截图格式转换、JSON 解析和 `git diff --check` 已验证。
- [ ] 本小点只完成 Trace 状态和时间线颜色局部收口，不代表该画板或 105 张画板达到像素级 `PASS`；侧栏身份、其它字体/图标和整页组合差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 133. 2026-08-29 Admin Trace 运行记录表列轨道收口

- [x] 依据实时 Figma 节点 `797:712-731`，确认 Run 记录表目标列轨道为 `120px 120px minmax(0, 1fr) 110px 120px 90px 80px 80px`，列间距为 `12px`；前端 `AdminPage.module.css` 已完成对应调整，Figma 设计稿保持只读。
- [x] 浏览器使用 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`；Run 记录表实测为 `1132×87px at x=284,y=146`，状态列为 `110px at x=876`，阶段列为 `120px at x=998`，页面无横向或纵向溢出，左上角红黄绿窗口装饰候选数量为 `0`，业务权限状态圆点保留。
- [x] Figma PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-figma-live-2026-08-29.png`、浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-table-columns-browser-2026-08-29.jpg`、浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-trace-table-columns-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-trace-table-columns-2026-08-29-diff.json` 已登记；同尺寸结果为 `differentPixels=364747`、差异比例 `24.735989%`、`MAE=2.652009`、`RMSE=15.174374`、最大通道差异 `230`，结论为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 和 `figma-105-diff-results.json` 已同步最新证据；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，本次没有将局部几何修正标记为像素级 `PASS`。
- [x] Admin Trace 定向测试、JSON 解析、`npm run typecheck`、`npm run build` 和 `git diff --check` 已验证。
- [ ] 本小点只完成 Run 记录表列轨道局部几何收口；侧栏身份、其它字体/图标和整页组合差异仍需继续处理，shadcn 全页面视觉迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 134. 2026-08-29 Agent Write Confirmation 最新视觉证据收口

- [x] 依据实时 Figma 节点 `687:773`，将 `/chat?state=write-confirmation` 的映射切换到最新 Figma PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-write-confirmation-2026-08-29.png` 和浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-write-confirmation-browser-2026-08-29-rgba.png`；未修改 Figma 设计稿。
- [x] 最新浏览器运行时为 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded`、页面无横向溢出、文字越界 `0`；前端左上角红黄绿窗口装饰点数量为 `0`，业务状态圆点保持不变。
- [x] 写入确认卡实测为 `305×319px`，详情区为 `265×168px`，来源/假设为单行 `265×13px`，操作按钮为 `84×32px` 与 `58×32px`；确认与取消按钮不引入 Figma 不存在的图标，真实模式接口逻辑保持不变。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=275551`、差异比例 `18.6870%`、`MAE=2.020594`、`RMSE=13.143764`、最大通道差异 `232`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/chat-agent-write-confirmation.diff.json`，汇总锚点为 `figma-105-diff-results.json#agent-write-confirmation`。
- [x] `ChatPage` 定向测试 `27/27`、`npm run typecheck` 和 `git diff --check` 已通过；本项仅收口最新证据和局部卡片几何，不能标记像素级 `PASS`。
- [ ] 该画板继续为 `DIFF_REVIEW`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移和 iconfont 实体资源登记仍未完成，iconfont 继续为 `BLOCKED`。

## 135. 2026-08-29 Agent Budget Limit 最新视觉收口

- [x] 实时读取 Figma 节点 `687:918` 并保存参考图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-budget-limit-current-2026-08-29.png`；浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体 `loaded` 条件下保存 RGBA 证据 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-budget-limit-browser-2026-08-29-rgba.png`。
- [x] 预算卡局部几何已按 Figma 收口：卡片 `286×289px`，选择说明区 `246×60px`，Token 计量区 `246×27px`，进度条 `246×8px`，追加按钮 `150×32px`，结束按钮 `84×32px`；Figma 设计稿未修改。
- [x] 页面展示 `50,000 tokens`、`100%`、预计费用、追加预算和结束会话；fixture 追加动作继续明确当前 Run 语义，真实模式继续调用既有预算追加和取消接口；前端左上角红黄绿窗口装饰点数量为 `0`。
- [x] `scripts/png-diff.mjs` 同尺寸比较结果：`differentPixels=280814`、差异比例 `19.0439%`、`MAE=2.626395`、`RMSE=15.964083`、最大通道差异 `237`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/chat-agent-budget-limit.diff.json`，汇总锚点为 `figma-105-diff-results.json#agent-budget-limit`。
- [ ] 本页继续保持 `DIFF_REVIEW`，不能标记 `PASS`；周边工作台、头像、图标和字体光栅化仍存在可见差异，105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 136. 2026-08-29 Admin Tool Calls 说明面板位置对齐

- [x] 依据实时 Figma 节点 `797:359`、`986:11`，将 `/admin?state=tool-calls` 的说明面板从浏览器 `y=656.4px` 对齐到 Figma 目标 `y=674px`，面板保持 `1132×250px`；仅修改前端，未修改 Figma。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体已加载、页面无横向或纵向溢出；工具调用表保持 `1132×87px`，payload 卡保持 `1132×321.4px`，左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 独立证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-tool-calls-detail-spacing-browser-2026-08-29-rgba.png` 和 `admin-tool-calls-detail-spacing-2026-08-29-diff.json`；同尺寸 PNG diff 为 `19.4094% / MAE 2.451875 / RMSE 15.818763 / maxChannelDelta 230`，映射和聚合结果已更新。
- [x] Admin 定向测试 `8/8`、`npm run typecheck` 和 `git diff --check` 通过；目标文件 Prettier 检查仍受文件原有格式问题影响，未扩大格式化范围。
- [ ] 该画板及 105 张画板仍为 `DIFF_REVIEW`；侧栏身份、图标、字体和其他整页视觉差异仍需继续收口，iconfont 实体登记继续为 `BLOCKED`。

## 140. 2026-08-29 Agent Chat 消息操作说明补充证据

- [x] 重新核对 Figma 节点 `640:428` 与前端 Chat fixture：主 105 画板入口继续是 `/chat?state=figma-v2`；本次消息操作面板局部证据使用 `/chat?state=redesign-default`，两者没有混用。
- [x] 前端消息操作面板从三行补齐为四行，新增右侧运行、工具、引用以及原始 JSON 默认折叠和敏感参数隐藏说明；定向测试已增加对应断言。
- [x] Figma 参考图 `agent-chat-v2-figma-live-2026-08-29.png` 与浏览器图 `agent-chat-v2-message-actions-browser-2026-08-29.png` 均为 `1440×1024`；`png-diff.mjs` 结果为 `differentPixels=347426`、差异比例 `23.5613%`、`MAE=2.557491`、`RMSE=14.877245`、最大通道差异 `234`，独立结果为 `agent-chat-v2-message-actions-2026-08-29-diff.json`，保持 `DIFF_REVIEW`。
- [x] 前端左上角红、黄、绿窗口装饰候选数量为 `0`；该项只核验前端，不修改 Figma，业务状态圆点继续保留。
- [ ] 本补充证据不能关闭 `agent-chat-v2` 或 105 张画板的像素级 `PASS`；主映射仍以 `state=figma-v2` 为准，整体汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 141. 2026-08-29 Intake Analysis 最新浏览器证据登记

- [x] 将 `/analysis?state=v2` 的最新浏览器帧由 JPEG 字节规范化为真正的 RGBA PNG，并登记到 `figma-105-mapping.json`；Figma 节点为 `640:773`，两侧尺寸均为 `1440×1024`。
- [x] 最新证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/intake-analysis-v2-current.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-browser-live-2026-08-29.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/intake-analysis-v2-live-2026-08-29-diff.json`；结果为 `differentPixels=406120`、差异比例 `27.5418%`、`MAE=2.49371`、`RMSE=14.13255`、最大通道差异 `234`。
- [x] `AnalysisPage` 定向测试 `5/5`、`npm run typecheck`、PNG 格式检查、`png-diff.mjs`、105 画板映射重生成和 `git diff --check` 已通过；前端左上角红、黄、绿窗口装饰候选数量为 `0`，Figma 设计稿未修改。
- [ ] 该画板仍为 `DIFF_REVIEW`，不能以截图尺寸和几何通过替代像素级 `PASS`；剩余差异主要涉及字体、图标、头像和整页光栅化，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 142. 2026-08-29 Meal Planning 最新 DPR1 证据登记

- [x] 重新核对 Figma 节点 `640:901` 与当前 `/planning?state=v2` 前端；主映射切换到最新 `1440×1024` Figma 参考与 DPR1 浏览器 RGBA PNG，未修改 Figma 设计稿。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-browser-dpr1-2026-08-29-rgba.png`，Figma 参考为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/meal-planning-v2-current.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/meal-planning-v2-live-2026-08-29-diff.json`，结果为 `differentPixels=344334`、差异比例 `23.3516%`、`MAE=2.40087`、`RMSE=13.73344`、最大通道差异 `234`。
- [x] 已确认计划横幅 `776×97px`、两个操作按钮 `88×37px`、右栏边界 `x=1100,width=340px`、右栏内容 `x=1124,width=292px`；浏览器 PNG 与 Figma PNG 尺寸一致，前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保留。
- [x] `PlanningPage` 定向测试、PNG 尺寸/签名检查、`png-diff.mjs` 和 `git diff --check` 已执行；本次没有发现新的可证实 CSS 几何差异，因此没有盲目修改页面样式。
- [ ] 该画板仍为 `DIFF_REVIEW`，不能因差异比例改善标记 `PASS`；字体、图标、头像及整页视觉差异仍需后续人工复核，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 143. 2026-08-29 Admin Overview 顶栏横向内边距收口

- [x] 重新读取 Figma 节点 `995:1044`、`995:1045`、`995:1049`，确认桌面顶栏内容左右内边距均为 `32px`；前端 `.topbar` 已从 `16px 24px` 调整为 `16px 32px`，移动端媒体查询保持原有 `16px`，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下复核：顶栏 `1180×64px`，标题区域 `160×24px at x=292,y=19.6`，右侧操作区 `192.6×32px at x=1215.4,y=15.6`，刷新按钮 `85.6×32px at x=1322.4,y=15.6`；页面无横向/纵向溢出。
- [x] 前端左上角红、黄、绿窗口装饰候选数量为 `0`；本次没有删除业务状态圆点，也没有修改 Figma。
- [x] 真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-topbar-padding-browser-2026-08-29.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/admin-overview-topbar-padding-2026-08-29-diff.json`；`png-diff.mjs` 结果为 `differentPixels=493936`、差异比例 `33.4972%`、`MAE=3.988667`、`RMSE=19.207800`、最大通道差异 `230`，MAE/RMSE 较旧证据改善，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 与 `figma-105-diff-results.json` 已同步新的浏览器证据；Admin 定向测试 `9/9`、`npm run typecheck` 和 `git diff --check` 已通过。
- [ ] 本小点只完成 Admin Overview 顶栏局部几何收口，不代表该画板或 105 张画板达到像素级 `PASS`；整页字体、图标、侧栏身份、表格/卡片和摘要区差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 144. 2026-08-29 Admin Overview 分析卡内卡高度与裁切收口

- [x] 依据实时 Figma 节点 `1005:2`、`1005:3`、`1005:7`、`1005:11`，将前端底部三个分析内卡高度从 `148px` 调整为 `180px`，并为 `1116×180px` 外层分析卡补齐 `overflow: hidden` 裁切；未修改 Figma 设计稿，业务权限状态圆点保留。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下实测外框 `1116×180px at x=292,y=766`，三个内卡高度均为 `180px`；页面无横向或纵向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] 实时 Figma PNG 与浏览器 RGBA PNG 尺寸均为 `1440×1024`；`png-diff.mjs` 结果为 `differentPixels=496400`、差异比例 `33.6643%`、`MAE=3.932245`、`RMSE=19.178615`、最大通道差异 `230`，结论继续为 `DIFF_REVIEW`。
- [x] Admin 定向测试 `9/9` 通过；未将整页仍存在的字体、图标、侧栏身份、表格和其它组合差异误标为像素级 `PASS`。
- [ ] 本小点只完成分析卡局部几何收口，不代表 105 张画板像素级 `PASS`、shadcn 全页面迁移或 iconfont 实体资源登记完成；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 继续为 `BLOCKED`。

## 145. 2026-08-29 Admin Overview 主表列轨道收口

- [x] 依据实时 Figma 节点 `995:1053`、`995:1085`，确认主表目标为 `1116×396px`，表头 `48px`、六条数据行各 `58px`；前端 `AdminPage.module.css` 已将表头和数据行列轨道统一为 `196px 96px 116px 116px 116px 156px 84px 84px 64px 88px`，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下复核，表格为 `1116×396px at x=292,y=346`，页面无横向或纵向溢出，前端左上角红、黄、绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] 新增浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-table-columns-browser-2026-08-29.jpg`、RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-table-columns-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-overview-table-columns-2026-08-29-diff.json`；实时 Figma PNG 与浏览器 PNG 均为 `1440×1024`，`png-diff.mjs` 结果为 `differentPixels=495686`、差异比例 `33.6159%`、`MAE=4.139174`、`RMSE=19.694850`、最大通道差异 `230`。
- [x] `figma-105-mapping.json` 的 Admin Overview 主证据已指向本次最新浏览器 PNG；分析卡高度和顶栏内边距证据继续保留在 `additionalVisualEvidence`，105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成主表列轨道局部几何收口，不代表 Admin Overview 或 105 张画板达到像素级 `PASS`；字体、图标、侧栏身份和其它整页组合差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 146. 2026-08-29 Admin Overview 桌面表格滚动条收口

- [x] 依据实时 Figma 节点 `995:1085`，确认桌面表格卡片目标为 `1116×396px`，前端将占用内容宽度的 1px 边框改为等效内描边；视觉边界仍为 `#f4f6f5`，未修改 Figma 设计稿。
- [x] 严格浏览器视口 `1440×1024`、DPR `1.0000000149011612`、字体加载完成条件下，表格卡片保持 `1116×396px at x=292,y=266`，可视区与内容区均为 `1116px`，`scrollWidth === clientWidth`，设计稿不存在的桌面横向滚动条已消除；页面无横向或纵向溢出，左上角红、黄、绿窗口装饰候选数量为 `0`。
- [x] `390×844` 窄视口复核通过：表格可视区约 `343px`、内容区 `1116px`，内部横向滚动仍保留，`body.clientWidth === body.scrollWidth === 390px`。
- [x] 新增浏览器原始截图 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-table-border-inset-browser-2026-08-29.png`、RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-table-border-inset-browser-2026-08-29-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/admin-overview-table-border-inset-2026-08-29-diff.json`；同尺寸结果为 `differentPixels=486020`、差异比例 `32.9603%`、`MAE=3.566176`、`RMSE=18.049821`、最大通道差异 `230`，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 的 Admin Overview 主证据已切换到本次最新 RGBA PNG，主表列轨道、分析卡高度和顶栏内边距仍保留在补充证据中；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只消除桌面表格非设计滚动条，不代表表格行高、Admin Overview 或 105 张画板达到像素级 `PASS`；当前表格行内容高度仍需按 Figma 的六条 `58px` 数据行继续收口，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 147. 2026-08-29 Admin Overview 主表数据行高度收口

- [x] 依据 Figma 节点 `995:1053`、`995:1085`，将前端 Admin Overview 主表表头保持为 `48px`，六条数据行从 `55px` 调整为 `58px`，桌面表格总高精确为 `396px`；未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149011612`、字体状态 `loaded` 下实测表头 `48px`、六条数据行均为 `58px`、表格和卡片均为 `1116×396px`；页面无横向/纵向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] `390×844` 窄视口实测表格可视区约 `343px`、内容区 `1116px`，内部横向滚动仍保留，页面宽度 `390px`，未产生页面级横向溢出。
- [x] 已登记浏览器原始 JPEG、RGBA PNG 和独立 diff JSON；同尺寸结果为 `differentPixels=472888`、差异比例 `32.0698%`、`MAE=2.946841`、`RMSE=15.766627`、最大通道差异 `230`，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 主证据、`figma-105-diff-results.json` 和运行时几何证据已同步；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 Admin Overview 主表行高局部几何收口，不代表 Admin Overview 或 105 张画板达到像素级 `PASS`；整页字体、图标、侧栏身份等差异、shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 148. 2026-08-29 Admin Overview 侧栏导航图标资产收口

- [x] 依据实时 Figma 节点 `995:977`、`995:978`、`995:987`、`995:988-995:1031`，确认侧栏导航使用 9 个唯一 `18×18` SVG 资产，并按设计稿复用关系覆盖 11 个导航项；Figma 设计稿未修改。
- [x] 前端新增 `foodmate-ui/public/assets/figma/admin/navigation/` 下的 `overview.svg`、`users.svg`、`runs.svg`、`tools.svg`、`sql.svg`、`trace.svg`、`knowledge.svg`、`deleted.svg`、`audit.svg`；`SQL 审计/模型用量` 复用 `sql.svg`，`Trace/工具注册表` 复用 `trace.svg`。
- [x] 浏览器在 `1440×1024` 与 `390×844`、DPR `1.0000000149011612`、字体加载完成条件下复核：11 个图标均为 `18×18`，移动端导航文字折叠但图标保持可见；页面无横向溢出，资源加载失败数为 `0`，左上角红黄绿窗口装饰候选数量为 `0`，业务权限状态圆点保留。
- [x] 同尺寸 `png-diff.mjs` 结果为 `differentPixels=472595`、差异比例 `32.0499%`、`MAE=2.965224`、`RMSE=15.923452`、最大通道差异 `230`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/admin-overview-navigation-2026-08-29-diff.json`，浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-navigation-browser-2026-08-29.png`，画板继续为 `DIFF_REVIEW`。
- [x] `AdminPage.test.tsx` `10/10`、`npm run typecheck`、`npm run build` 和 `git diff --check` 已验证；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成侧栏导航图标资产替换和移动端响应式修正，不代表 Admin Overview 或 105 张画板达到像素级 `PASS`；字体、侧栏身份和其它整页差异仍需继续收口，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。
## 149. 2026-08-29 Admin Overview 筛选栏图标资产收口

- [x] 实时 Figma 节点 `995:1054` 的筛选栏包含 `116×32`、`116×32`、`142×32` 三个 Select 和 `280×32` 搜索框；前端已使用 `dropdown-arrow.svg` 和 `search.svg` 两个真实 Figma SVG 资产，Radix 默认箭头仅被隐藏，Select 行为保持不变。
- [x] 浏览器 `1440×1024`、DPR `1.0000000149011612`、字体已加载：下拉箭头为 `3×12×12`，搜索图标为 `16×16`，页面无横向溢出。`390×844` 移动截图也已生成，实际页面宽度为 `390px`；打开“结果筛选”并选择 `failed` 后显示两条失败记录。
- [x] 前端左上角红、黄、绿窗口装饰候选数量桌面/移动均为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] 独立证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-filter-icons-browser-1440x1024-2026-08-29-rgba.png`、`admin-overview-filter-icons-browser-390x844-2026-08-29-rgba.png` 和 `admin-overview-filter-icons-2026-08-29-diff.json`；同尺寸 `png-diff.mjs` 结果为 `differentPixels=862029`、差异比例 `58.4601%`、`MAE=3.634867`、`RMSE=17.215182`、最大通道差异 `230`，结论为 `DIFF_REVIEW`。
- [x] Admin 定向测试 `11/11`、目标文件 Prettier、`npm run typecheck`、`npm run build` 与本次改动 `git diff --check` 已通过；仓库级 `format:check` 仍被既有无关文件阻断。
- [ ] 本小点只完成筛选栏图标资产收口，不关闭 Admin Overview 或 105 张画板像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 150. 2026-08-30 Agent User Cancelled 取消态布局边界收口

- [x] 依据 Figma 节点 `687:1684`，将取消态外层扩展为主对话内容区 `1116px`，取消提示条按主区居中；助手行保持 `608px`，助手气泡保持 `560px`，提示条固定为 `222.725×30px`。
- [x] 浏览器实测 `1440×1024`、DPR `1.0000000149011612`、字体加载完成：助手行 `x=292,y=237,width=608,height=52`，气泡 `x=340,width=560`，取消提示条 `x=738.64,y=310,width=222.725,height=30`；页面无横向溢出，左上角红黄绿窗口控制点为 `0`，业务状态圆点保留，Figma 设计稿未修改。
- [x] `390×844` 移动端实测助手行 `x=16,width=343.2`、气泡 `x=64,width=295.2`、取消提示条 `x=76.24,y=344.8,width=222.725,height=30`，页面无横向溢出。
- [x] 新增浏览器原始 JPEG、RGBA PNG 和独立 diff：`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-aligned-browser-1440x1024-2026-08-30-rgba.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-aligned-browser-390x844-2026-08-30-rgba.png`、`foodmate-ui/.qa/figma-pixel-acceptance/agent-user-cancelled-aligned-2026-08-30-diff.json`；同尺寸结果为 `differentPixels=303295`、差异比例 `20.5685%`、`MAE=2.43150`、`RMSE=14.50891`、最大通道差异 `249`，结论继续为 `DIFF_REVIEW`。
- [x] ChatPage 定向测试 `27/27` 通过；新增回归断言覆盖取消态主区宽度、助手行宽度和提示条布局契约。前端已确认不存在 `window-controls`、`traffic-light` 或三色窗口装饰候选。
- [ ] 本小点只完成取消态局部几何收口，不代表该画板或 105 张画板达到像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 153. 2026-08-30 Agent Chat 侧栏选中态背景色收口

- [x] 依据 Figma 节点 `640:428`，将 `/chat?state=figma-v2` 侧栏 `Agent 对话` 选中态背景对齐为 `#FBF7F2`，当前会话行背景对齐为 `#FFFCF9`；仅修改前端 `.designChat` 语义变量，未修改 Figma 设计稿。
- [x] 浏览器实测视口 `1440×1024`、字体状态 `loaded`、侧栏选中态实际为 `rgb(251, 247, 242)`、当前会话行实际为 `rgb(255, 252, 249)`；页面无横向/纵向溢出，前端左上角红黄绿窗口装饰候选为 `0`，业务状态圆点保留。
- [x] 已登记浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-selection-surfaces-browser-2026-08-30-rgba.png`、Figma 参考 `docxs/设计/figma-png/agent-chat-v2.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-selection-surfaces-2026-08-30-diff.json`；该历史局部证据保持 `DIFF_REVIEW`。
- [x] `WorkspaceLayout.test.tsx` 定向测试 `8/8`、`npm run typecheck`、`npm run build` 和 `git diff --check` 已通过；映射主证据和 `figma-105-diff-results.json` 已同步，最新采集实际 DPR 为 `1.25`，不满足严格 DPR 1 的像素 `PASS` 门禁。
- [ ] 本小点只完成 Agent Chat 侧栏两个选中态背景色的局部收口，不代表该画板或 105 张画板达到像素级 `PASS`；整页头像、字体、图标和光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 154. 2026-08-30 Agent Chat 顶部导航选中态颜色收口

- [x] 依据 Figma 节点 `640:428`，将 `/chat?state=figma-v2` 顶部“工作台”选中态背景从旧的 `#FFFEFA` 收口为目标 `#FFFEFC`；同时保留侧栏和会话行的独立语义 Token，未修改 Figma 设计稿。
- [x] 浏览器实测视口 `1440×1024`、字体状态 `loaded`、顶部导航选中态实际为 `rgb(255, 254, 252)`；页面无横向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`，业务状态圆点保留。
- [x] 已登记原始 JPEG、转换后的 PNG 和独立 diff：`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-top-nav-active-surface-browser-2026-08-30.jpg`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-top-nav-active-surface-browser-2026-08-30-rgba.png`、`foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-top-nav-active-surface-2026-08-30-diff.json`；`png-diff.mjs` 结果为 `differentPixels=598653`、差异比例 `40.5988%`、`MAE=4.608837`、`RMSE=20.508797`、最大通道差异 `255`，结论继续为 `DIFF_REVIEW`。
- [x] `WorkspaceLayout.test.tsx` 定向测试 `8/8` 通过；顶部导航和页面 DOM 均确认不存在 `window-controls`、`traffic-light` 或红黄绿窗口装饰候选。
- [ ] 本小点只完成顶部导航选中态颜色收口，不代表该画板或 105 张画板达到像素级 `PASS`；DPR 为 `1.25`，整页头像、字体、图标和光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 155. 2026-08-30 前端左上角窗口装饰核验

- [x] 按用户要求只检查前端，不修改 Figma 设计稿；Figma 参考图中的红、黄、绿三色窗口点保持为设计来源内容，前端不复制该装饰。
- [x] 对 `foodmate-ui` 生产源码与静态资源中的 `window-controls`、`traffic-light`、macOS 三色值和等价 RGB 值执行全量扫描，结果为 `NO_FRONTEND_PRODUCTION_WINDOW_DECORATION_MARKERS`。
- [x] `/chat?state=figma-v2` 在 `1440×1024` 运行时检查 `windowControls=0`、`redYellowGreen=0`；现有 `WorkspaceLayout.test.tsx` 也断言不渲染窗口控制节点，业务状态圆点保持不变。
- [ ] 当前没有可删除的前端左上角红黄绿装饰代码；本小点不影响 105 张画板 `DIFF_REVIEW`、shadcn 全页面迁移或 iconfont `BLOCKED` 状态。

## 156. 2026-08-30 Diet Records 默认态操作栏结构收口

- [x] 依据 Figma 节点 `640:588`，将 `/analysis?view=records&state=v2` 默认 fixture 恢复为餐次卡下方的“记录一餐”和“分析这一天”操作栏，并移除 Figma 画板中不存在的额外“记录详情”大面板；仅修改前端，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×1024` 下实测操作栏为 `x=292,y=640,width=1116,height=48`；“记录一餐”为 `140×40`，“分析这一天”为 `164×40`；详情面板未渲染，页面无横向溢出，字体已加载，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] `DietRecordsPage` 定向测试为 `10/10`；浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/diet-records-v2-action-bar-browser-2026-08-30-rgba.png`，独立 diff 为 `diet-records-v2-action-bar-2026-08-30-diff.json`。同尺寸 `png-diff.mjs` 结果为 `differentPixels=527661`、差异比例 `35.7843%`、`MAE=2.681890`、`RMSE=15.511048`、最大通道差异 `234`。
- [ ] 当前采集实际 DPR 为 `1.25`，严格 DPR 1 门禁未通过；字体、图标、头像和周边工作台组合差异仍存在，结论保持 `DIFF_REVIEW`，不能标记像素级 `PASS`。105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 157. 2026-08-30 注册页 Figma 色彩 Token 收口

- [x] 依据 Figma 节点 `680:216`，将 `/register` 的斜切背景从前端 `#dfeedb` 收口为 `#c5f0d6`，并将品牌标记与主按钮从 `#a6d997` 收口为 `#48c78e`；通过 `AuthShell` 的语义变量传递，其他认证页面保持原有 Token，未修改 Figma 设计稿。
- [x] 浏览器在 `1440×900`、DPR `1.0000000149011612`、字体 `loaded` 条件下验证：根节点 `1440×900`，认证卡片 `x=490,y=34.4,width=460,height=831.2`，内容宽 `380px`，首个输入框 `x=530,y=235.2,width=380,height=50`，无页面横向溢出，前端左上角红黄绿窗口装饰候选数量为 `0`。
- [x] `AuthPages.test.tsx` 定向测试为 `21/21`；浏览器 RGBA 证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/register-page-browser-2026-08-30-rgba.png`，Figma 参考为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/register-page-latest.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/register-page-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=1281714`、差异比例 `98.8977%`、`MAE=5.1327166`、`RMSE=12.1961723`、最大通道差异 `204`；该结果仍受浏览器截图 JPEG 转码和文字/图标光栅化影响，已同步 `figma-105-mapping.json` 与 `figma-105-diff-results.json#register-page`。
- [ ] 注册画板继续保持 `DIFF_REVIEW`，本次只关闭可测量的 Figma 色彩 Token 差异，不代表整页像素级 `PASS`；105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 158. 2026-08-30 找回密码页品牌强调色 Token 收口

- [x] 依据 Figma 节点 `680:275`，将 `/forgot-password` 的品牌标记强调色通过 `AuthShell` 语义变量收口为 `#48c78e`；仅修改前端，未修改 Figma 设计稿，也未改变 Token 状态页的独立覆盖。
- [x] `AuthPages.test.tsx` 新增找回密码页强调色回归断言，先验证 `1 failed / 21 passed`，实现后定向测试为 `22/22`；真实密码找回接口和成功提示交互保持不变。
- [x] 浏览器在 `1440×900` 视口实测根节点 `1440×900`、字体状态 `loaded`、页面无横向溢出，`--auth-accent: #48c78e`，前端左上角 `window-controls`/`traffic-light` 候选数量为 `0`；实际浏览器 DPR 为 `1.25`，严格 DPR 1 门禁未通过。
- [x] 浏览器原始捕获与转换后的 RGBA PNG 已登记：`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/forgot-password-page-browser-2026-08-30.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/forgot-password-page-browser-2026-08-30-rgba.png`；Figma 参考为 `docxs/设计/figma-png/forgot-password-page.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/forgot-password-page-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=1295141`、差异比例 `99.9337%`、`MAE=1.122291`、`RMSE=6.930499`、最大通道差异 `203`；映射和聚合 diff 已同步，结果继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成找回密码页品牌色 Token 收口，不代表该画板或 105 张画板达到像素级 `PASS`；DPR、字体/图标光栅化和整页视觉差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 159. 2026-08-30 重置密码页品牌强调色 Token 收口

- [x] 依据 Figma 节点 `680:307`，将 `/reset-password` 的品牌标记强调色通过 `AuthShell` 语义变量收口为 `#48c78e`；仅修改前端，未修改 Figma 设计稿，也未改变密码强度、token 缺失保护和真实提交接口。
- [x] `AuthPages.test.tsx` 新增重置密码页强调色回归断言，先验证 `1 failed / 22 passed`，实现后定向测试为 `23/23`；现有密码可见性、强度展示和返回登录交互保持不变。
- [x] 浏览器在 `1440×900` 视口实测根节点 `1440×900`、字体状态 `loaded`、页面无横向溢出，`--auth-accent: #48c78e`，前端左上角 `window-controls`/`traffic-light` 候选数量为 `0`；实际浏览器 DPR 为 `1.25`，严格 DPR 1 门禁未通过。
- [x] 浏览器原始捕获与转换后的 RGBA PNG 已登记：`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/reset-password-page-browser-2026-08-30.png`、`foodmate-ui/.qa/figma-pixel-acceptance/recaptured/reset-password-page-browser-2026-08-30-rgba.png`；Figma 参考为 `docxs/设计/figma-png/reset-password-page.png`，独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/reset-password-page-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=1284884`、差异比例 `99.1423%`、`MAE=1.643792`、`RMSE=11.583254`、最大通道差异 `212`；映射和聚合 diff 已同步，结果继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成重置密码页品牌色 Token 收口，不代表该画板或 105 张画板达到像素级 `PASS`；DPR、字体/图标光栅化和整页视觉差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 160. 2026-08-30 Workspace Home 移除非设计说明面板

- [x] 依据 Figma 节点 `640:256`，移除前端额外渲染的“任务入口与状态”实现说明面板；该面板不属于设计稿可见内容。活跃会话和待确认队列等业务内容保持不变，Figma 设计稿未修改。
- [x] 浏览器定向测试 `4/4` 通过；`1440×1024` 截图的正文标题、快捷操作和指标卡仍存在，说明面板不存在，页面 `body` 与 `main` 均无横向溢出。
- [x] 有效浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/workspace-home-v2-no-status-panel-browser-2026-08-30-rgba.png`；原始浏览器捕获已按真实 JPEG 格式登记为同目录下的 `.jpg`，避免伪装为 PNG。Figma 参考为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/workspace-home-v2-figma.png`，独立 diff 为 `workspace-home-v2-no-status-panel-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=554164`、差异比例 `37.5817%`、`MAE=3.236364`、`RMSE=17.110668`、最大通道差异 `253`；该画板继续保持 `DIFF_REVIEW`，没有将局部结构修正标记为像素级 `PASS`。
- [ ] 本小点只移除 Figma 不存在的前端实现说明面板，不代表 Workspace Home、105 张画板或 shadcn 全页面迁移完成；iconfont 实体资源登记继续为 `BLOCKED`。

## 161. 2026-08-30 Agent Write Confirmation 当前运行证据收口

- [x] 重新启动前端并在 `1440×1024` 视口采集 `/chat?state=write-confirmation`；当前运行时确认写入卡片为 `305×319px`、位置为 `x=340,y=237`，详情区为 `265×168px`，与已登记 Figma 节点 `687:773` 的紧凑卡片结构一致。
- [x] 真实浏览器截图不再使用旧的宽卡片证据；有效 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-write-confirmation-compact-browser-2026-08-30-rgba.png`，原始捕获按 JPEG 格式登记为同目录下的 `.jpg`，Figma 参考保持 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured-figma/agent-write-confirmation-2026-08-29.png`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=247917`、差异比例 `16.8129%`、`MAE=1.844870`、`RMSE=13.046592`、最大通道差异 `232`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-write-confirmation-compact-2026-08-30-diff.json`，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只更新当前前端运行证据并确认紧凑卡片几何，不代表 Agent Write Confirmation、105 张画板或 shadcn 全页面迁移达到像素级 `PASS`；iconfont 实体资源登记继续为 `BLOCKED`。

## 162. 2026-08-30 Workspace Home 侧栏结构收口

- [x] 依据 Figma 节点 `640:256`，首页 Figma fixture 隐藏不属于该画板的会话搜索、会话历史列表和分页，仅保留“Agent 对话”入口；通过 `WorkspaceLayout.hideSessionHistory` 与 `SidebarSessionList.showHistory` 控制，真实模式会话历史行为不变。仅修改前端，未修改 Figma 设计稿。
- [x] 首页与工作区定向测试共 `12/12` 通过；`1440×1024` 运行时确认 `sessionSearch=false`、`sessionItems=0`、`sessionPagination=false`、`agentConversationLink=true`、`windowControls=false`、`trafficLightColors=0`，`390×844` 结构检查同样无页面溢出。
- [x] 有效浏览器 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/workspace-home-v2-sidebar-pruned-browser-2026-08-30-rgba.png`，原始浏览器捕获为真实 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/workspace-home-v2-sidebar-pruned-browser-2026-08-30.jpg`；移动端捕获为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/workspace-home-v2-sidebar-pruned-browser-390x844-2026-08-30.jpg`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=550655`、差异比例 `37.3437%`、`MAE=3.926901`、`RMSE=19.640692`、最大通道差异 `253`；映射、运行时检查和独立 diff JSON 已同步，结论继续为 `DIFF_REVIEW`。
- [x] 前端生产源码全量检查没有发现左上角红、黄、绿窗口装饰节点或颜色标记；业务状态圆点不属于该装饰，保持不变。
- [ ] 本小点只完成首页侧栏结构和证据格式收口，不代表 Workspace Home、105 张画板达到像素级 `PASS`，也不代表 shadcn 全页面迁移或 iconfont 实体资源登记完成；iconfont 继续为 `BLOCKED`。

## 163. 2026-08-30 Agent Planning 当前前端截图与窗口装饰收口

- [x] 依据 Figma 节点 `687:342`，重新采集 `/chat?state=planning` 的当前前端页面；主区 `1180px`、Planning 卡 `x=340,y=237,width=165,height=160`、用户消息 `x=1132,y=145,width=228,height=49`、Composer `y=912,height=112`，页面无横向或纵向溢出。
- [x] 当前浏览器截图确认左上角红、黄、绿窗口装饰点数量为 `0`；该检查只针对前端，未修改 Figma 设计稿，业务状态圆点和用户头像不作误删。
- [x] 主浏览器证据已切换为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-planning-window-controls-pruned-browser-2026-08-30-rgba.png`，原始 JPEG 为同目录下的 `agent-planning-window-controls-pruned-browser-2026-08-30.jpg`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-planning-window-controls-pruned-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=269822`、差异比例 `18.2985%`、`MAE=2.215929`、`RMSE=13.810469`、最大通道差异 `241`；相较旧证据 `19.0926% / RMSE 15.607428` 有改善，但结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成 Agent Planning 的当前证据和前端窗口装饰核验，不代表该画板或 105 张画板达到像素级 `PASS`；默认头像、图标和字体光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 164. 2026-08-30 Agent Tool Executing 当前前端截图与窗口装饰收口

- [x] 依据 Figma 节点 `687:475`，重新采集 `/chat?state=tool-executing` 的当前前端页面；主区 `860px`、Trace 区 `320px`、工具执行卡 `x=340,y=237,width=181,height=250`、Composer `x=260,y=912,width=860,height=112`，页面无横向或纵向溢出。
- [x] 当前浏览器截图确认左上角红、黄、绿窗口装饰点数量为 `0`；该检查只针对前端，未修改 Figma 设计稿，业务状态圆点和默认头像不作误删。
- [x] 主浏览器证据已切换为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-tool-executing-window-controls-pruned-browser-2026-08-30-rgba.png`，原始 JPEG 为同目录下的 `agent-tool-executing-window-controls-pruned-browser-2026-08-30.jpg`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-tool-executing-window-controls-pruned-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=334780`、差异比例 `22.7037%`、`MAE=2.846537`、`RMSE=15.945549`、最大通道差异 `249`；相较旧证据 `23.4617% / RMSE 16.960477` 有改善，但结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成 Agent Tool Executing 的当前证据和前端窗口装饰核验，不代表该画板或 105 张画板达到像素级 `PASS`；默认头像、图标和字体光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 165. 2026-08-30 Agent Awaiting Clarification 当前前端截图与窗口装饰收口

- [x] 依据 Figma 节点 `687:642`，重新采集 `/chat?state=awaiting-clarification` 的当前前端页面；主区 `1180px`、用户消息 `x=1216,y=145,width=144,height=49`、澄清助手行 `x=292,y=237,width=1116,height=193`、Composer `x=260,y=912,width=1180,height=112`，页面无横向或纵向溢出。
- [x] 当前浏览器截图确认左上角红、黄、绿窗口装饰点数量为 `0`；该检查只针对前端，未修改 Figma 设计稿，业务状态圆点和默认头像不作误删。
- [x] 主浏览器证据已切换为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-awaiting-clarification-window-controls-pruned-browser-2026-08-30-rgba.png`，原始 JPEG 为同目录下的 `agent-awaiting-clarification-window-controls-pruned-browser-2026-08-30.jpg`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-awaiting-clarification-window-controls-pruned-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=289019`、差异比例 `19.6004%`、`MAE=2.473502`、`RMSE=14.802080`、最大通道差异 `250`；当前证据用于替代过期截图，结论继续为 `DIFF_REVIEW`。
- [ ] 本小点只完成 Agent Awaiting Clarification 的当前证据和前端窗口装饰核验，不代表该画板或 105 张画板达到像素级 `PASS`；默认头像、图标和字体光栅化差异仍需继续处理，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 166. 2026-08-30 Agent Budget Limit 当前运行证据复核

- [x] 重新打开 `/chat?state=budget-limit` 并在 `1440×1024` 视口采集当前前端；预算卡 `x=340,y=314,width=286,height=289`，选择说明区 `246×60px`，Token 计量区 `246×27px`，追加按钮 `150×32px`，结束按钮 `84×32px`。
- [x] 页面展示 `50,000 tokens`、`100%`、预计费用、追加预算和结束会话；字体状态为 `loaded`，页面无横向或纵向溢出；前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 原始浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-budget-limit-current-browser-2026-08-30.jpg`，转换后的真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-budget-limit-current-browser-2026-08-30-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-budget-limit-current-browser-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=350748`、差异比例 `23.7866%`、`MAE=3.437230`、`RMSE=17.809802`、最大通道差异 `254`；实际浏览器 DPR 为 `1.25`，不满足严格 DPR 1 门禁，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步当前证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成预算上限页当前运行证据复核，不代表该画板或 105 张画板达到像素级 `PASS`；周边工作台、头像、图标和字体光栅化仍有差异，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 167. 2026-08-30 Agent Tool Failed Retryable 当前运行证据复核

- [x] 重新打开 `/chat?state=tool-failed-retryable` 并在 `1440×1024` 视口采集当前前端；失败卡为 `x=340,y=237,width=560,height=160`，说明区域为 `x=360.8,y=293.8,width=518.4,height=44`，重试与跳过按钮分别为 `58×32px` 和 `97×32px`。
- [x] 页面展示数据库查询超时、错误码 `TOOL_TIMEOUT_001`、外部知识库不可用原因，以及“重试”和“跳过此步骤”两个操作；字体状态为 `loaded`，页面无横向或纵向溢出；前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 原始浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-tool-failed-retryable-current-browser-2026-08-30.jpg`，转换后的真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-tool-failed-retryable-current-browser-2026-08-30-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-tool-failed-retryable-current-browser-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=358349`、差异比例 `24.3021%`、`MAE=3.098139`、`RMSE=16.594073`、最大通道差异 `253`；实际浏览器 DPR 为 `1.25`，不满足严格 DPR 1 门禁，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步当前证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成工具失败可重试页当前运行证据复核，不代表该画板或 105 张画板达到像素级 `PASS`；周边工作台、头像、图标和字体光栅化仍有差异，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 168. 2026-08-30 Agent Safety Degraded 当前运行证据复核

- [x] 重新打开 `/chat?state=safety-degraded` 并在 `1440×1024` 视口采集当前前端；安全内容容器为 `x=292,y=237,width=612,height=211.1`，警告带为 `x=344,y=237,width=560,height=58`，回答区域为 `x=344,y=301,width=560,height=125.1`。
- [x] 页面保留安全降级警告、有限数据范围、个人高血压条件未完整应用提示和可继续追问入口，未将降级结果包装为完整分析或完整引用；字体状态为 `loaded`，页面无横向或纵向溢出；前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 原始浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-safety-degraded-current-browser-2026-08-30.jpg`，转换后的真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-safety-degraded-current-browser-2026-08-30-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-safety-degraded-current-browser-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=375938`、差异比例 `25.4949%`、`MAE=3.213981`、`RMSE=16.377636`、最大通道差异 `255`；实际浏览器 DPR 为 `1.25`，不满足严格 DPR 1 门禁，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步当前证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成安全降级页当前运行证据复核，不代表该画板或 105 张画板达到像素级 `PASS`；周边工作台、头像、图标和字体光栅化仍有差异，shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 169. 2026-08-30 Agent User Cancelled 当前运行证据复核

- [x] 重新打开 `/chat?state=user-cancelled` 并在 `1440×1024` 视口采集当前前端；页面保留已接收的部分文本、用户取消原因和重新开始入口，取消状态不显示为系统失败。
- [x] 页面字体状态为 `loaded`，无横向或纵向溢出；前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 原始浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-current-browser-2026-08-30.jpg`，转换后的真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-user-cancelled-current-browser-2026-08-30-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-user-cancelled-current-browser-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=302337`、差异比例 `20.5035%`、`MAE=2.421603`、`RMSE=14.507177`、最大通道差异 `249`；实际浏览器 DPR 为 `1.0000000149`，通过 DPR 门禁，但共享工作台、头像、字体和图标仍存在整页差异，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已切换到当前 RGBA 证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成用户取消态当前运行证据复核，不代表该画板或 105 张画板达到像素级 `PASS`；shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 170. 2026-08-30 Agent SSE Reconnecting 当前运行证据复核

- [x] 重新打开 `/chat?state=sse-reconnecting` 并在 `1440×1024` 视口采集当前前端；页面保留已显示文本，展示第 `2/5` 次重连、等待重连状态、刷新提示，Composer 保持禁用。
- [x] 页面字体状态为 `loaded`，无横向或纵向溢出；前端左上角红、黄、绿窗口装饰候选为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 原始浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-current-browser-2026-08-30.jpg`，转换后的真实 RGBA PNG 为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-sse-reconnecting-current-browser-2026-08-30-rgba.png`；独立 diff 为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-sse-reconnecting-current-browser-2026-08-30-diff.json`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=338410`、差异比例 `22.9499%`、`MAE=2.769102`、`RMSE=15.461383`、最大通道差异 `249`；实际浏览器 DPR 为 `1.0000000149`，通过 DPR 门禁，但工作台、头像、字体和图标仍存在整页差异，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已切换到当前 RGBA 证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 SSE 重连态当前运行证据复核，不代表该画板或 105 张画板达到像素级 `PASS`；shadcn 全页面迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 171. 2026-08-30 前端全量质量门禁复核

- [x] `foodmate-ui` 全量测试通过：`npm run test` 为 `38/38` 个测试文件、`215/215` 个用例通过，覆盖 Chat 六种状态和 Agent SSE 连接状态回归。
- [x] `npm run typecheck` 通过；`npm run build` 通过，Vite 完成生产构建并转换 `2010` 个模块。
- [x] `git diff --check` 通过；本轮没有新增前端左上角红、黄、绿窗口装饰，业务状态圆点保持不变。
- [ ] 质量门禁通过只证明当前代码可测试、可类型检查和可构建，不关闭 105 张画板的 `DIFF_REVIEW`、shadcn 全量逐页迁移或 iconfont `BLOCKED`。

## 172. 2026-08-30 Admin Knowledge 六种流程态实现与像素证据

- [x] 已依据 Figma 节点 `782:212`（上传中）、`782:366`（索引中）、`782:520`（上传失败）、`806:1737`（上传成功）、`997:2`（格式错误）和 `997:160`（大小错误）实现对应 Admin 前端状态；路由分别为 `/admin?state=knowledge-uploading`、`knowledge-indexing`、`knowledge-upload-failed`、`knowledge-upload-success`、`knowledge-format-error`、`knowledge-size-error`。
- [x] 6 个状态均在 `1440×1024`、字体加载完成条件下生成当前浏览器证据；实测几何为上传中 `x=570,y=330,560×260`、索引中 `x=570,y=320,560×280`、错误态 `x=570,560×286`，成功态无额外弹层并显示正常知识库页面。
- [x] 当前浏览器证据与独立 diff 位于 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/`：`admin-knowledge-uploading-2026-08-30`、`admin-knowledge-indexing-2026-08-30`、`admin-knowledge-upload-failed-2026-08-30`、`admin-knowledge-upload-success-2026-08-30`、`admin-knowledge-format-error-2026-08-30`、`admin-knowledge-size-error-2026-08-30`；`png-diff.mjs` 差异比例分别为 `35.9383%`、`36.3896%`、`36.5374%`、`49.4558%`、`63.2992%`、`63.3012%`，6 项均为 `DIFF_REVIEW`。
- [x] Admin 定向测试为 `17/17`；当前全量 `npm run test` 为 `38/38` 个测试文件、`221/221` 个用例通过，`npm run typecheck`、`npm run build` 和 `git diff --check` 通过。`npm run lint` 当前输出 `0 errors、438 warnings`，警告主要为全仓 Prettier 换行和既有 React 规则问题，未将其隐藏为通过。
- [x] 前端全量扫描未发现 Apple 红、黄、绿窗口控制节点、traffic-light 选择器或对应标准颜色；该核验仅作用于前端，Figma 设计稿未修改，业务状态圆点保持不变。
- [ ] 该小点不关闭 105 张画板的像素级验收；当前聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。shadcn 全量逐页迁移与 iconfont 实体资源登记仍未完成，iconfont 继续为 `BLOCKED`。

## 173. 2026-08-30 Chat Figma Fixture 移除额外消息操作面板

- [x] Figma 节点 `640:428`（`state=figma-v2`）和 `1013:653`（`state=running-stop`）均未包含“消息操作”说明面板；前端已在 Figma fixture 中移除该额外结构，仅非 Figma fixture 的真实模式继续渲染操作说明。
- [x] 浏览器在 `1440×1024` 视口完成复核：两个 fixture 的 `messageActions=0`、窗口控制点为 `0`、字体状态为 `loaded`、页面无横向或纵向溢出。
- [x] 当前证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-no-message-actions-browser-2026-08-30.png` 和 `agent-chat-running-stop-no-message-actions-browser-2026-08-30.png`；`png-diff.mjs` 同尺寸结果分别为 `differentPixels=475559`、差异比例 `32.2509%`、`MAE=4.097054`、`RMSE=19.538565`、最大通道差异 `255`，以及 `differentPixels=451763`、差异比例 `30.6371%`、`MAE=3.575264`、`RMSE=18.813835`、最大通道差异 `237`，两项均保持 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 与 `figma-105-diff-results.json` 已切换为上述当前浏览器证据；映射总览仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，未将局部结构修正标记为 `PASS`。
- [ ] 本小点只完成 Figma fixture 的额外面板移除，不关闭全量像素验收；DPR 为 `1.25`，头像、字体、图标、运行中 Composer 和其他页面差异仍需继续复核，shadcn 全量逐页迁移未完成，iconfont 继续为 `BLOCKED`。

## 174. 2026-08-30 Agent Chat Figma 助手正文宽度收口

- [x] `MockChatPage` 仅为 `state=figma-v2` 的消息传入 `wide` 标记；桌面端 `.assistantBodyWide` 实测为 `x=340,width=764px`，避免 flex 收缩使设计稿中的助手内容区退化为 `748px`。真实模式不使用该标记。
- [x] 新增浏览器证据 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-wide-browser-2026-08-30.png`，视口 `1440×1024`，字体 `loaded`，页面无横向溢出，窗口装饰点 `0`；Figma 设计稿未修改。
- [x] `png-diff.mjs` 同尺寸结果为 `differentPixels=457274`、差异比例 `31.0109%`、`MAE=4.079167`、`RMSE=19.384585`、最大通道差异 `255`；独立证据为 `foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-assistant-wide-2026-08-30-diff.json`，结论继续为 `DIFF_REVIEW`。
- [x] 已将当前证据同步至 `figma-105-mapping.json` 和 `figma-105-diff-results.json`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只证明助手正文宽度局部改善，不关闭 `agent-chat-v2` 的整页像素 `PASS`；DPR、头像、图标、字体光栅化和工作台其它差异仍需处理，shadcn 全量逐页迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 175. 2026-08-30 Agent Chat Figma 绿色 Token 收口

- [x] 依据 Figma 节点 `640:428` 的已登记 PNG，确认品牌标记和 Agent 方块的主绿色为 `#4caf50`；前端只在 `.designChat` fixture 作用域覆盖 `--fm-green`，不改变全局页面 Token，也未修改 Figma 设计稿。
- [x] `WorkspaceLayout` 定向测试先在缺少 Token 时按预期失败，再补充最小 CSS 覆盖后通过 `9/9`；浏览器 `1440×1024` 实测品牌标记和 Agent 方块均为 `rgb(76,175,80)`，字体状态为 `loaded`，页面无横向/纵向溢出，左上角红黄绿窗口控制点候选为 `0`。
- [x] 新增浏览器 RGBA PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-design-green-browser-2026-08-30-rgba.png` 和独立 diff `foodmate-ui/.qa/figma-pixel-acceptance/agent-chat-v2-design-green-2026-08-30-diff.json`；`scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=457385`、差异比例 `31.0184%`、`MAE=4.049774`、`RMSE=19.528353`、最大通道差异 `255`，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json` 与 `figma-105-diff-results.json` 已切换至本次 RGBA 证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只收口 Figma fixture 绿色 Token，不代表 `agent-chat-v2` 或 105 张画板达到像素级 `PASS`；头像、图标、DPR 和其它整页渲染差异、shadcn 全量逐页迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 176. 2026-08-30 Agent Chat Figma 助手正文宽度与背景基准校正

- [x] 依据 Figma 节点 `640:428` 的已登记 PNG，确认助手消息外层像素基准为 `#f4f6f5`，非确认卡助手正文边界为 `x=340,width=560px`；前端移除 `state=figma-v2` 的错误 `assistantBodyWide` 标记，内嵌确认卡边界为 `x=356,y=337,width=528,height=142px`，未修改 Figma 设计稿。
- [x] 按 TDD 先观察助手背景和正文宽度回归测试失败，再完成最小 CSS/渲染修正；`ChatPage.test.tsx` 定向测试为 `30/30`，`npm run typecheck` 通过。
- [x] 当前浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-layout-browser-2026-08-30.jpg` 与 `agent-chat-v2-assistant-layout-browser-2026-08-30-rgba.png`，独立 diff 为 `agent-chat-v2-assistant-layout-2026-08-30-diff.json`；同尺寸 `png-diff.mjs` 结果为 `differentPixels=452126`、差异比例 `30.6618%`、`MAE=2.944767`、`RMSE=15.908241`、最大通道差异 `234`，结论保持 `DIFF_REVIEW`。
- [x] 运行时检查为 `1440×1024`、字体 `loaded`、无横向/纵向溢出、窗口控制点候选为 `0`；实际 DPR 为 `1.25`，严格 DPR 1 门禁未通过。`figma-105-mapping.json` 和 `figma-105-diff-results.json` 已切换到本次证据，全量仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只校正 `agent-chat-v2` 的助手正文结构和背景基准，不关闭整页或 105 张画板像素级 `PASS`；头像、图标、DPR 及其它页面差异、shadcn 全量逐页迁移仍需继续，iconfont 继续为 `BLOCKED`。

## 177. 2026-08-30 Chat 助手基准提交后的前端质量门禁复核

- [x] 提交 `df092098` 后重新运行前端全量测试：`38/38` 个测试文件、`225/225` 个用例通过；覆盖 Chat 六状态、Agent SSE 连接状态/重连/去重/终态关闭及工作区窗口装饰门禁。
- [x] 提交前后已运行 `npm run typecheck`、`npm run build` 和目标文件 `git diff --check`，均以退出码 `0` 完成；构建产物由 Vite 正常生成。
- [x] 本次提交仅包含 Chat 助手正文宽度/背景校正、对应测试、Figma 映射和验收证据；未修改 Figma，未暂存工作区中已有的后端测试与脚本修改。
- [ ] 质量门禁只证明当前前端代码可测试、可类型检查和可构建，不关闭 105 张画板的 `DIFF_REVIEW`、shadcn 全量逐页视觉迁移或 iconfont `BLOCKED` 状态。

## 178. 2026-08-30 Profile 记忆与偏好 Figma 主体几何收口

- [x] 依据 Figma 节点 `806:1281`，将 Figma fixture 的介绍卡固定为 `96px`，普通记忆行固定为 `124px`，待确认记忆行固定为 `130px`，说明区与列表间距按画板补偿为 `32px`；真实模式保持原有布局。
- [x] 浏览器 `1440×1024` 实测字体 `loaded`、无横向溢出：介绍卡 `x=292,y=100,width=1116,height=96`，工具栏 `x=292,y=220,width=1116,height=40`，记忆行分别为 `x=292,y=284,width=1116,height=124`、`x=292,y=424,width=1116,height=130`、`x=292,y=570,width=1116,height=124`，说明区 `x=292,y=726,width=1116,height=240`；前端窗口控制点候选为 `0`，Figma 设计稿未修改。
- [x] 使用真实 Figma PNG 和浏览器 RGBA PNG 运行 `scripts/png-diff.mjs`：`differentPixels=703449`、差异比例 `47.7057%`、`MAE=5.497678`、`RMSE=23.473287`、最大通道差异 `255`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/profile-memories-sidebar-2026-08-30-diff.json`，画板继续为 `DIFF_REVIEW`。
- [x] `ProfilePage.test.tsx` 定向测试 `22/22` 通过；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 Profile 记忆页 fixture 主体几何收口，不代表 `profile-memories` 或 105 张画板达到像素级 `PASS`；共享壳层、头像、图标、字体光栅化、其它页面、shadcn 全量迁移和 iconfont 实体资源登记仍需继续，iconfont 保持 `BLOCKED`。

## 181. 2026-08-30 Profile 安全与设备 Figma fixture 结构收口

- [x] 依据 Figma 节点 `806:1445`，仅为 `/profile?state=security` 增加 Figma 专用结构契约：保留“修改账号密码”和“活跃工作区会话”两张卡片，隐藏 Figma 画板不存在的“最近安全活动”、`SECURE`、`2 ACTIVE DEVICES`、设备状态说明和顶部装饰线；普通 `/profile/security` 与真实模式保持原有安全活动和交互。
- [x] 浏览器在 `1440×1024` 视口实测字体状态 `loaded`、无横向/纵向溢出；密码卡为 `x=292,y=100.71,width=546,height=464`，会话卡为 `x=862,y=100.71,width=546,height=378`，活动卡和两条安全顶部装饰线均未渲染，前端左上角红黄绿窗口控制点为 `0`，Figma 设计稿未修改。
- [x] 已登记浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/profile-security-current-browser-2026-08-30.jpg`、RGBA PNG `profile-security-current-browser-2026-08-30-rgba.png` 和独立 diff `profile-security-current-2026-08-30-diff.json`；同尺寸 `png-diff.mjs` 结果为 `differentPixels=390034`、差异比例 `26.4509%`、`MAE=3.965800`、`RMSE=19.438791`、`maxChannelDelta=255`，结论保持 `DIFF_REVIEW`。
- [x] `ProfilePage.test.tsx` 定向测试 `23/23` 通过；运行时实际 DPR 为 `1.25`，严格 DPR 1 门禁未通过；105 张画板汇总继续为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 Profile 安全与设备 fixture 的结构收口，不代表该画板或 105 张画板达到像素级 `PASS`；共享壳层、头像、图标、字体光栅化、其它页面、shadcn 全量迁移和 iconfont 实体资源登记仍需继续，iconfont 保持 `BLOCKED`。

## 182. 2026-08-30 注册页 Figma 色彩 Token 收口

- [x] 依据 Figma 节点 `680:216` 的原始 `1440×900` PNG，读取注册页斜切背景为 `#dfeedb`、主注册按钮和品牌标记强调色为 `#a6d997`；仅更新前端 `AuthShell` 的 `register` 变体 Token，登录、找回密码、重置密码和真实注册逻辑未改变，Figma 设计稿未修改。
- [x] `AuthPages.test.tsx` 先以 Figma 目标色值运行红灯（`1 failed / 22 passed`），完成最小实现后定向测试 `23/23` 通过；浏览器 `1440×900` 实测背景 `rgb(223,238,219)`、按钮 `rgb(166,217,151)`、字体 `loaded`、页面无横向/纵向溢出，前端左上角红黄绿窗口控制点候选为 `0`。
- [x] 最新浏览器 JPEG、RGBA PNG 和独立 diff 已登记：`register-page-browser-2026-08-30-token-fix.jpg`、`register-page-browser-2026-08-30-token-fix-rgba.png`、`register-page-2026-08-30-token-fix-diff.json`；同尺寸 `png-diff.mjs` 结果为 `differentPixels=699190`、差异比例 `53.9498%`、`MAE=0.813297`、`RMSE=5.644032`、`maxChannelDelta=204`，结论保持 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步本次证据；当前注册页浏览器实际 DPR 为 `1.25`，严格 DPR 1 门禁未通过，运行时汇总修正为 `dprPass=96/105`；105 张画板总览仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成注册页颜色基准收口，不代表该画板或 105 张画板达到像素级 `PASS`；整页仍存在字体、图标和浏览器光栅化差异，shadcn 全量逐页迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 183. 2026-08-30 Agent Chat 助手背景 Token 复采集

- [x] 依据 Figma 节点 `640:428` 的 `1440×1024` PNG 重新核对助手气泡背景；前端 `.designChatPage` 的专用 Token 已从旧值 `#f4f6f5` 收口为 `#f9fafb`，实际 DOM 计算颜色为 `rgb(249,250,251)`，未修改 Figma 设计稿。
- [x] 浏览器重新采集 `/chat?state=figma-v2`：视口 `1440×1024`、字体 `loaded`、无横向/纵向溢出、消息操作面板数量 `0`、前端左上角红黄绿窗口装饰候选数量 `0`；业务状态圆点保持不变。
- [x] 最新浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-surface-followup-2026-08-30.jpg`，RGBA PNG 为 `agent-chat-v2-assistant-surface-followup-2026-08-30-rgba.png`，独立 diff 为 `agent-chat-v2-assistant-surface-followup-2026-08-30-diff.json`；同尺寸 `png-diff.mjs` 结果为差异比例 `29.1355%`、`MAE=3.766897`、`RMSE=19.641207`、`maxChannelDelta=255`，继续登记为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已切换到本次浏览器 RGBA 证据；当前 105 张画板聚合为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。本次运行时实际 DPR 为 `1.25`，`figma-105-runtime-checks.json` 的 `dprPass` 更新为 `95/105`。
- [x] `ChatPage.test.tsx` 定向测试为 `30/30`；该修正只收口助手气泡背景 Token，不代表 `agent-chat-v2` 或 105 张画板达到像素级 `PASS`，shadcn 全量逐页迁移尚未完成，iconfont 实体资源继续为 `BLOCKED`。

## 184. 2026-08-30 Agent Chat 助手宽布局复采集

- [x] Figma 节点 `640:428` 与前端 `/chat?state=figma-v2` 已重新按 `1440×1024` 对照；助手内容区实测 `x=340,y=237,width=780,height=254`，消息正文与来源实测 `x=356,width=764`，确认卡实测 `x=356,y=313,width=764,height=143`。
- [x] 运行时字体状态为 `loaded`，根节点 `1440×1024`，页面无横向溢出，前端窗口控制点候选为 `0`，业务状态圆点未删除；浏览器实际 DPR 为 `1.0000000149`，该画板的 `dprPass=true`。Figma 文件保持不变。
- [x] 主证据为 `.qa/figma-pixel-acceptance/recaptured/agent-chat-v2-assistant-body-current-browser-2026-08-30-rgba.png`，`png-diff.mjs` 结果为 `378986/1474560` 个差异像素、差异比例 `25.7016%`、`MAE=3.162904`、`RMSE=17.558625`、最大通道差异 `255`；自动结果与人工复核均保持 `DIFF_REVIEW`，未标记 `PASS`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已更新；105 张画板汇总为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，运行时汇总为 `dprPass=95/105`。

## 185. 2026-08-30 非 Chat Figma Fixture 隐藏会话历史

- [x] 依据 Figma 节点 `640:588`、`640:773`、`640:901`、`795:786` 和 `806:1119` 复核，饮食记录、摄入分析、餐食规划、知识库空态和个人资料画板均不包含会话搜索、会话历史列表或分页；前端仅在对应 Figma fixture 通过 `hideSessionHistory` 隐藏这些非设计稿结构，真实模式保持原有会话历史。
- [x] `DietRecordsPage`、`AnalysisPage`、`PlanningPage`、`KnowledgePage` 和 `ProfilePage` 的定向测试为 `55/55`；五个页面均在 `1440×1024`、字体 `loaded`、无横向溢出条件下复采集，前端左上角红、黄、绿窗口控制点候选均为 `0`，业务状态圆点保持不变，Figma 设计稿未修改。
- [x] 最新浏览器 RGBA PNG 已登记：`diet-records-v2-sidebar-history-browser-2026-08-30-rgba.png`、`intake-analysis-v2-sidebar-history-browser-2026-08-30-rgba.png`、`meal-planning-v2-sidebar-history-browser-2026-08-30-rgba.png`、`user-knowledge-empty-sidebar-history-browser-2026-08-30-rgba.png` 和 `profile-basic-sidebar-history-browser-2026-08-30-rgba.png`；独立运行 `scripts/png-diff.mjs` 的差异比例分别为 `34.9078%`、`26.7036%`、`22.3250%`、`51.8127%` 和 `78.9528%`，对应 `MAE/RMSE/maxChannelDelta` 分别为 `2.716329/15.930098/234`、`2.721724/15.612590/234`、`2.472251/14.540411/234`、`4.970141/21.117905/255` 和 `4.473208/19.053256/255`，五项均保持 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已切换到这五张最新证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，运行时汇总为 `viewportPass=105/105`、`dprPass=96/105`、`geometryPass=105/105`、`textPass=105/105`。
- [ ] 本小点只完成非 Chat fixture 的会话历史边界收口，不代表五个画板或 105 张画板达到像素级 `PASS`；共享壳层、头像、图标、字体光栅化和整页视觉差异仍需继续处理，shadcn 全量逐页迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 186. 2026-08-30 Profile 未保存离开确认弹窗几何收口

- [x] 依据 Figma 节点 `794:380`，为 `state=basic-unsaved-leave-confirmation` 增加独立 fixture 契约：主区域 overlay 固定从 `x=260` 开始，弹窗为 `x=590,y=320,width=520,height=252`，操作文字调整为“继续编辑”和“放弃并离开”；真实资料页和其它 Profile 状态不受影响。
- [x] 浏览器在 `1440×1024`、字体 `loaded` 条件下复核：overlay 为 `1180×1024`，标题 `x=621.8,y=350.8`，正文 `x=621.8,y=402.8`，操作区 `x=621.8,y=509.2,width=456.4,height=32`；页面无横向/纵向溢出，前端左上角红黄绿窗口装饰候选为 `0`，Figma 设计稿未修改。
- [x] `390×844` 移动端复核：弹窗为 `x=16,y=296,width=358.4,height=252`，按钮文字保持正确，body/root 均无溢出，窗口装饰候选为 `0`。
- [x] 已登记浏览器 PNG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/profile-basic-unsaved-leave-confirmation-figma-modal-browser-2026-08-30.png` 及移动证据 `profile-basic-unsaved-leave-confirmation-figma-modal-browser-390x844-2026-08-30.png`；同尺寸 `png-diff.mjs` 结果为 `differentPixels=1164098`、差异比例 `78.9454%`、`MAE=5.388276`、`RMSE=16.966925`、最大通道差异 `255`，较旧证据 `82.5146%` 有改善，结论仍为 `DIFF_REVIEW`。
- [x] `ProfilePage.test.tsx` 定向测试为 `24/24`；运行时几何、文字、DPR 和窗口装饰证据已同步 `figma-105-mapping.json`、`figma-105-diff-results.json` 与 `figma-105-runtime-checks.json`。
- [ ] 本小点只完成未保存离开确认弹窗的 Figma fixture 几何和操作语义收口，不代表该画板或 105 张画板达到像素级 `PASS`；头像、底层资料、字体光栅化和其它页面差异、shadcn 全量迁移仍需继续，iconfont 继续为 `BLOCKED`。

## 187. 2026-08-30 Meal Planning Figma fixture 账户停靠区收口

> 历史记录：本节“隐藏账户停靠区”的判断已被 2026-08-31 实时 Figma 回读纠正，当前实现和证据以第 188 节为准。

- [x] 依据 Figma 节点 `640:901` 的原始画板，确认 `meal-planning-v2` 不包含侧栏底部的“收起导航”、就绪状态和工作区账户停靠区；仅为 `/planning?state=v2` 传入 `hideAccountDock`，Workspace Home、饮食记录、摄入分析、Profile 和真实模式保持原有账户停靠区。
- [x] 先新增 Planning 契约测试并确认红灯（`1 failed / 11 passed`），再完成最小实现；定向测试为 `12/12`。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149`、字体 `loaded` 条件下复核：账户停靠区为 `false`、页面无横向/纵向溢出、前端窗口控制点候选为 `0`，Figma 设计稿未修改。
- [x] 已登记原始 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/meal-planning-v2-account-dock-browser-2026-08-30.jpg`、PNG `meal-planning-v2-account-dock-browser-2026-08-30-rgba.png` 和独立 diff `meal-planning-v2-account-dock-2026-08-30-diff.json`；同尺寸结果为 `differentPixels=326174`、差异比例 `22.1201%`、`MAE=2.603460`、`RMSE=15.161513`、最大通道差异 `243`，结论保持 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步本次证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 Meal Planning Figma fixture 账户停靠区边界收口，不代表该画板或 105 张画板达到像素级 `PASS`；工具栏、导航、卡片几何、字体光栅化和内容密度仍需继续复核，shadcn 全量逐页迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 188. 2026-08-31 Meal Planning 账户停靠区证据纠正

上一节关于 `meal-planning-v2` 隐藏账户停靠区的判断已被实时 Figma 节点 `640:901` 回读纠正。Figma 明确包含 `收起导航`、`就绪 (Fustat-v2)` 和 `Anddy 的工作区` 三个底部账户停靠区层；本轮仅修正前端 fixture 和验收证据，未修改 Figma 设计稿。

- [x] `/planning?state=v2` 已恢复账户停靠区；前端左上角红、黄、绿窗口装饰候选数量仍为 `0`，业务状态圆点保持不变。
- [x] 浏览器运行时为 `1440×1024`、DPR `1.0000000149`、字体 `loaded`、页面无横向溢出；账户停靠区实测 `x=24,y=866,width=211.2,height=134`。
- [x] 原始浏览器截图已按真实格式登记为 `meal-planning-v2-account-dock-corrected-browser-2026-08-31.jpg`，RGBA PNG 为 `meal-planning-v2-account-dock-corrected-browser-2026-08-31-rgba.png`；两张图尺寸均为 `1440×1024`。
- [x] `png-diff.mjs` 同尺寸结果为 `differentPixels=329294`、差异比例 `22.3317%`、`MAE=2.472228`、`RMSE=14.540339`、最大通道差异 `234`；独立结果为 `meal-planning-v2-account-dock-corrected-2026-08-31-diff.json`，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步修正证据；聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只纠正账户停靠区边界和证据文件格式，不代表该画板或 105 张画板达到像素级 `PASS`；shadcn 全量逐页迁移未完成，iconfont 继续为 `BLOCKED`。

## 189. 2026-08-31 Meal Planning 会话历史结构纠正

依据实时 Figma 节点 `640:901` 的画板截图，`meal-planning-v2` 同时包含会话搜索、9 条 Agent 会话、分页、账户停靠区和计划主体。本轮仅恢复前端 fixture 中被错误隐藏的会话历史，真实模式和 Figma 设计稿保持不变。

- [x] `/planning?state=v2` 已恢复 `搜索会话...`、9 条 Figma 会话标题、`1 / 3` 分页以及上一页/下一页控件；前端左上角红、黄、绿窗口装饰候选数量为 `0`，业务会话圆点保持不变。
- [x] 浏览器运行时为 `1440×1024`、DPR `1.0000000149`、字体 `loaded`、页面无横向或纵向溢出；活动会话文本位置实测 `x=48,y=320.875,width=179.2,height=16.25`。
- [x] `PlanningPage` 与 `WorkspaceLayout` 定向测试为 `22/22`；原始浏览器 JPEG 为 `meal-planning-v2-session-history-browser-2026-08-31.jpg`，RGBA PNG 为 `meal-planning-v2-session-history-browser-2026-08-31-rgba.png`。
- [x] `png-diff.mjs` 同尺寸结果为 `differentPixels=341408`、差异比例 `23.1532%`、`MAE=2.243974`、`RMSE=12.938152`、最大通道差异 `234`；独立结果为 `meal-planning-v2-session-history-2026-08-31-diff.json`，结论继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步本次证据；聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只纠正 Planning fixture 的会话历史边界，不代表该画板或 105 张画板达到像素级 `PASS`；shadcn 全量逐页迁移未完成，iconfont 继续为 `BLOCKED`。

## 190. 2026-08-31 Diet Records 会话历史与记录详情结构纠正

依据实时 Figma 节点 `640:588` 的 `1440×1024` 参考图，本轮恢复 Diet Records Figma fixture 中的会话搜索、Agent 会话历史、分页和底部“记录详情”面板，并隐藏 Figma 画板中不存在的“记录一餐 / 分析这一天”额外操作栏；真实模式和普通默认态行为保持不变，Figma 设计稿未修改。

- [x] 按 TDD 先将旧契约改为 Figma 目标契约并确认红灯（`1 failed / 9 passed`），再完成最小前端实现；`DietRecordsPage` 定向测试为 `10/10`。
- [x] 浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/diet-records-v2-session-history-browser-2026-08-31.jpg` 和 RGBA PNG `diet-records-v2-session-history-browser-2026-08-31-rgba.png`；两者与 Figma 参考图尺寸均为 `1440×1024`。
- [x] 浏览器运行时实测视口 `1440×1024`、字体 `loaded`、页面无横向/纵向溢出；会话搜索 `1` 个、记录详情 `1` 个、额外操作栏 `0` 个，前端左上角红黄绿窗口装饰候选为 `0`，业务状态圆点保持不变。
- [x] `scripts/png-diff.mjs` 结果为 `differentPixels=536960`、差异比例 `36.4149%`、`MAE=2.622175`、`RMSE=15.524117`、最大通道差异 `234`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/diet-records-v2-session-history-2026-08-31-diff.json`，结论保持 `DIFF_REVIEW`。
- [x] 该次浏览器实际 DPR 为 `1.25`，严格 DPR 1 门禁为 `false`；`figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步，105 张画板聚合为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，运行时 `dprPass=95/105`。
- [ ] 本小点只完成 Diet Records fixture 结构纠偏，不代表该画板或 105 张画板达到像素级 `PASS`；整页仍有头像、图标、字体光栅化和其他视觉差异，shadcn 全量逐页迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 191. 2026-08-31 摄入分析会话历史结构纠正

依据实时 Figma 节点 `640:773` 的 `1440×1024` 参考图，本轮恢复 Analysis Figma fixture 中的会话搜索、活动会话和分页；真实模式和 Figma 设计稿保持不变。

- [x] `/analysis?state=v2` 已显示 `搜索会话...`、活动会话 `每周饮食微调` 和分页控件；浏览器运行时检测到搜索框 `1` 个、活动会话 `1` 个、分页可见，分页区域为 `x=24,y=598,width=212,height=22`。
- [x] 浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/intake-analysis-v2-session-history-browser-2026-08-31.jpg` 和 RGBA PNG `intake-analysis-v2-session-history-browser-2026-08-31-rgba.png`；两者与 Figma 参考图尺寸均为 `1440×1024`。
- [x] `scripts/png-diff.mjs` 同尺寸结果为 `differentPixels=405974`、差异比例 `27.5319%`、`MAE=2.493448`、`RMSE=14.1324168`、最大通道差异 `234`；独立结果为 `foodmate-ui/.qa/figma-pixel-acceptance/intake-analysis-v2-session-history-2026-08-31-diff.json`，结论保持 `DIFF_REVIEW`。
- [x] 浏览器字体状态为 `loaded`，页面无横向或纵向溢出，前端左上角红黄绿窗口装饰候选为 `0`，业务状态圆点保持不变；实际 DPR 为 `1.25`，严格 DPR 1 门禁为 `false`，运行时汇总修正为 `dprPass=94/105`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步当前证据；105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本小点只完成 Analysis fixture 会话历史结构和证据更新，不代表该画板或 105 张画板达到像素级 `PASS`；图标、字体光栅化和主体视觉差异、shadcn 全量逐页迁移仍需继续，iconfont 继续为 `BLOCKED`。

## 192. 2026-08-31 Admin Overview 分析卡固定网格验收

依据实时 Figma 节点 `995:977` 下的分析容器 `1005:2` 及三张内卡 `1005:3`、`1005:7`、`1005:11`，本轮只收口 Admin Overview Figma fixture 的分析区几何；Figma 设计稿保持只读。

- [x] Figma 元数据目标为外层 `1116×180px`，三张内卡均为 `344×180px`，相对位置为 `16/376/736`；前端实测外层 `x=292,y=766,width=1116,height=180`，三张内卡为 `x=308/668/1028,y=782,width=344,height=180`。
- [x] 前端将分析卡桌面网格固定为 `repeat(3, 344px)`、间距 `16px`、左对齐；外层与内层描边使用 `inset`，不改变移动端现有单列布局；真实模式保持原有后端数据行为。
- [x] 浏览器在 `1440×1024`、DPR `1.0000000149`、字体 `loaded` 条件下复核，页面无横向/纵向溢出，前端左上角红黄绿窗口装饰候选为 `0`，业务状态圆点保持不变。
- [x] 已登记原始浏览器 JPEG `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/admin-overview-analytics-grid-browser-2026-08-31.jpg`、RGBA PNG `admin-overview-analytics-grid-browser-2026-08-31-rgba.png` 和独立 diff `admin-overview-analytics-grid-2026-08-31-diff.json`；同尺寸结果为 `differentPixels=466371`、差异比例 `31.6278%`、`MAE=2.613027`、`RMSE=14.310728`、最大通道差异 `230`，继续为 `DIFF_REVIEW`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步本次证据；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 本节只关闭分析卡固定网格和边界偏移，不关闭该画板或 105 张画板像素级 `PASS`；头像、图标、浏览器光栅化差异、shadcn 全量逐页迁移和 iconfont 实体资源登记仍未完成，iconfont 继续为 `BLOCKED`。

## 13. 2026-09-05 视觉验收采集环境固定

本节只固定前端浏览器采集约束，不修改 Figma 文件，也不重写已有 PNG 或 diff 结果。

- 访问任意验收路由时追加 `?visual-qa=1`（已有 query 时使用 `&visual-qa=1`），应用会设置 `data-visual-qa="true"`。
- 该模式关闭 CSS 动画、GSAP 入场时间线、过渡、滚动动画和输入光标闪烁；mock Agent 时间固定为 `2024-03-14 12:46`，真实模式仍使用真实时间和真实接口。
- 采集配置集中在 `foodmate-ui/scripts/figma-acceptance-config.mjs`：目标 DPR 为 `1`，语言为 `zh-CN`，主题为 light，并登记 `1440×1024`、`1440×900`、`1366×768`、`1024×768` 和 `390×844`。
- `npm run qa:figma:validate` 校验 105 条映射的必填字段、视口、PNG 文件头与尺寸，以及 runtime 的 viewport/geometry/text/DPR 汇总；追加 `--strict` 才会把未满足全部门禁的结果作为失败退出。
- 当前旧证据实际汇总仍为 `viewportPass=105/105`、`geometryPass=105/105`、`textPass=105/105`、`dprPass=94/105`，所以校验结论为 `DPR_RECAPTURE_REQUIRED`；105 项继续为 `DIFF_REVIEW`，不能标记为 `PASS`。

## 14. 2026-09-05 Auth 页面品牌色与主操作色收口

本轮依据 Figma 节点 `647:214`、`680:216`、`680:275`、`680:307` 和 `680:738` 复核认证页面；仅修改前端 Token，不修改 Figma 文件。

- [x] `AuthShell` 已将品牌标记色和主操作色拆为独立的 `--auth-brand`、`--auth-primary`，并为注册、找回密码、重置密码和 Token 状态页提供显式 Figma Token；登录页保持原有登录状态专属 Token。
- [x] 当前目标值为：注册页 `diagonal=#dfeedb, brand=#a6d997, primary=#a6d997`；找回密码和重置密码页 `diagonal=#c5f0d6, brand=#a6d997, primary=#48c78e`；Token 状态页 `diagonal=#dfeedb, brand=#a6d997, primary=#a6d997`。
- [x] 已使用 `visual-qa=1` 在本地浏览器实际打开并检查 Login、Register、Forgot Password、Reset Password 和 Token Invalid 页面；字体状态和 Figma SVG 资产可见，页面主要结构无明显溢出。此次检查没有伪造新的 PNG 或 diff 文件，现有聚合证据保持不变。
- [x] 当前代码验证为全量 Vitest `39/39` 测试文件、`239/239` 用例通过，typecheck、build 和 `git diff --check` 通过。
- [ ] 本轮只完成 Auth Token 语义收口和浏览器复核，不能将认证画板或全量画板标记为 `PASS`。当前 105 张汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，运行时 `viewportPass=105/105`、`geometryPass=105/105`、`textPass=105/105`、`dprPass=94/105`；Figma 动画上下文未重新调用，原因是 Education 计划的 Figma MCP 调用额度已达到上限；shadcn 全量逐页迁移未完成，iconfont 继续为 `BLOCKED`。

## 15. 2026-09-05 DPR 1 视觉证据复采集

本轮复采集历史运行时 `actualDpr=1.25` 的 11 张画板，采用本地 Chrome `152.0.7977.77` 和 CDP 截图；Figma 文件保持只读。

- [x] 新增 `foodmate-ui/scripts/capture-figma-dpr1.mjs`，通过 `--force-device-scale-factor=1` 和 `Emulation.setDeviceMetricsOverride` 固定 `devicePixelRatio=1` 以及目标页面 viewport；采集前等待 `document.fonts.ready`，并记录字体、无溢出和实际 URL。
- [x] 11 张画板均已生成新浏览器 PNG：`dpr1-workspace-home-v2-browser-2026-09-05.png`、`dpr1-diet-records-v2-browser-2026-09-05.png`、`dpr1-intake-analysis-v2-browser-2026-09-05.png`、`dpr1-register-page-browser-2026-09-05.png`、三个 Agent 状态页、两个 Chat 历史页、Chat 搜索结果页和 `dpr1-profile-security-browser-2026-09-05.png`。
- [x] `figma-105-mapping.json` 已将 11 项切换到最新 DPR 1 PNG，并同步实际 `dpr=1`、目标 viewport、Chrome 版本和字体状态；`figma-105-runtime-checks.json` 汇总为 `viewportPass=105/105`、`geometryPass=105/105`、`textPass=105/105`、`dprPass=105/105`，无结构错误。
- [x] 已使用 `scripts/png-diff.mjs` 重新计算全量结果；105 项均为同尺寸 `COMPARED`，例如 `agent-budget-limit` 差异比例 `11.7329%`、`intake-analysis-v2` `7.5602%`、`register-page` `53.4744%`，具体数值以 `figma-105-diff-results.json` 为准。
- [x] `npm run qa:figma:validate` 返回 `structuralPass=true`、`strictDprPass=true`、`errors=[]`。
- [ ] DPR 复采集只关闭了运行时分辨率门禁；由于 105 项自动 diff 和人工视觉复核仍未达到全部通过条件，聚合继续为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，不能据此标记像素级 `PASS`。Figma 动画上下文仍未重新调用，原因是 Education 计划的 Figma MCP 调用额度已达到上限；shadcn 全量逐页迁移未完成，iconfont 继续为 `BLOCKED`。

## 16. 2026-09-05 Workspace Home 与 Agent Chat 共享壳层复采集

本轮依据实时 Figma 节点 `640:256` 和 `640:428`，只收口前端共享壳层及其验收证据，Figma 文件保持只读。

- [x] `WorkspaceLayout` fixture 已对齐 `260px` 侧栏、`24px` 侧栏内边距和 `52×12px` 窗口控制点；Home 使用节点 `989:3` 的“任务入口与状态”面板，Chat 使用 `780px` 助手内容边界及 `764×143px` 内嵌确认卡。
- [x] Home 和 Chat 已分别使用对应的 Figma 导出头像资源；资源 SHA-256 已登记在 [前端已完成实现清单](./前端已完成实现清单.md) 的第 198 节，避免以真人默认头像或未确认字形替代设计资源。
- [x] 使用 Chrome CDP 重新采集 `dpr1-workspace-home-v2-browser-2026-09-05.png` 和 `dpr1-agent-chat-v2-browser-2026-09-05.png`；两项均为 `1440×1024`、DPR `1`、字体 `loaded`、无页面横向溢出，几何和文字检查通过。
- [x] `scripts/png-diff.mjs` 重新计算结果：`workspace-home-v2` 为 `349634/1474560` 个差异像素、差异比例 `23.7111%`、`MAE=3.486692`、`RMSE=18.329592`、最大通道差异 `254`；`agent-chat-v2` 为 `215261/1474560` 个差异像素、差异比例 `14.5983%`、`MAE=3.046648`、`RMSE=18.422228`、最大通道差异 `236`。
- [x] `figma-105-mapping.json` 和 `figma-105-diff-results.json` 已切换到本次浏览器证据；105 项汇总为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，结构校验为 `structuralPass=true`、`strictDprPass=true`、`errors=[]`。
- [x] 本大点完成后集中执行前端质量门禁：`npm run test` 为 `39/39` 个测试文件、`240/240` 个用例通过，`npm run typecheck`、`npm run build`、`npm run format:check`、`npm run lint` 和 `git diff --check` 均通过；既有 React/Radix `act(...)` 提示不影响退出码。
- [ ] 自动 diff 和人工视觉复核仍显示图标、字体光栅化及局部组合差异，本轮不能把 DPR/几何通过替代像素级 `PASS`；shadcn 全量逐页视觉收口尚未完成，iconfont 继续为 `BLOCKED`。

## 20. 2026-09-05 Diet Records、Intake Analysis、Meal Planning 头像资源收口

本大点重新读取实时 Figma 节点 `640:588`、`640:773` 和 `640:901`，并收口三个业务页面 fixture 的头像资源和主画板证据。Figma 文件保持只读，真实模式的性别默认头像不受影响。

| 画板 | Figma 节点 | 浏览器入口 | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---:|---:|---:|---:|---:|---|
| Diet Records | `640:588` | `/analysis?view=records&state=v2` | `1440×1024 / 1` | `7.9734%` | `2.546144` | `16.834996` | `227` | `DIFF_REVIEW` |
| Intake Analysis | `640:773` | `/analysis?state=v2` | `1440×1024 / 1` | `7.5430%` | `2.004188` | `14.243366` | `211` | `DIFF_REVIEW` |
| Meal Planning | `640:901` | `/planning?state=v2` | `1440×1024 / 1` | `10.8512%` | `1.887898` | `12.687881` | `204` | `DIFF_REVIEW` |

- [x] 三个 fixture 统一使用 `FIGMA_WORKSPACE_AVATARS`：侧栏为 `/assets/figma/workspace/home-sidebar-avatar.png`，顶栏为 `/assets/figma/workspace/home-topbar-avatar.png`；未使用真人默认头像，未创建虚构 iconfont 字形。
- [x] 三个主画板浏览器 PNG 均在字体加载完成、页面无横向溢出和 DPR 1 条件下重新登记；尺寸均为 `1440×1024`，自动 diff 输入有效。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已同步本批次证据；全量汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [x] 本大点完成后集中执行四个直接相关测试文件，共 `29/29` 个用例通过；`npm run typecheck`、`npm run build`、`npm run lint`、`npm run format:check`、`npm run qa:figma:validate` 和 `git diff --check` 均通过。
- [ ] 三个主画板仍有非零像素差异，不能用几何、字体和 DPR 门禁通过替代像素级 `PASS`；后续继续处理 Knowledge、Profile、Admin 画板，shadcn 全量逐页迁移和 iconfont 资源登记仍未完成。

## 17. 2026-09-05 Auth 页面组最新证据同步

本轮对 Auth 页面组的 13 个 Figma 画板使用现有 Figma PNG 与最新浏览器 PNG 重新建立一一对应的 diff 证据。Figma 文件保持只读，浏览器采集使用 `visual-qa=1`，关闭动画和动态时间。

| 画板 | 前端入口 | 视口 / DPR | diff 比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---:|---:|---:|---:|---:|---|
| `login-v2` | `/login?state=default` | `1440×900 / 1` | `3.5494%` | `0.563271` | `7.556086` | `213` | `DIFF_REVIEW` |
| `register-page` | `/register` | `1440×900 / 1` | `53.4744%` | `4.925019` | `12.976234` | `202` | `DIFF_REVIEW` |
| `forgot-password-page` | `/forgot-password` | `1440×900 / 1` | `3.1839%` | `0.698558` | `7.558744` | `188` | `DIFF_REVIEW` |
| `reset-password-page` | `/reset-password` | `1440×900 / 1` | `4.0651%` | `1.279848` | `12.070849` | `213` | `DIFF_REVIEW` |
| `login-submitting` | `/login?state=submitting` | `1440×900 / 1` | `6.0041%` | `0.666177` | `7.112977` | `213` | `DIFF_REVIEW` |
| `login-field-error` | `/login?state=field-error` | `1440×900 / 1` | `5.9847%` | `2.176949` | `15.160967` | `213` | `DIFF_REVIEW` |
| `login-credential-error` | `/login?state=credential-error` | `1440×900 / 1` | `7.3556%` | `2.180823` | `14.229756` | `213` | `DIFF_REVIEW` |
| `login-account-locked` | `/login?state=account-locked` | `1440×900 / 1` | `6.3483%` | `1.153100` | `10.919070` | `213` | `DIFF_REVIEW` |
| `login-account-disabled` | `/login?state=account-disabled` | `1440×900 / 1` | `8.3975%` | `1.501752` | `11.600173` | `213` | `DIFF_REVIEW` |
| `login-service-unavailable` | `/login?state=service-unavailable` | `1440×900 / 1` | `6.1755%` | `1.130837` | `10.875567` | `213` | `DIFF_REVIEW` |
| `token-invalid` | `/token-status?state=invalid` | `1440×900 / 1` | `1.8195%` | `0.101208` | `2.509056` | `204` | `DIFF_REVIEW` |
| `token-expired` | `/token-status?state=expired` | `1440×900 / 1` | `1.8706%` | `0.115650` | `2.707871` | `204` | `DIFF_REVIEW` |
| `token-used` | `/token-status?state=used` | `1440×900 / 1` | `1.9593%` | `0.147349` | `3.025545` | `187` | `DIFF_REVIEW` |

- [x] 最新浏览器证据已登记在 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/dpr1-*-browser-2026-09-05.png`；Figma 参考图和浏览器图尺寸均匹配，13 项均为 `COMPARED`。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 和 `figma-105-runtime-checks.json` 已同步；全量运行时检查为 `viewportPass=105/105`、`geometryPass=105/105`、`textPass=105/105`、`dprPass=105/105`、`errors=0`。
- [x] Auth 视觉资源边界已保持可追溯：品牌标记、字段图标、密码可见性、分隔线和 Token 状态图标使用 Figma 导出文件；未创建虚构 iconfont 字体、字形或 Unicode 映射。
- [ ] 13 项 diff 均存在非零差异，且最新截图尚未完成逐项人工视觉复核，故不能标记 `PASS`；本次只完成证据更新，不宣称 Auth 页面组像素级验收完成。
- [ ] 105 张画板聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`；shadcn 全量逐页视觉迁移尚未完成，iconfont 仍为 `BLOCKED`。

## 18. 2026-09-05 Diet Records、Intake Analysis、Meal Planning 批次复采集

本轮依据 Figma 节点 `640:588`、`640:773`、`640:901` 及对应状态节点，补齐三组业务页面的 DPR 1 浏览器证据。Figma 设计稿保持只读；所有浏览器 PNG 均在 `1440×1024`、DPR `1`、字体加载完成和视觉验收模式下采集。

| 画板 | 前端入口 | diff 比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---:|---:|---:|---:|---|
| `diet-records-v2` | `/analysis?view=records&state=v2` | `7.9746%` | `2.597864` | `17.036879` | `246` | `DIFF_REVIEW` |
| `diet-records-loading` | `/analysis?view=records&state=loading` | `19.2645%` | `2.586917` | `15.479344` | `255` | `DIFF_REVIEW` |
| `diet-records-empty` | `/analysis?view=records&state=empty` | `10.1311%` | `2.385595` | `16.457653` | `255` | `DIFF_REVIEW` |
| `diet-records-error` | `/analysis?view=records&state=error` | `8.8559%` | `2.114887` | `15.650741` | `255` | `DIFF_REVIEW` |
| `intake-analysis-v2` | `/analysis?state=v2` | `7.5442%` | `2.055728` | `14.479771` | `242` | `DIFF_REVIEW` |
| `intake-analysis-loading` | `/analysis?state=loading` | `19.0972%` | `2.396458` | `15.153815` | `255` | `DIFF_REVIEW` |
| `intake-analysis-empty` | `/analysis?state=empty` | `30.4776%` | `3.608765` | `17.122086` | `255` | `DIFF_REVIEW` |
| `intake-analysis-error` | `/analysis?state=error` | `8.1003%` | `1.976565` | `14.977629` | `255` | `DIFF_REVIEW` |
| `meal-planning-v2` | `/planning?state=v2` | `23.1532%` | `2.243974` | `12.938152` | `234` | `DIFF_REVIEW` |
| `meal-planning-loading` | `/planning?state=loading` | `7.5538%` | `0.971944` | `9.799762` | `249` | `DIFF_REVIEW` |
| `meal-planning-empty` | `/planning?state=empty` | `5.5347%` | `1.080543` | `10.454680` | `249` | `DIFF_REVIEW` |
| `meal-planning-error` | `/planning?state=error` | `10.1912%` | `2.254055` | `15.862731` | `249` | `DIFF_REVIEW` |
| `meal-plan-list` | `/planning?state=list` | `6.9485%` | `2.152352` | `14.802715` | `236` | `DIFF_REVIEW` |
| `meal-plan-wizard-step1` | `/planning?state=wizard-step1` | `35.9497%` | `5.390206` | `25.307971` | `255` | `DIFF_REVIEW` |
| `meal-plan-wizard-step2` | `/planning?state=wizard-step2` | `35.3477%` | `5.733976` | `26.049840` | `250` | `DIFF_REVIEW` |
| `meal-plan-wizard-step3` | `/planning?state=wizard-step3` | `38.1058%` | `6.312309` | `27.371345` | `255` | `DIFF_REVIEW` |
| `meal-plan-conflict` | `/planning?state=conflict` | `31.6232%` | `7.547086` | `30.701595` | `255` | `DIFF_REVIEW` |
| `meal-plan-shopping-list` | `/planning?state=shopping-list` | `21.4598%` | `4.122252` | `21.045152` | `255` | `DIFF_REVIEW` |
| `meal-plan-generating` | `/planning?state=generating` | `9.5041%` | `3.033991` | `19.434948` | `255` | `DIFF_REVIEW` |

- [x] `WorkspaceLayout.test.tsx` 新增 records、analysis、planning fixture 壳层回归；三条入口均确认窗口控制点存在，普通壳层条件不变。
- [x] `figma-105-mapping.json` 已将 19 项切换至 `recaptured/dpr1-*-browser-2026-09-05.png`；`figma-105-diff-results.json` 已由 `scripts/generate-figma-105-diff.mjs` 重新生成，自动比较输入为 `105/105`。
- [x] 19 项 PNG 尺寸均为 `1440×1024`，全量校验为 `structuralPass=true`、`strictDprPass=true`、`errors=[]`；运行时几何、文字和 DPR 门禁均通过。
- [ ] 19 项均为非零 diff，且尚未完成逐项人工视觉复核，全部保持 `DIFF_REVIEW`；105 张画板汇总仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，不能提前标记 PASS。
- [ ] 本批次不关闭 shadcn 全量逐页视觉迁移或 iconfont 阻塞；标准命令图标继续使用 Lucide，iconfont 仍为 `BLOCKED`。

## 19. 2026-09-05 Workspace Home 与 Agent Chat 当前代码收口

本节记录本轮当前工作区代码改动对应的验收口径，覆盖实时 Figma 节点 `640:256` 和 `640:428`。Figma 文件保持只读；本节不吸收后端 Mapper、Admin 并行改动或临时 SQL 文件。

- [x] Workspace Home fixture 继续使用 `260px` 侧栏和 `24px` 侧栏内边距；在 `1101px~1399px` 中等桌面范围隐藏工作区搜索，避免导航和账户操作发生布局挤压。
- [x] Agent Chat fixture 的助手正文当前按 `560px` 固定宽度实现，助手消息外层背景按 `#f4f6f5` 实现，正文使用 `Noto Sans SC` 并允许自然换行；来源和运行轨迹继续使用等宽字体。
- [x] Chat 消息操作区文案和间隔按当前 Figma fixture 收口；写入确认、预算追加、重试、取消和 SSE 状态的真实服务逻辑不因视觉调整改变。
- [x] 对应证据仍使用 `1440×1024`、DPR `1`、字体 `loaded` 和无页面横向溢出条件；当前代表性 diff 为 Workspace Home `23.7111% / MAE 3.486692 / RMSE 18.329592 / maxChannelDelta 254`，Agent Chat `14.5983% / MAE 3.046648 / RMSE 18.422228 / maxChannelDelta 236`，二者均为 `DIFF_REVIEW`。
- [x] `npm run qa:figma:validate` 的当前结构结果为 `structuralPass=true`、`strictDprPass=true`、`errors=[]`；全量聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [ ] 自动 diff 仍为非零，且字体光栅化、头像、图标和局部组合差异尚未全部消除；本节不能将 Workspace Home、Agent Chat 或全量 105 张画板标记为像素级 `PASS`，shadcn 全量逐页视觉迁移和 iconfont 资源登记仍未完成。

## 205. 2026-09-05 Knowledge 与 Profile 当前头像证据

本节登记实时 Figma 节点 `795:838`、`806:1119` 对应的前端头像资源和浏览器证据。Figma 文件保持只读；本节不把资源替换或结构检查误写成像素级通过。

- [x] Knowledge 使用 `FIGMA_KNOWLEDGE_AVATARS`；Profile 使用 `FIGMA_PROFILE_AVATARS`，分别覆盖侧栏、顶栏和资料卡头像。Profile 资源 SHA-256 已登记在 [前端已完成实现清单](./前端已完成实现清单.md) 的第 204 节。
- [x] Profile 的 19 个状态与 Knowledge 的 3 个映射状态均登记 `1440×1024`、DPR `1`、字体加载完成和 Chrome `152.0.7977.77` 浏览器证据；独立 Knowledge 默认内容区证据同时保留。
- [x] Profile 空头像回退逻辑已修正：仅在 fixture 明确传入头像时覆盖真实用户头像；真实模式仍按用户头像和性别默认头像解析。
- [x] 105 项映射和自动 diff 输入已同步，结构校验通过：`total=105`、`structuralPass=true`、`strictDprPass=true`、`errors=[]`。
- [ ] 105 项自动 diff 汇总为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`；Knowledge 默认内容区 diff 为 `38.7247% / MAE 3.447377 / RMSE 17.079127 / maxChannelDelta 240`，Profile 与 Knowledge 仍需逐项人工视觉复核，不能标记 `PASS`。
- [ ] iconfont 实体包、CSS 映射、来源和许可证仍缺失，继续保持 `BLOCKED`；shadcn 全量逐页视觉迁移也未完成。

## 206. 2026-09-05 Auth 页面组当前证据与状态收口

本节记录 Auth 页面当前代码与实时 Figma 状态节点的复核结果。Figma 文件保持只读；浏览器证据由 `scripts/capture-figma-dpr1.mjs` 使用 Chrome CDP 重新采集，统一关闭动态时间和登录装饰动画。

| 画板 | Figma 状态节点 | 前端入口 | diff 比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---:|---:|---:|---:|---|
| `login-v2` | `647:214` | `/login?state=v2` | `3.7948%` | `0.564622` | `7.545321` | `213` | `DIFF_REVIEW` |
| `register-page` | `680:216` | `/register` | `4.2780%` | `0.567688` | `6.677208` | `198` | `DIFF_REVIEW` |
| `forgot-password-page` | `680:275` | `/forgot-password` | `3.0128%` | `0.648710` | `7.311508` | `188` | `DIFF_REVIEW` |
| `reset-password-page` | `680:307` | `/reset-password` | `3.3946%` | `0.583890` | `6.760528` | `213` | `DIFF_REVIEW` |
| `login-submitting` | `680:408` | `/login?state=submitting` | `6.5194%` | `0.799225` | `7.580698` | `207` | `DIFF_REVIEW` |
| `login-field-error` | `680:445` | `/login?state=field-error` | `6.0791%` | `2.224975` | `15.282295` | `209` | `DIFF_REVIEW` |
| `login-credential-error` | `680:483` | `/login?state=credential-error` | `7.5809%` | `2.493721` | `15.558759` | `213` | `DIFF_REVIEW` |
| `login-account-locked` | `680:524` | `/login?state=account-locked` | `6.4325%` | `1.168450` | `10.882798` | `213` | `DIFF_REVIEW` |
| `login-account-disabled` | `680:564` | `/login?state=account-disabled` | `8.4825%` | `1.518840` | `11.574948` | `213` | `DIFF_REVIEW` |
| `login-service-unavailable` | `680:606` | `/login?state=service-unavailable` | `6.2605%` | `1.147925` | `10.848658` | `213` | `DIFF_REVIEW` |
| `token-invalid` | `680:738` | `/token-status?state=invalid` | `1.8195%` | `0.101208` | `2.509056` | `204` | `DIFF_REVIEW` |
| `token-expired` | `680:757` | `/token-status?state=expired` | `1.8706%` | `0.115650` | `2.707871` | `204` | `DIFF_REVIEW` |
| `token-used` | `680:776` | `/token-status?state=used` | `1.9593%` | `0.147349` | `3.025545` | `187` | `DIFF_REVIEW` |

- [x] 13 个浏览器 PNG 均为 `1440×900`、DPR `1`、字体 `loaded`、无页面横向溢出；证据路径为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/dpr1-*-browser-2026-09-05.png`。
- [x] 实时 Figma 上下文确认登录状态使用 `#ffd6e0`、`#c5f0d6`、`#a6d997`、`#48c78e`、`#cbd5e0` 及错误/警告/信息语义色；代码继续通过 Auth Token 和 Figma 导出 SVG 资源映射。
- [x] 登录动画按 `647:214` 的 `4500ms` 无限循环和分段时间点实现；视觉验收模式不启动动画，避免截图污染。
- [x] `figma-105-diff-results.json` 已重新生成，自动比较输入为 `105/105`；全量校验为 `structuralPass=true`、`strictDprPass=true`、`errors=[]`。
- [x] Auth 相关代码、测试和采集脚本门禁已完成：Vitest `39/39` 文件、`245/245` 用例，typecheck、build、lint、format:check 和 `git diff --check` 均通过。
- [ ] Auth 13 项 diff 均为非零差异，仍需继续处理字体、头像、图标和浏览器光栅化差异；因此不能标记像素级 `PASS`。105 项汇总继续为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`，iconfont 仍为 `BLOCKED`。

## 21. 2026-09-05 Admin Overview 分页总量证据

本轮依据实时 Figma 节点 `995:977` 对 Admin Overview mock 分页总量进行视觉修正和同尺寸复采集。Figma 文件保持只读，用户指定的男性默认头像继续使用项目默认资源，不替换为 Figma 中的真人头像。

| 画板 | Figma 节点 | 前端入口 | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---:|---:|---:|---:|---:|---|
| `admin-overview` | `995:977` | `/admin?state=overview&visual-qa=1` | `1440×1024 / 1` | `10.6799%` | `2.591621` | `15.781021` | `238` | `DIFF_REVIEW` |

- [x] Figma 设计稿显示 `显示第 1 到 6 条，共 12,480 条结果`；浏览器 mock 不再把六条首屏数据误报为总量，且数字统一显示千位分隔符。
- [x] 浏览器证据为 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/dpr1-admin-overview-browser-2026-09-05.png`；截图尺寸 `1440×1024`，DPR `1`，字体状态 `loaded`，页面无横向溢出。
- [x] `figma-105-mapping.json` 已将 `admin-overview` 指向本次截图，`figma-105-diff-results.json` 已重新生成；全量仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [x] `npm run qa:figma:validate` 返回 `structuralPass=true`、`strictDprPass=true`、`errors=[]`；本轮没有把结构门禁通过误写成像素级通过。
- [ ] Admin Overview 仍有非零自动 diff，默认头像、字体光栅化和局部像素差异尚未消除，继续保持 `DIFF_REVIEW`；Admin 其余画板、shadcn 全量逐页视觉迁移和 iconfont 实体资源登记仍未完成。

## 22. 2026-09-05 Admin 工具注册表及六种操作状态视觉收口

本批次依据实时 Figma 节点 `692:3847`、`692:4319`、`692:4539`、`692:4766`、`692:4995` 和 `692:5207`，重新采集同尺寸浏览器证据并完成 Admin 工具注册表操作状态的视觉收口。Figma 文件保持只读。

| 画板 | Figma 节点 | 前端入口 | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---:|---:|---:|---:|---:|---|
| `admin-tool-registry` | `692:3847` | `/admin?state=tool-registry` | `1440×1024 / 1` | `15.8801%` | `4.020725` | `21.038847` | `244` | `DIFF_REVIEW` |
| `admin-op-no-permission` | `692:4319` | `/admin?state=op-no-permission` | `1440×1024 / 1` | `15.4554%` | `3.861192` | `20.391081` | `244` | `DIFF_REVIEW` |
| `admin-op-confirm` | `692:4539` | `/admin?state=op-confirm` | `1440×1024 / 1` | `17.4894%` | `2.171402` | `11.933188` | `224` | `DIFF_REVIEW` |
| `admin-op-submitting` | `692:4766` | `/admin?state=op-submitting` | `1440×1024 / 1` | `15.9030%` | `2.179733` | `11.955242` | `224` | `DIFF_REVIEW` |
| `admin-op-success` | `692:4995` | `/admin?state=op-success` | `1440×1024 / 1` | `14.9661%` | `3.823359` | `20.513058` | `253` | `DIFF_REVIEW` |
| `admin-op-failed` | `692:5207` | `/admin?state=op-failed` | `1440×1024 / 1` | `17.1870%` | `2.490198` | `13.233070` | `204` | `DIFF_REVIEW` |

- [x] 6 张浏览器 PNG 均使用 Chrome `152.0.7977.77`、`1440×1024`、DPR `1`、字体 `loaded` 和无页面横向溢出条件；证据位于 `foodmate-ui/.qa/figma-pixel-acceptance/recaptured/`。
- [x] 工具注册表表格按 Figma 使用 `58px` 数据行和 `68px / 68px / 48px / 72px` 末四列轨道；行内操作按钮为 `26px`，图标为 `14px`。
- [x] 确认和提交中状态使用 Figma 的 `37px` 操作按钮与 `14px` 进度说明行高；失败态使用错误图标、纯黑 `40%` 遮罩和“关闭”按钮；无权限态保留 Operator 身份和禁用操作按钮。
- [x] `figma-105-mapping.json`、`figma-105-diff-results.json` 已同步本批次主证据。`npm run qa:figma:validate` 返回 `structuralPass=true`、`strictDprPass=true`、`errors=[]`，全量汇总为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。
- [x] 本批次完成后集中执行 `npm run test`（`39/39` 文件、`247/247` 用例）、`npm run typecheck`、`npm run build`、`npm run lint`、`npm run format:check` 和 `git diff --check`，均通过。
- [ ] 六个目标画板的自动 diff 均非零，人工复核结论继续保持 `DIFF_REVIEW`；本批次不宣称 Admin 或 105 张画板达到像素级 `PASS`。shadcn 全量逐页迁移尚未完成，iconfont 实体包、CSS 映射、来源和许可证仍缺失，继续保持 `BLOCKED`。

## 23. 2026-09-05 Workspace Home 与 Agent Chat 当前 Figma 证据校正

本节记录实时重新读取 Figma 节点 `640:256` 和 `640:428` 后的 Workspace Home 与 Agent Chat 当前证据。Figma 文件保持只读；旧版 PNG 保留为历史记录，不替代当前主映射。

| 画板 | Figma 节点 | Figma PNG | 浏览器 PNG | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Workspace Home | `640:256` | `recaptured-figma/workspace-home-v2-figma-2026-09-05.png` | `recaptured/dpr1-workspace-home-v2-browser-2026-09-05.png` | `1440×1024 / 1` | `24.4219%` | `3.798675` | `19.280955` | `248` | `DIFF_REVIEW` |
| Agent Chat | `640:428` | `recaptured-figma/agent-chat-v2-figma-2026-09-05.png` | `recaptured/dpr1-agent-chat-v2-browser-2026-09-05.png` | `1440×1024 / 1` | `11.7176%` | `2.906090` | `17.246569` | `211` | `DIFF_REVIEW` |

- [x] Home fixture 的快捷操作、输入框、发送按钮、指标进度环和待确认队列文案继续按实时 Figma 颜色、尺寸和内容收口；相关 CSS 仅在 `state=figma-v2` 作用域生效。
- [x] 实时 Figma `640:428` 明确包含 `983:3 agent::message-actions` 说明面板；Chat fixture 已恢复面板结构、文案、边框、间距和移动端适配，真实模式不渲染该设计说明面板。
- [x] 两页浏览器证据均由 Chrome `152.0.7977.77` 在 `1440×1024`、DPR `1`、字体 `loaded` 和无页面横向溢出条件下采集；`figma-105-mapping.json` 与 `figma-105-diff-results.json` 已同步同版本路径。
- [x] 全量结构校验仍为 `total=105`、`structuralPass=true`、`strictDprPass=true`、`errors=[]`；全量自动比较输入为 `105/105`。
- [ ] 两页仍存在非零像素差异，不能将局部视觉收口、几何检查或构建通过替代像素级 `PASS`；全量汇总保持 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`。shadcn 全量逐页视觉迁移尚未完成，iconfont 继续为 `BLOCKED`。

## 24. 2026-09-05 饮食业务三页定向验收范围

本批次只对 Diet Records、Intake Analysis 和 Meal Planning 进行交付收口，不执行 105 个画板的全量重新验收。Figma 节点分别为 `640:588`、`640:773`、`640:901`；Figma 文件保持只读。

| 画板 | 前端入口 | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---:|---:|---:|---:|---:|---|
| Diet Records | `/analysis?view=records&state=v2` | `1440×1024 / 1` | `7.9260%` | `2.544206` | `16.833673` | `219` | `DIFF_REVIEW` |
| Intake Analysis | `/analysis?state=v2` | `1440×1024 / 1` | `7.5430%` | `2.004188` | `14.243366` | `211` | `DIFF_REVIEW` |
| Meal Planning | `/planning?state=v2` | `1440×1024 / 1` | `10.8815%` | `1.939608` | `12.962410` | `204` | `DIFF_REVIEW` |

- [x] 三页已完成 Figma 节点级标识、指标环 SVG、餐次图标基线和 Meal Planning 实线边框收口；现有截图和 diff JSON 保留在 `foodmate-ui/.qa/figma-pixel-acceptance/`。
- [x] 三页自动 diff 均已存在且尺寸一致；非零差异继续保留 `DIFF_REVIEW`，不以结构检查或截图存在替代像素级 `PASS`。
- [ ] 本批次不重新执行 105 个画板的全量人工复核；其它画板的历史状态不因本批次改变。
- [x] 三页定向测试和必要工程门禁已集中执行：3 个测试文件、27 个用例通过；`npm run typecheck`、`npm run build`、`npm run lint`、`npm run format:check` 和 `git diff --check` 均通过。

## 25. 2026-09-06 Knowledge 页面状态证据收口

本批次只复核 Knowledge 页面，Figma 文件保持只读，不执行 105 个画板的全量重新截图和人工验收。实时设计节点为主节点 `795:838`，状态节点为 `795:786`、`795:968` 和 `795:1151`。

| 画板 | 前端入口 | 视口 / DPR | 差异比例 | 结论 |
|---|---|---:|---:|---|
| Knowledge Empty | `/knowledge?state=empty` | `1440×1024 / 1` | `40.8765%` | `DIFF_REVIEW` |
| Knowledge Search Failed | `/knowledge?state=search-failed` | `1440×1024 / 1` | `39.9119%` | `DIFF_REVIEW` |
| Knowledge Source Unavailable | `/knowledge?state=source-unavailable` | `1440×1024 / 1` | `39.8908%` | `DIFF_REVIEW` |

- [x] 三项均已登记 Figma PNG、浏览器 PNG 和 diff JSON；浏览器条件为 Chrome `152.0.7977.77`、字体 `loaded`、无横向溢出和 DPR `1`。
- [x] `npm run qa:figma:validate` 返回 `structuralPass=true`、`strictDprPass=true`、`errors=[]`，但 `mappedPass=0`、`diffReview=105`；结构通过不替代像素级 `PASS`。
- [x] Knowledge 与 WorkspaceLayout 定向测试共 `19/19` 个用例通过；typecheck、build、lint、format check 和 `git diff --check` 均通过。
- [ ] 本批次不改变其它画板的历史证据，不代表 105 个画板完成全量人工验收；shadcn 全量页面迁移和 iconfont 实体资源登记继续保持未完成，iconfont 为 `BLOCKED`。

## 26. 2026-09-06 Profile 页面视觉收口与 19 项状态证据

本批次只复核 Profile 页面，Figma 文件保持只读，不执行 105 个画板的全量重新截图和人工验收。主设计节点为 `806:1119`、`806:1281`、`806:1445`、`806:1585`；状态节点为 `792:212`、`794:212`、`794:380`、`794:548`、`794:693`、`794:838`、`794:984`、`794:1127`、`795:212`、`795:356`、`795:499`、`795:642`、`1013:2`、`1013:235`、`1013:465`。

| 画板 | Figma 节点 | 前端入口 | 视口 / DPR | 差异比例 | MAE | RMSE | 最大通道差异 | 结论 |
|---|---|---|---:|---:|---:|---:|---:|---|
| `profile-basic` | `806:1119` | `/profile?state=basic` | `1440×1024 / 1` | `66.0702%` | `5.251134` | `21.538661` | `239` | `DIFF_REVIEW` |
| `profile-memories` | `806:1281` | `/profile?state=memories` | `1440×1024 / 1` | `38.7855%` | `5.546463` | `24.744490` | `238` | `DIFF_REVIEW` |
| `profile-security` | `806:1445` | `/profile?state=security` | `1440×1024 / 1` | `22.8652%` | `4.075227` | `20.541921` | `229` | `DIFF_REVIEW` |
| `profile-privacy` | `806:1585` | `/profile?state=privacy` | `1440×1024 / 1` | `36.1713%` | `4.618948` | `20.425740` | `229` | `DIFF_REVIEW` |
| `profile-basic-avatar-uploading` | `792:212` | `/profile?state=basic-avatar-uploading` | `1440×1024 / 1` | `48.7142%` | `2.833955` | `16.570734` | `229` | `DIFF_REVIEW` |
| `profile-basic-avatar-failed` | `794:212` | `/profile?state=basic-avatar-failed` | `1440×1024 / 1` | `48.7807%` | `2.969719` | `17.669842` | `255` | `DIFF_REVIEW` |
| `profile-basic-unsaved-leave-confirmation` | `794:380` | `/profile?state=basic-unsaved-leave-confirmation` | `1440×1024 / 1` | `78.7775%` | `5.912527` | `19.283831` | `255` | `DIFF_REVIEW` |
| `profile-security-password-submitting` | `794:548` | `/profile?state=security-password-submitting` | `1440×1024 / 1` | `20.1860%` | `2.709615` | `16.744802` | `235` | `DIFF_REVIEW` |
| `profile-security-password-success` | `794:693` | `/profile?state=security-password-success` | `1440×1024 / 1` | `19.9485%` | `2.587735` | `16.211693` | `235` | `DIFF_REVIEW` |
| `profile-security-password-failed` | `794:838` | `/profile?state=security-password-failed` | `1440×1024 / 1` | `20.0730%` | `2.697211` | `16.540252` | `255` | `DIFF_REVIEW` |
| `profile-privacy-export-queued` | `794:984` | `/profile?state=privacy-export-queued` | `1440×1024 / 1` | `39.3203%` | `3.302138` | `15.236541` | `229` | `DIFF_REVIEW` |
| `profile-privacy-export-running` | `794:1127` | `/profile?state=privacy-export-running` | `1440×1024 / 1` | `39.3193%` | `3.662119` | `17.114831` | `246` | `DIFF_REVIEW` |
| `profile-privacy-export-expired` | `795:212` | `/profile?state=privacy-export-expired` | `1440×1024 / 1` | `39.3203%` | `3.368664` | `15.672769` | `246` | `DIFF_REVIEW` |
| `profile-privacy-deletion-submitting` | `795:356` | `/profile?state=privacy-deletion-submitting` | `1440×1024 / 1` | `78.2281%` | `4.537254` | `17.428085` | `235` | `DIFF_REVIEW` |
| `profile-privacy-deletion-success` | `795:499` | `/profile?state=privacy-deletion-success` | `1440×1024 / 1` | `39.1189%` | `3.229173` | `15.292409` | `234` | `DIFF_REVIEW` |
| `profile-privacy-deletion-failed` | `795:642` | `/profile?state=privacy-deletion-failed` | `1440×1024 / 1` | `28.7659%` | `2.606132` | `15.890234` | `255` | `DIFF_REVIEW` |
| `profile-memories-empty` | `1013:2` | `/profile?state=memories-empty` | `1440×1024 / 1` | `81.8808%` | `4.934674` | `20.223495` | `227` | `DIFF_REVIEW` |
| `profile-security-logout-confirm` | `1013:235` | `/profile?state=security-logout-confirm` | `1440×1024 / 1` | `50.9917%` | `5.236346` | `21.237609` | `226` | `DIFF_REVIEW` |
| `profile-privacy-delete-confirm` | `1013:465` | `/profile?state=privacy-delete-confirm` | `1440×1024 / 1` | `55.1684%` | `3.811191` | `19.816504` | `226` | `DIFF_REVIEW` |

- [x] Profile `state=basic` fixture 已按实时 Figma 恢复八字段双列资料表单，主卡高度为 `520px`；Profile 侧栏、顶栏和页面状态均已与本批次截图同步。
- [x] 19 项浏览器证据均由 Chrome `152.0.7977.77` 在 `1440×1024`、DPR `1`、字体 `loaded`、无横向溢出条件下采集；截图、映射、运行时检查和 diff JSON 的日期统一为 `2026-09-06`。
- [x] `figma-105-mapping.json`、`figma-105-runtime-checks.json` 和 `figma-105-diff-results.json` 已更新；当前聚合为 `total=105`、`automatedDiffInputs=105`、`unmapped=0`、`sizeMismatch=0`。
- [x] ProfilePage 与 WorkspaceLayout 定向测试为 `2` 个测试文件、`37/37` 个用例通过；`npm run typecheck`、`npm run build`、`npm run lint`、`npm run format:check`、`npm run qa:figma:validate` 和 `git diff --check` 均通过。
- [ ] 19 项自动 diff 均为非零差异，尚未完成逐项人工视觉复核，全部保持 `DIFF_REVIEW`；本批次不将结构检查、截图存在或代码测试通过替代像素级 `PASS`。
- [ ] 当前全量聚合仍为 `105 DIFF_REVIEW / 0 PASS / 0 UNMAPPED / 0 SIZE_MISMATCH`；本批次不重新验收其它 86 个画板，shadcn 全量逐页视觉迁移和 iconfont 实体资源登记仍未完成，iconfont 继续为 `BLOCKED`。

## 27. 2026-09-06 Auth 页面组 shadcn 控件迁移审计

本节记录 Auth 页面组的控件基础设施审计，不重新采集 105 个画板，也不替换已有 Auth Figma 与浏览器证据。审计范围为 Login、Register、Forgot Password、Reset Password 和 Token Status。

- [x] `AuthVisual` 使用 `src/components/ui/button.tsx` 与 `src/components/ui/input.tsx` 提供共享 Button/Input；页面上的提交、返回、密码显隐、辅助操作和状态操作均通过这些组件实现。
- [x] Auth 页面未发现可见原生 `button`、`input`、`select` 或 `textarea` 控件；Login 的隐藏文件输入不在页面实现中，故不存在以原生控件替代 shadcn 控件的问题。
- [x] Figma 资源映射、语义 Token、字体和动画契约保持原状；Auth 13 个已登记画板继续使用 `1440×900 / DPR 1` 证据。
- [ ] Auth 13 个 diff 仍为非零差异，当前结论保持 `DIFF_REVIEW`；控件迁移审计通过不等于像素级 `PASS`，也不关闭其余页面的 shadcn 审计和 iconfont `BLOCKED`。

## 28. 2026-09-06 Workspace/Home 与 Agent Chat shadcn 控件迁移审计

本节记录 Workspace/Home、Agent Chat 和共享工作区组件的控件基础设施审计，不重新采集 105 个画板，也不替换既有 Workspace 与 Agent Chat 证据。

- [x] `WorkspaceLayout` 使用 shadcn `Button`、`Input`、`DropdownMenu` 和 `Dialog` 覆盖新建任务、会话搜索、账户菜单、会话重命名、删除、回收站和窗口操作。
- [x] `HomePage` 与 `Composer` 使用 shadcn `Input`/`Button`；隐藏文件输入仅用于附件选择，不替代可见页面控件。
- [x] `ChatPage` 使用 shadcn `Tabs`、`Card`、`Alert`、`RadioGroup` 和 `Button`；Agent 卡片及会话列表的操作入口均通过共享 UI 组件承载。
- [x] 当前代码中 Workspace/Home 与 Agent Chat 相关目录没有 `AdminPrimitives` 直接引用，且没有新增 iconfont 字体或虚构 Unicode 映射。
- [ ] Workspace Home 与 Agent Chat 仍存在整页自动 diff 和待人工复核项，控件迁移审计通过不等于像素级 `PASS`；页面视觉 Token 和布局差异仍需后续处理。

## 29. 2026-09-06 Diet Records、Intake Analysis、Meal Planning shadcn 控件迁移审计

本节记录 Diet Records、Intake Analysis、Meal Planning 及其共享规划组件的控件基础设施审计，不重新采集 105 个画板，也不替换既有饮食业务 Figma 与浏览器证据。

- [x] Diet Records 的记录、编辑、添加食物和状态操作使用 shadcn `Button`、`Dialog`、`Input`；Intake Analysis 的操作和加载状态使用 shadcn `Button`、`Skeleton`。
- [x] Meal Planning 与 `MealPlanningFlow` 使用 shadcn `Button`、`Checkbox`、`Input`、`RadioGroup`、`Select`；共享餐食表格使用 shadcn Table，购物清单保留共享 UI 组件。
- [x] 三页相关代码未发现 `AdminPrimitives` 直接引用或虚构 iconfont 映射；真实模式服务边界和 Figma fixture 状态未因审计改变。
- [ ] 三页当前自动 diff 仍为非零差异，结论继续保持 `DIFF_REVIEW`；控件审计通过不等于页面像素级 `PASS`，布局 Token 和人工复核仍需继续。
