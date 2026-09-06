# FoodMate 数据库人工执行记录

> 模板记录。实际执行后必须由执行人填写，不能用应用启动日志替代。

## V2 临时 PostgreSQL 演练（非目标库）

| 字段 | 内容 |
|---|---|
| 数据库 | 临时 Docker PostgreSQL 16，数据库 `FoodMate` |
| 环境 | local SQL rehearsal，仅验证脚本，不是用户现有 PostgreSQL |
| 脚本版本 | `V1__init_core_schema.sql` + `V2__m1_account_and_privacy.sql` |
| 执行时间（UTC） | 2026-07-22T13:39:31Z |
| 执行结果 | 基线成功；V2 首次成功；V2 重复执行成功；V2 validation 成功 |
| 备份 | 未对用户目标库执行 DDL，故未创建目标库备份 |
| 回滚结论 | 临时容器验证后已删除；目标库未执行、无需回滚 |

> 该演练不构成目标 `FoodMate` 数据库的正式执行证据。正式执行前仍须按 `BACKUP_AND_ROLLBACK.md` 完成备份、恢复演练和执行人登记。

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | 待填写：local/dev/staging/prod |
| 脚本版本 | 待填写：V1 或 Vn |
| 执行人 | 待填写 |
| 执行时间（UTC） | 待填写 |
| 备份位置与校验和 | 待填写 |
| 执行命令/客户端版本 | 待填写 |
| 执行结果 | 待填写：成功/失败 |
| `validation.sql` 结果 | 待填写 |
| 回滚结论 | 待填写：未执行/已执行及原因 |

执行失败时，保留完整错误、已执行语句范围和恢复动作；不得覆盖原记录。

## V1 营养目录 seed（2026-08-14 已执行并校验，历史快照）

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | local，Docker PostgreSQL 16 容器 `foodmate-postgres` |
| 脚本版本 | `seed/V1__nutrition_usda_seed.sql` |
| 执行方式 | 人工 `psql` 执行；Java 启动不会自动执行 seed |
| 来源 | USDA FoodData Central `SR Legacy`，数据发布时间 `2019-04-01`，API Guide 许可证为 `CC0 1.0` |
| 执行结果 | 成功导入 5 条 `approved` 食材；重复执行返回 `INSERT 0 0`，未重复创建 |
| 校验脚本 | `validation/V1__nutrition_usda_seed_validation.sql` |
| 校验结果 | 通过：非法 seed 行数为 0，5 条均为每 100g 基准；`nutrition_unit_conversions=0`，未推断家庭单位换算 |
| 当时数据量 | `food_logs=8`、`food_log_items=11`、`nutrition_foods=5`、`nutrition_unit_conversions=0`、`approval_requests=6`、`runtime_tool_proposal_inbox=69`；food log 已匹配 7 条、`pending` 4 条 |
| 备份/回滚 | 当前开发阶段按用户决策暂不做数据库备份；seed 使用 `ON CONFLICT DO NOTHING`，未执行回滚 |

## M1-5 food_log_writer 第一切片跨进程回归（历史记录，2026-08-14）

| 项目 | 结果 |
|---|---|
| `M15FoodLogWriterHttpE2ETest` | 通过：真实随机端口 HTTP、Ed25519 Service JWT、PostgreSQL 写入、匹配营养目录和 HTTP 重放不重复创建 |
| `M15FoodLogWriterProposalResultE2ETest` | 通过：真实 RocketMQ Proposal/Result、确认绑定、PostgreSQL 写入、资源 ID 回填和 Proposal 重放不重复创建 |
| 当日范围边界 | 截至该次执行只验证 `food_log.create` 第一切片；拒绝、失败、`superseded` 和其他写操作的完整跨进程验收见下方 2026-08-15 记录 |

## V2 营养单位换算 seed（本地当前复核，2026-08-15）

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | local，运行中的 Docker PostgreSQL 16 容器 `foodmate-postgres` |
| 脚本版本 | `seed/V2__nutrition_usda_portion_seed.sql` |
| 执行方式 | 历史人工 `psql` 执行；本轮只读复核，Java 启动不会自动执行 seed |
| 来源 | USDA FoodData Central `foodPortions`，规则保留 FDC ID 和 portion 序号 |
| 执行结果 | 当前库存在 5 条未删除 `approved` 规则：米饭、鸡胸肉、熟鸡蛋、三文鱼、苹果 |
| 校验脚本 | `validation/V2__nutrition_usda_portion_seed_validation.sql` |
| 校验结果 | 通过：5 条规则的目标单位均为 `g`，倍率和来源版本均符合校验；三文鱼 `3 oz=85 g` 已归一化为 `28.3333 g/oz` |
| 当前只读数据量 | `nutrition_foods=5`、`nutrition_unit_conversions=5`、`food_logs=95`、`food_log_items=128`、`approval_requests=114`、`runtime_tool_proposal_inbox=98`、`operation_audits=569` |
| 备份/回滚 | 当前开发阶段按用户决策暂不做数据库备份；seed 使用幂等 upsert，未执行回滚 |

> 历史执行人和精确执行时间未记录，本条不补写；上面的数据库数量是本轮只读复核快照。

## M1-5 写确认扩展与跨进程回归（2026-08-15）

| 项目 | 结果 |
|---|---|
| Java application | 已实现 `reject`、`failed`、`superseded` 状态；失败时业务执行事务回滚，独立事务写入 `failed` 状态和失败审计 |
| `food_log_writer` | 已支持 `create`、`update`、`delete`、`restore`，update/delete/restore 强制使用资源归属和 `revision` |
| Tool Gateway | 已校验 `proposal_type=tool` 与 `tool_name=food_log_writer`，并映射 confirmation_required、rejected、failed、superseded |
| Java 定向测试 | `ApprovalServiceImplTest` 和 `ToolGatewayServiceTest` 已覆盖新增分支；本轮通过临时本地 JUnit Launcher 实际执行合计 26 条 |
| HTTP 跨进程回归 | `M15FoodLogWriterHttpE2ETest` 通过 11/11：create 基线、rejected、failed 回滚与失败审计、superseded、update、delete、restore、revision 冲突、成功 Proposal 幂等重放、foodPortions 换算 matched 和无规则 pending |
| RocketMQ 跨进程回归 | `M15FoodLogWriterProposalResultE2ETest` 通过 11/11：同上场景；真实 Proposal/Result consumer 验证 Inbox `completed`、结果重放一致和单一完成事实 |
| 数据库与审计断言 | 覆盖资源归属、营养明细快照、换算 `conversion_id`/标准份量、revision 递增/不递增、软删除可见性、审批终态、`approval.failed`、`food_log.*` 业务幂等审计和无额外写入 |
| 数据隔离与范围 | 每个用例使用随机用户、Session、AgentRun、Proposal 和幂等键；未新增表、未执行迁移、未删除既有本地数据、未执行数据库备份 |
| 完整 Maven 验证 | 2026-08-15 最近一次 `mvnw.cmd verify` 已成功完成：6 个 Reactor 模块构建成功；Surefire 执行 221 条测试，0 失败、0 错误，48 条因 Docker/真实环境条件跳过；Spotless 全部通过 |

## V13 M1-5 饮食记录与营养目录（本轮已复核，未重复执行）

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | local，运行中的 Docker PostgreSQL 16 容器 `foodmate-postgres` |
| 脚本版本 | `V13__m1_5_food_log_nutrition_approval.sql` |
| 执行人 | 本轮未执行迁移；复核人为当前 Codex 会话 |
| 执行时间（UTC） | 未知；不补写历史执行时间 |
| 前置确认 | 当时只读查询：`food_logs=1`，因此不能按 V13 的空表前置条件重复执行；当前数据量见上方 V1 seed 记录 |
| 备份 | 当前开发阶段按用户决策暂不做数据库备份；正式生产流程后置 |
| 执行命令/客户端版本 | `docker exec foodmate-postgres psql`，PostgreSQL 16.14 |
| 执行结果 | 未重复执行；本轮只读校验确认五张表、字段、约束、索引存在 |
| 校验脚本 | `validation/V13__m1_5_food_log_nutrition_approval_validation.sql` |
| 校验结果 | 通过：V13 validation 查询确认表/字段/约束/索引存在，旧 `items_json`/`nutrition_json` 不存在；本轮当前只读复核为 `nutrition_foods=5`、`nutrition_unit_conversions=5`。seed 由上方 V1/V2 记录覆盖 |
| 回滚结论 | 未执行；未运行回滚 SQL，也未修改数据 |

执行 V13 前必须确认当前本地数据库无历史 FoodMate 业务数据；如果 `food_logs` 非空，保留脚本异常并先进行数据评审，不能直接绕过前置条件。

## V14 M1-5 写操作统一幂等（本轮已复核，未重复执行）

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | local，运行中的 Docker PostgreSQL 16 容器 `foodmate-postgres` |
| 脚本版本 | `V14__m1_5_operation_idempotency.sql` |
| 执行人 | 本轮未执行迁移；复核人为当前 Codex 会话 |
| 执行时间（UTC） | 未知；不补写历史执行时间 |
| 执行结果 | 未重复执行；本轮只读校验确认 `operation_audits` 幂等字段和索引存在 |
| 校验脚本 | `validation/V14__m1_5_operation_idempotency_validation.sql` |
| 校验结果 | 通过：V14 validation 查询确认 `idempotency_key`、`parameters_digest` 和对应索引存在；审批审计 `approval.propose/confirm/execute` 各 1 条成功记录 |
| 回滚结论 | 未执行；未运行回滚 SQL，也未修改数据 |

## V15 M1-5 餐食计划生命周期（本轮已执行并校验）

| 字段 | 内容 |
|---|---|
| 数据库 | `FoodMate` |
| 环境 | local，运行中的 Docker PostgreSQL 16 容器 `foodmate-postgres` |
| 脚本版本 | `V15__m1_5_meal_plan_lifecycle.sql` |
| 执行人 | 当前 Codex 会话；未补写未单独记录的具体执行时间 |
| 前置确认 | 保留现有餐食计划数据后执行，未删除既有计划或购物清单 |
| 备份 | 当前开发阶段按用户决策暂不做数据库备份；正式生产流程后置 |
| 执行命令/客户端版本 | `docker exec foodmate-postgres psql`，PostgreSQL 16.14 |
| 执行结果 | 成功：新增 `meal_plans.idempotency_key`、`meal_plans.revision`、版本约束和两个索引；现有计划与购物清单保留 |
| 校验脚本 | `validation/V15__m1_5_meal_plan_lifecycle_validation.sql` |
| 校验结果 | 通过：字段、索引存在，`invalid_meal_plan_revisions=0` |
| 回滚结论 | 未执行；未运行回滚 SQL |

本轮另完成本地 Java HTTP 回归：创建幂等重放、计划查询/修改、stale `revision` 返回 409、校验/保存、购物清单聚合、修改后清单失效、软删除隐藏和恢复均通过。测试账号、计划和清单已在回归结束后清理。

## M1-6 统一审计与指标代码验证（2026-08-18）

| 字段 | 内容 |
|---|---|
| 环境 | 当前 Codex Windows 工作区；Docker Desktop 未运行，因此未执行真实 PostgreSQL/Redis/RocketMQ 流量或故障注入 |
| 实现 | 新增统一 `OperationAuditPort` PostgreSQL 适配器、失败独立事务审计、脱敏安全摘要、低基数 Java Micrometer 与 Python readiness RuntimeMetrics；饮食/餐食计划审计回放只保留资源摘要 |
| Java 定向验证 | `.\mvnw.cmd --% -pl foodmate-infra,foodmate-application -am -Dtest=OperationAuditServiceTest,FoodLogServiceImplTest,MealPlanServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：18 tests，0 failure/error |
| Python 定向验证 | 先前本轮已执行 `.\agent-runtime\.venv\Scripts\python.exe -m pytest agent-runtime\tests\test_eval_metrics.py agent-runtime\tests\test_mq_runtime.py agent-runtime\tests\test_runtime_server.py -q`：40 passed，1 warning |
| 流量/故障入口 | 已新增 `script/local/m1-6-traffic-recovery.ps1`；默认仅 readiness/Compose 预检，`-EnableFaultInjection` 才重启 Redis。当前未运行，未产生吞吐、延迟、队列或恢复时间数据 |
| 结论 | 审计与观测代码测试通过；共享 Redis/RocketMQ Agent 业务流量、PostgreSQL/Java/Python/RocketMQ 重启、ACK 丢失、重复投递与 SSE 恢复仍未执行，M1-6 整体保持未完成 |

## M2-3 管理后台真实接口与前端业务切片（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动生产/staging，不执行数据库迁移、清库、备份恢复或性能测试 |
| 分支 | `codex/m2-functional-completion` |
| 后端范围 | 真实管理查询、用户状态/会话撤销、工具/知识库/回收站/审计操作、模型治理接口的分页、RBAC、revision、幂等、确认和审计契约已接入 |
| 前端范围 | real 模式用户管理、AgentRun/ToolCall/SQLAudit 分页查询、工具/知识库/审计/回收站/模型治理，以及概览真实运行查询和加载/空态/错误态 |
| 用户切片提交 | `1d0d875 feat(管理后台): 接入真实用户管理接口` |
| AgentRun 切片提交 | `af3b761 feat(管理后台): 接入 AgentRun 分页查询` |
| 概览切片提交 | `fa30227 fix(管理后台): 移除概览页真实模式伪造指标` |
| 前端验证 | `npm run typecheck` 通过；UsersTab 4/4、RunsTab 3/3、AdminPage 8/8 通过 |
| Java 验证 | `AdminUserControllerRbacTest`、`AdminManagementControllerTest` 共 4/4 通过；API/application 编译通过 |
| 失败记录 | 首次从 `foodmate-ui` 子目录执行仓库根路径 `git add`，路径不匹配且未提交；随后从仓库根目录按文件范围正确提交，未改变其他工作区文件 |
| 结论 | M2-3 管理后台核心业务切片已完成；M2-1 知识库真实跨运行时闭环、M2-2 Tool Gateway/SQL Agent、全量 `verify`/Docker 联调和生产强化仍未完成 |

## M2-1/M2-2 核心业务定向验证（2026-08-22）

| 项目 | 结果 |
|---|---|
| Java 命令 | `mvnw.cmd -pl foodmate-application -am -Dtest=KnowledgeServiceImplTest,KnowledgeOutboxPublisherTest,KnowledgeIndexResultMessageProcessorTest,ToolRegistryServiceTest,ToolPolicyGatewayServiceTest,ToolGatewayServiceTest,ToolGatewayAstGuardTest,SqlSchemaCatalogServiceTest,SqlQueryPlanValidatorTest,JSqlParserQueryGuardTest -Dsurefire.failIfNoSpecifiedTests=false test` |
| Java 结果 | 51/51 通过，0 failure/error；覆盖知识状态/Outbox/结果处理、工具 Registry/Policy、SQL Catalog/AST Guard 和计划校验 |
| Python 命令 | `agent-runtime/.venv/Scripts/python.exe -m pytest tests/test_knowledge_rag.py tests/test_knowledge_worker.py tests/test_sql_planner.py -q`（工作目录 `agent-runtime`） |
| Python 结果 | 21/21 通过；覆盖解析/分块、stub/local 检索与 SQL Planner 契约 |
| 环境边界 | 本轮未启动 Docker Milvus/PostgreSQL/RocketMQ，未调用付费 embedding/API Key，未执行跨进程数据库查询或知识引用 SSE 回归 |
| 结论 | M2-1/M2-2 核心代码和业务定向测试通过；真实本地依赖联调仍未完成，性能、重启、ACK、重复投递和生产验证继续暂缓 |

## M2-1/M2-2/D1 业务门禁复核（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动 Docker、staging/production，不执行数据库迁移、清库、备份恢复或付费模型调用 |
| 分支与提交 | `codex/m2-functional-completion`；知识索引闭环格式修复 `b02e8b2`，其前置索引结果重试/检索/可见性提交为 `70b5fc9`、`ed32411`、`58c3d57` |
| Java 知识业务测试 | `mvnw.cmd --% -pl foodmate-application -am test -Dtest=KnowledgeIndexResultMessageProcessorTest,KnowledgeOutboxPublisherTest,KnowledgeUploadValidationTest,KnowledgeServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false`：15/15 通过 |
| Java 全量业务测试 | `mvnw.cmd verify` 已完成 Shared 12/12、Application 125/125，0 failure/error；随后在 Application Spotless 阶段因用户未提交的 `OperationAuditService.java` import 顺序失败，未进入后续模块 |
| Python 业务测试 | `agent-runtime\.venv\Scripts\python.exe -m pytest`：92 passed、1 skipped、2 warnings；跳过项为真实云集成 |
| 前端业务门禁 | `npm.cmd run typecheck` 通过；`npm.cmd run build` 通过 |
| 已验证范围 | Java 索引结果校验/重试边界/Outbox、Python PDF/DOCX/Markdown/TXT 解析与 stub/local RAG、Redis 索引逻辑、可见性版本隔离、工具/SQL 业务契约和管理端核心查询/权限切片 |
| 未执行范围 | 真实 PostgreSQL/Redis/RocketMQ/Milvus 联调、上传 -> 索引 -> 发布 -> AgentRun -> SSE、SQL Agent 真实数据库联调、吞吐/延迟/积压统计、组件重启、ACK 丢失、重复投递、SSE Last-Event-ID 故障验证 |
| 数据与迁移 | 本轮未执行迁移、truncate、备份恢复或既有本地数据清理 |
| 结论 | M2-1/M2-2 核心代码与业务测试完成，M2-3 核心管理切片已有证据；真实依赖闭环和性能/故障/生产验证保持后置，不更新为整体完成 |

## M2-1 用户真实检索与餐食规划前端切片（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动 Docker、staging/production，不执行数据库迁移、清库、备份恢复或付费模型调用 |
| 后端提交 | `3db1001 feat(计划): 增加用户计划列表查询`；新增 `GET /api/meal-plans`，按当前用户返回计划及软删除状态，application/infra/API 定向测试通过 |
| 前端提交 | `bff8bec feat(计划): 接入真实餐食规划页面`；real 模式读取 `/api/meal-plans`，列表按服务端状态筛选，详情使用服务端 `days_plan`/约束；fixture 模式保持不变 |
| 前端测试 | `npm test`：33 个测试文件、163 项通过；`npm run typecheck` 通过；`npm run build` 通过；目标文件 Prettier 检查通过 |
| Java 定向测试 | 计划 application/API 测试共 11 项通过：`MealPlanServiceImplTest` 7/7、`MealPlanControllerTest` 4/4 |
| 业务边界 | 本轮只完成用户计划列表/详情读取和页面 real 接入；规划创建向导写入、重新生成、购物清单真实查询仍未接入 |
| 未执行范围 | 知识库上传 -> 索引 -> 发布 -> AgentRun -> SSE 真实跨运行时闭环、Milvus/Redis/RocketMQ 联调、SQL Agent 真实数据库联调、吞吐/延迟/积压统计、组件重启、ACK 丢失、重复投递、SSE Last-Event-ID 故障验证 |
| 结论 | 餐食规划读取主路径具备代码和业务测试证据；M2-1 整体仍不标记完成，真实依赖、跨运行时和性能/故障验证继续后置 |

## M2-1 用户餐食规划 real 前端切片（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动 Docker、staging/production，不执行数据库迁移、清库、备份恢复或付费模型调用 |
| 分支 | `codex/m2-functional-completion` |
| 功能提交 | `3db1001` 计划列表 API；`bff8bec` 真实列表/详情；`be75aba` 已保存计划购物清单；`97af296` 真实创建向导；`132cd40` 空计划用户进入真实创建向导 |
| 业务行为 | real 模式读取 `/api/meal-plans`；创建向导通过带 `Idempotency-Key` 的 `POST /api/meal-plans` 创建确定性本地餐表；详情展示服务端 `days_plan`/约束；saved 计划读取 `/api/meal-plans/{id}/shopping-list` |
| 前端验证 | `npm.cmd test`：33 个测试文件、165/165 通过；`npm.cmd run typecheck` 通过；`npm.cmd run build` 通过 |
| 测试重点 | 覆盖服务端计划展示、创建向导提交、空计划进入向导、购物清单读取；fixture 模式既有交互保持通过 |
| 业务边界 | 创建使用确定性本地餐表，不调用云模型；重新生成仍需通过 AgentRun；本轮未执行真实 Java HTTP 服务、Docker 依赖或知识库跨运行时索引/引用闭环 |
| 数据与迁移 | 未执行迁移、truncate、备份恢复或既有本地数据清理 |
| 结论 | 餐食规划用户 real 前端主路径具备业务测试证据；M2-1 知识库整体状态不变，真实依赖闭环与性能/故障验证继续后置 |

## M2-1 管理批次与聊天引用前端切片（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动 Docker、staging/production，不调用付费模型或真实 embedding，不执行数据库迁移 |
| 分支 | `codex/m2-functional-completion` |
| 功能提交 | `2aeda60` 聊天知识库引用改为可展开控件；`b744858` 管理端批次上传后的进度状态、失败重试反馈与 real 业务测试 |
| 管理端行为 | real 模式批量上传携带来源/版本/授权和 `Idempotency-Key`；读取批次详情/SSE；索引失败条目显示错误码，重试期间禁用按钮，重试失败显示告警，成功后刷新条目状态和文档列表 |
| 聊天行为 | `run.completed.citations` 继续由 SSE 注入运行轨迹，引用标题、版本/章节和安全片段通过可展开引用块展示，不显示对象存储地址 |
| 前端验证 | `npm.cmd test`：35 个测试文件、167/167 通过；`npm.cmd run typecheck` 通过；`npm.cmd run build` 通过 |
| 业务边界 | 本轮验证的是前端 API 契约与状态行为；未执行真实 Java/Python/RocketMQ/Milvus 上传 -> 索引 -> 发布 -> AgentRun 闭环，性能、重启、ACK 和重复投递测试继续暂缓 |
| 数据与迁移 | 未执行迁移、truncate、备份恢复或既有本地数据清理 |
| 结论 | K4 管理端批次和聊天引用前端主路径已有业务测试证据；M2-1 整体仍不更新为真实跨运行时完成 |

## M2 业务门禁最终复核（2026-08-22）

| 项目 | 结果 |
|---|---|
| Python 命令 | `agent-runtime\.venv\Scripts\python.exe -m pytest -q` |
| Python 结果 | 92 passed、1 skipped、2 warnings；跳过项为真实云集成，未调用付费模型或真实 embedding |
| Java 命令 | `mvnw.cmd -pl foodmate-application -am test -Dtest=KnowledgeIndexResultMessageProcessorTest,KnowledgeOutboxPublisherTest,KnowledgeUploadValidationTest,KnowledgeServiceImplTest,ToolRegistryServiceTest,ToolPolicyGatewayServiceTest,ToolGatewayServiceTest,ToolGatewayAstGuardTest,SqlSchemaCatalogServiceTest,SqlQueryPlanValidatorTest,JSqlParserQueryGuardTest -Dsurefire.failIfNoSpecifiedTests=false` |
| Java 结果 | 56/56 通过，0 failure/error/skipped；覆盖知识索引结果/Outbox/上传校验、Tool Registry/Policy/Gateway、SQL Catalog/AST Guard/计划校验 |
| 前端结果 | 本轮最终 `npm.cmd test` 为 35 个测试文件、167/167 通过；`npm.cmd run typecheck` 和 `npm.cmd run build` 通过 |
| 未执行范围 | Docker、Milvus、真实 PostgreSQL/Redis/RocketMQ 跨运行时闭环、吞吐/延迟/积压、组件重启、ACK 丢失、重复投递和 SSE Last-Event-ID 故障验证 |
| 结论 | M2 核心业务代码和业务门禁通过；真实依赖联调、性能和故障恢复不作为当前完成证据，保持后置 |

## M2-3 受控脱敏运营导出与 Java 格式基线（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未执行数据库迁移、清库、备份恢复或真实模型/Embedding 调用 |
| 分支与提交 | `codex/m2-remaining-business`；`78302d5 style(java): 统一后台模块 Java 格式`；`3d2959b feat(admin): 增加受控脱敏运营导出` |
| 后端范围 | 新增 V23 管理导出任务表、application 导出白名单/角色/幂等/任务处理、私有对象存储下载和统一审计；最大 100 条，仅输出安全运营摘要 |
| API 范围 | `POST /api/admin/exports`、`GET /api/admin/exports/{id}`、`POST /api/admin/exports/{id}/download`；admin 禁止 users/deleted 资源，superadmin 才可导出全安全资源 |
| 前端范围 | 操作审计 real 页面增加当前结果导出、任务状态查询和一次性 JSON 下载；fixture 模式不调用真实导出接口 |
| Java 业务验证 | `mvnw.cmd -pl foodmate-api -am -Dtest=AdminExportServiceTest,AdminExportControllerTest -Dsurefire.failIfNoSpecifiedTests=false test`：7/7 通过 |
| Java 编译/格式 | API、application、infra 编译通过；受影响模块 Spotless 通过；同时修复后台基线 11 个 Java 文件格式 |
| 前端验证 | `npm.cmd run typecheck` 通过；`npm.cmd run build` 通过 |
| SQL 状态 | 已新增 `V23__m2_3_admin_export_jobs.sql`、validation 和 rollback 前置检查；本轮未执行迁移，未改变本地数据 |
| 环境边界 | 未启动 Docker/Milvus；未执行真实对象存储下载、跨运行时索引、性能压测、组件重启或故障注入 |
| 结论 | 管理端脱敏运营导出业务代码和定向门禁通过；M2 总体和真实依赖闭环状态不变 |

## M2-1 本地 deterministic embedding 与 Milvus 业务路径（2026-08-22）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；仅启动 Compose 的 `milvus`、`milvus-etcd`、`milvus-minio`；未启动 Java、PostgreSQL、Redis、RocketMQ，不执行迁移、清库、备份恢复或付费模型调用 |
| 配置 | `FOODMATE_RAG_MODE=local`、`FOODMATE_RAG_EMBEDDING_PROVIDER=deterministic`、16 维向量、隔离集合 `foodmate_knowledge_codex_local_20260822` |
| Python 业务测试 | `.\agent-runtime\.venv\Scripts\python.exe -m pytest -q`：99 passed、1 skipped、2 warnings；知识 RAG/Worker 定向测试 28 passed |
| Docker 静态检查 | `docker compose --env-file .env -f docker/compose.yml config --quiet`：通过 |
| 首次联调失败 | Milvus 2.5.5 创建字符串主键时要求 `max_length`；同时 Compose 使用了该镜像不识别的 `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`，导致 MinIO 认证失败和 Milvus 退出 |
| 修复 | Milvus collection 创建增加 `max_length=128`；改用 `MINIO_ACCESS_KEY_ID`/`MINIO_SECRET_ACCESS_KEY` 传递 Compose 凭据 |
| 实际业务结果 | deterministic 向量生成、按实际维度建集合、chunk upsert、发布 metadata、带 ACL 过滤检索均通过；返回标题 `Local RAG Guide`、版本 `v1`、章节 `Recovery`、chunk `emb_local_1` |
| 数据处理 | 测试集合为本轮专用命名空间，验证后删除该集合；未删除任何既有业务集合或命名卷；容器已停止但卷保留 |
| 未执行范围 | 真实 embedding API、Java -> RocketMQ -> Python 跨运行时上传闭环、性能压测、组件重启、ACK 丢失、重复投递、SSE Last-Event-ID 故障验证继续暂缓 |
| 结论 | local deterministic + Milvus 业务适配和 Docker 依赖路径具备本地证据；真实 provider 仍需显式配置后单独验证，M2-1 整体不据此标记完成 |

## M3 可审计人工 DLQ 重放 Outbox（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 00:43-00:47 (Asia/Shanghai) |
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；Java 21；未启动 Java、PostgreSQL、Redis、RocketMQ；未执行迁移、清库、备份恢复或消息重放 |
| 功能提交 | `1cad651 feat(dlq): 增加可审计的人工重放 Outbox` |
| 数据变更 | 新增 `V24__m3_dlq_replay.sql`、validation、rollback；增加 `raw_payload_text` 和 `runtime_dlq_replay_outbox`；本轮未运行迁移 |
| API | `POST /api/admin/dlq/{dlqId}/replay`；仅 superadmin，必须确认摘要和幂等键；响应不返回 payload |
| Relay | 仅 `foodmate.runtime.transport=rocketmq` 时发布；保留原消息身份属性，记录新的 Broker message ID；发布确认后才收敛原 DLQ |
| 安全边界 | 原始 payload 只保存在受限 replay Outbox；不进入审计 metadata、管理查询 DTO 或 API 响应；Topic/Group 必须匹配配置 |
| Java 验证 | `mvnw.cmd -pl foodmate-application,foodmate-api,foodmate-infra -am test -Dtest=RuntimeDlqReplayServiceImplTest,RuntimeDlqReplayPublisherTest,AdminDlqReplayControllerTest,FlywayV24MigrationScriptTest -Dsurefire.failIfNoSpecifiedTests=false`：10/10 通过 |
| 格式验证 | `mvnw.cmd -pl foodmate-application,foodmate-api,foodmate-infra -am spotless:check`：通过 |
| 未执行范围 | 未连接 RocketMQ 实际发布/消费，未执行重试耗尽、真实重放后的业务副作用对账、性能压测、组件重启、ACK/重复投递和 SSE 故障验证 |
| 结论 | 人工重放 Outbox 的权限、确认、幂等、失败关闭、发布属性和迁移契约具备代码及业务测试证据；不计为真实消息重放完成 |

## M3 前置：DLQ 安全摘要运营可见性（2026-08-23）

| 项目 | 结果 |
|---|---|
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；未启动 Java、PostgreSQL、Redis、RocketMQ，不执行迁移、清库、备份恢复或消息重放 |
| 分支与提交 | `codex/m2-remaining-business`；`9d4cea9 feat(admin): 增加死信摘要查询`；`f76fbcf feat(admin-ui): 接入死信摘要治理视图` |
| 后端范围 | 管理查询资源 `GET /api/admin/queries/dlq`；支持关键词、对账状态、排序和分页；复用既有 `runtime_message_dlq` 表，不新增迁移 |
| 安全范围 | DTO/SQL/API/UI 只返回消息身份、来源、关联标识、attempt/reconsume 次数、稳定错误码、对账状态和时间；不返回 `raw_payload_json`、`last_error` |
| Java 验证 | `mvnw.cmd -pl foodmate-application,foodmate-api -am test -Dtest=AdminOperationalQueryServiceImplTest,AdminOperationalQueryControllerTest -Dsurefire.failIfNoSpecifiedTests=false`：应用 4/4、API 3/3 通过；infra `FlywayV6MigrationScriptTest` 3/3 通过；受影响模块 Spotless 通过 |
| 前端验证 | `npm.cmd run typecheck` 通过；`npm.cmd run test -- --run src/pages/AdminPage/tabs/RunsTab.test.tsx src/pages/AdminPage/tabs/RunsTab.real.test.tsx`：4/4 通过；`npm.cmd run build` 通过；全量 `format:check` 仍受仓库既有 77 个未格式化文件阻塞，未执行整库格式化 |
| 未执行范围 | 人工重放、Run 终态改写、死信删除、真实 RocketMQ 对账、性能/故障矩阵和生产验证 |
| 结论 | 仅完成 DLQ 安全摘要的运营可见性；不将其计为人工重放、完整死信处理或 M3 完成证据 |

## M3 前置：运营审计只读报告（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间（本地） | 2026-08-23T00:24:36+08:00 |
| 环境 | Windows 本地工作区；未启动 Java、PostgreSQL、Redis、RocketMQ；未执行迁移、truncate、备份恢复或消息重放 |
| 功能提交 | `850ba8f feat(audit): 增加运营审计只读报告` |
| API | `GET /api/admin/audit-reports/current`；只读返回审计、Outbox、知识索引、DLQ 的聚合计数、最早时间和稳定原因码 |
| 安全校验 | infra Mapper 契约测试确认查询不包含 `request_json`、`response_json`、`raw_payload_json` 或 `last_error`；普通用户 API 鉴权返回 `FORBIDDEN` |
| Java 验证 | application 3/3、API 2/2、infra 1/1；受影响模块编译通过；Spotless 检查通过 |
| 失败/阻塞 | 首次并行 Maven 定向测试因未使用 `-am` 和 `target` 并发产生既有依赖编译/测试选择错误；改为串行 reactor 命令后通过，未修改业务代码 |
| 数据影响 | 仅新增代码和测试，未连接目标数据库、未写入或清理本地业务数据 |
| 结论 | 报告第一切片的代码/业务测试证据成立；实时数据库结果、历史归档和生产告警仍未验证 |

## M3 数据保留治理与外部清理任务（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 01:19-01:29 (Asia/Shanghai) |
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；Java 21；使用 `agent-runtime\.venv`；未启动 Java、PostgreSQL、Redis、RocketMQ、对象存储或 Milvus |
| 功能提交 | `68bba07`/`67c3b18` 保留策略、冻结和审批；`1939f92` Python 清理 Worker；`f98d8c8` Java 清理 Relay、结果消费者和 active hold 原子领取 |
| Java 代码范围 | `DataRetentionTaskPublisher` 对象存储受限删除和向量 Topic 投递；`DataRetentionResultMessageProcessor` 消费 `foodmate-knowledge-purge-result-v1`；任务成功/失败/重试和申请状态回写；数据库任务明确保持 pending |
| Python 代码范围 | stub/Redis/Milvus 按 `document_id + version` 删除；`task_id + mode` 完成事实；重复清理不重复产生副作用；index、visibility、purge 三个 Worker consumer 独立发布通道 |
| Python 命令 | 在 `agent-runtime` 执行 `\.venv\Scripts\python.exe -m pytest -q` |
| Python 结果 | `107 passed、1 skipped、1 warning`；跳过项为真实云集成，未调用付费模型或 embedding |
| Java 命令 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am test -Dtest=DataRetentionTaskPublisherTest,DataRetentionResultMessageProcessorTest,DataRetentionDeliveryServiceImplTest,DataRetentionServiceImplTest,FlywayV25MigrationScriptTest -Dsurefire.failIfNoSpecifiedTests=false` |
| Java 结果 | application 保留测试 `15/15`、infra V25 migration 结构测试 `2/2` 通过；编译通过 |
| 格式验证 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am spotless:check` 通过 |
| 安全/数据边界 | `hard_delete_enabled=false` 默认关闭；active legal hold 在任务领取 SQL 中原子阻断；未执行迁移、truncate、对象/向量实际删除、数据库硬删除或现有数据清理 |
| 未执行范围 | 未做真实 RocketMQ 发布/消费、对象存储和 Milvus 联调、性能压测、组件重启、ACK 丢失、重复投递、SSE Last-Event-ID 故障验证；这些按当前决策暂缓 |
| 结论 | 保留治理和清理任务业务代码及定向测试证据成立；真实依赖执行、实际删除和 M3 整体完成状态保持后置 |

## M3/M2-1 本地依赖与 deterministic RAG 业务核验（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 01:39-01:48 (Asia/Shanghai) |
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；Docker Desktop 28.5.1；16 CPU；约 7.4 GiB Docker 内存；Java 21；Python 使用 `agent-runtime\.venv`；未配置真实 embedding API Key、未调用云模型 |
| Docker 启动 | `docker compose --env-file .env -f docker/compose.yml up -d postgres redis minio`；随后分组启动 RocketMQ 和 Milvus 依赖 |
| Docker readiness | PostgreSQL、Redis、MinIO、RocketMQ NameServer、Broker、Proxy、Milvus、Milvus etcd 和 Milvus MinIO 均 healthy；未执行 `down -v`，命名卷保留 |
| RocketMQ 初始化 | `rocketmq-init` 退出码 0；日志确认创建 `foodmate-knowledge-purge-v1`、`foodmate-knowledge-purge-result-v1` 以及 `foodmate-python-knowledge-purge-v1`、`foodmate-java-knowledge-purge-result-v1`；其余 Agent/Knowledge Topic/group 也完成初始化 |
| Compose 校验 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；`init-topics.sh` shell 语法校验通过 |
| Python 业务回归 | `agent-runtime\.venv\Scripts\python.exe -m pytest -q`：107 passed、1 skipped、1 warning；跳过项为显式真实云集成 |
| Milvus 业务核验 | 使用随机隔离集合和 `local + deterministic`：实际向量写入、`published` metadata 更新、`public_published` ACL 检索和引用返回通过；随后删除本轮集合，不删除既有集合或命名卷 |
| Java 业务回归 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am test -Dtest=KnowledgeServiceImplTest,KnowledgeOutboxPublisherTest,KnowledgeIndexResultMessageProcessorTest,KnowledgeSearchServiceImplTest,DataRetentionTaskPublisherTest,DataRetentionResultMessageProcessorTest,DataRetentionDeliveryServiceImplTest,DataRetentionServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false`：29/29 通过 |
| Java 格式 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am spotless:check`：通过 |
| 数据边界 | PostgreSQL 仅做只读 schema 检查；未执行 Flyway/手工迁移、truncate、备份恢复、对象/向量实际保留清理或消息故障注入 |
| 未完成范围 | Java/Python 应用未纳入 Compose，未完成管理员上传 -> Java Outbox -> RocketMQ -> Python Worker -> Java 回写 -> 发布 -> AgentRun/SSE 的真实跨运行时闭环；吞吐、性能、重启、ACK 丢失、重复投递和 Last-Event-ID 故障验证按当前决策暂缓 |
| 结论 | 本轮证明本地依赖 readiness、RocketMQ 清理契约、Python 业务回归、Milvus deterministic 适配和 Java 保留/知识定向业务测试通过；不将 M2-1/M3 整体标记为完成 |

## RocketMQ 业务 E2E 前置核验（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 01:52 (Asia/Shanghai) |
| 命令 | `mvnw.cmd -pl foodmate-bootstrap -am -Dfoodmate.local-mq-e2e=true -Dtest=M14RocketMqTransportE2ETest,M14ProposalResultE2ETest -Dsurefire.failIfNoSpecifiedTests=false test` |
| RocketMQ Outbox 主链路 | `M14RocketMqTransportE2ETest`：1/1 通过；Java Outbox 消息真实到达 Broker 自测消费组，Envelope、request_hash、dispatch_id、消息属性和 published 状态断言通过 |
| Proposal/Result 链路 | `M14ProposalResultE2ETest`：0/2 通过；不是性能或消息传输结论，测试上下文受到数据库前置缺失影响 |
| 真实阻塞证据 | 当前 FoodMate PostgreSQL 未执行 V17/V18/V23/V24/V25 手工 SQL；应用启动后的定时任务查询 `knowledge_index_outbox`、`admin_export_jobs`、`runtime_dlq_replay_outbox` 等不存在表，Tool Registry/SQL Agent 所需业务数据也不完整 |
| 数据边界 | 测试使用随机账号/Run；本轮未执行迁移、truncate、删除、备份恢复或其他故障注入 |
| 处理结论 | 保留 `M14RocketMqTransportE2ETest` 真实通过证据；Proposal/Result 只记录为 schema 前置阻塞，不修改生产代码绕过，也不把该 E2E 记为通过 |

## M2-1 索引闭环本地业务核验（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23（本地业务联调轮次） |
| 环境 | Windows 本地工作区 `D:\develop\FoodMate`；Java 21；Python 使用 `agent-runtime\.venv`；Docker Desktop 本地依赖；未调用付费模型或真实 embedding API |
| 迁移 | 实际执行 V16-V25 增量 SQL，全部成功；未执行 truncate、回滚、备份恢复；保留既有本地数据 |
| 应用配置 | Java 与 Python 显式使用 `deterministic:local`；RAG 业务路径使用本地 deterministic 模式；Compose 运行时地址固定为 `http://agent-runtime:9000` |
| Java 验证 | 知识导入、索引 Outbox、结果消费、批次状态、发布/可见性、用户检索及保留治理定向测试通过；知识与保留相关定向测试合计 29/29 通过 |
| Python 验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：107 passed、1 skipped、1 warning；跳过项为显式真实云集成 |
| Docker 校验 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；PostgreSQL、Redis、MinIO、RocketMQ、Milvus 依赖 readiness 已验证 |
| 跨运行时业务结果 | Java Outbox -> RocketMQ -> Python Worker -> MinIO 读取 -> Java 索引结果回写成功；首次 MinIO 凭据错误产生 `RAG_OBJECT_UNAVAILABLE`，管理员重试后成功；批次最终为 `completed`；文档发布后可见性同步和 Java 用户检索成功；deterministic AgentRun 完成并通过 SSE 返回 2 条安全 citations |
| 测试数据 | 使用随机用户、批次、文档、条目和隔离 RAG 命名空间；本轮测试生成的数据在收尾阶段清理；不删除既有业务数据、命名卷或既有 Milvus 集合 |
| 未执行范围 | Docker 应用镜像因 Docker Hub 网络阻塞未完成真实构建/启动证据；真实云模型/embedding、吞吐与性能压测、Java/Python/数据库/Redis/RocketMQ 重启、ACK 丢失、重复投递故障矩阵和 SSE Last-Event-ID 故障验证继续暂缓 |
| 结论 | M2-1 deterministic 本地业务闭环具备代码、业务测试和依赖联调证据；不将需要真实 Docker 应用镜像或性能/故障证据的范围标记为完成 |

## M2-1 收尾门禁与测试数据清理（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java 门禁 | `\.\mvnw.cmd verify` 最终通过；Shared 12/12、Application 155/155、Infrastructure 68/68（11 skipped）、API 58/58、Bootstrap 57/57（37 skipped），Spotless 和 Spring Boot repackage 均通过 |
| Python 门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：107 passed、1 skipped、2 warnings；未调用付费模型或真实 embedding |
| Compose 门禁 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；本地 PostgreSQL、Redis、MinIO、RocketMQ、Milvus 依赖保持 healthy |
| 门禁修复 | `FoodMateApplicationTest` 暴露 `local-stub` 缺少 `AdminAuditReportRepository` 替身；补齐零数据 stub 后启动上下文通过，提交 `2680b46 fix(local-stub): 补齐运营审计报告替身` |
| PostgreSQL 清理 | 仅清理本轮 3 个随机用户、2 个 Session、2 个 AgentRun、4 条消息、知识批次/条目/文档及其 Outbox/Inbox/SSE/审计事实；事务提交后用户、文档、批次、Run、Session、审计残留均为 0 |
| MinIO 清理 | 精确删除 `foodmate-private/knowledge/public/349616464812052480/guide.md`；删除后 `mc stat` 确认对象不存在 |
| Redis 清理 | 删除本轮 6 个 stub chunk hash 条目、索引完成事实和 4 个 Agent checkpoint key；未删除日期级预算统计或其他隔离空间 |
| Git 边界 | 当前分支 `codex/m2-remaining-business`；本轮提交 `44130fe`、`1b423a5`、`2680b46`；既有 UI/QA 改动保留未提交 |
| 未执行范围 | Docker Java/Python 应用镜像因 Docker Hub 网络阻塞未完成真实构建/启动；性能压测、组件重启、ACK 丢失、重复投递故障矩阵、SSE Last-Event-ID 专项验证、真实云模型/Embedding 和生产环境范围继续暂缓 |

## M2-1 deterministic 跨运行时业务闭环补充（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 03:02-03:24 (Asia/Shanghai) |
| 分支 | `codex/m2-remaining-business`；功能提交 `d2eac6e`、`e3f6b3f`、`de60de2`；用户既有 UI/QA 和 `tmp/` 改动未暂存 |
| 环境 | Windows；Java 21 宿主进程 `18080`；Python 使用 `agent-runtime\\.venv` 宿主进程 `19000`；Docker PostgreSQL、Redis、RocketMQ NameServer/Broker/Proxy、MinIO 均已就绪；Python 使用 Redis checkpoint、RocketMQ 和知识 Worker |
| 上传入口 | 首次使用非法 `source_type=external_import` 被拒绝为 `KNOWLEDGE_SOURCE_UNAUTHORIZED`；合法 `admin_upload` PDF 请求先暴露宿主 multipart 默认 1 MiB 限制，补齐 20 MiB 单文件/420 MiB 请求上限后上传成功 |
| 索引失败与重试 | PDF 首次因宿主 Worker 未注入 MinIO 凭据收敛为 `RAG_OBJECT_UNAVAILABLE`，Java 自动重试至 3 次；管理员重试后该 PDF 被安全解析器拒绝为 `RAG_PDF_UNSAFE` 并再次收敛。新增空分块失败关闭，避免空索引回报成功 |
| 成功索引链路 | 随机 Markdown 批次 `349632053559431168`：Java Outbox -> RocketMQ -> Python MinIO 读取 -> Redis stub index -> `foodmate-knowledge-index-result-v1` -> Java 权威回写，批次 `completed`、条目 `indexed`、attempt `1`；发布后 visibility Outbox 已发布，Redis metadata 为 `published/indexed/current_version` |
| 中文检索 | 修复中文二字片段检索；普通用户查询“低盐饮食 钠含量”返回 1 条安全引用，包含标题、版本、章节、chunk ID 和片段，不含对象键/地址 |
| AgentRun | deterministic 运行 `349633092236873728` 真实完成；SSE 事件序号 `1..6` 连续，Composer `provider_code=deterministic`、Eval `DETERMINISTIC_RULES_PASSED`、`run.completed` 返回 1 条 citations，成本为 `0` |
| 可见性业务 | 同一文档下线后普通用户检索 0 条；恢复只回到 `draft`，检索仍为 0；删除后 PostgreSQL 为 `indexed|deleted|true`，删除 visibility Outbox 已发布 |
| 清理 | 精确清理本轮 2 个随机用户、2 个 Session、2 个 AgentRun、4 条消息、3 个批次/条目/文档及其 Outbox/Inbox/SSE/审计事实；MinIO 删除 3 个本轮对象；Redis 删除隔离 chunks 和 2 个 Worker 完成事实；SQL 复核 users/jobs/docs/runs/sessions 均为 0；未删除日期预算键、既有数据、命名卷或既有 Milvus 集合 |
| 重要纠正 | 第一条 AgentRun 因启动命令错误继承 `.env` 云模型路由，实际产生了 1 次云 Composer 和 1 次云 Judge 请求；该结果不计入 deterministic 证据。随后已重启 Python 并显式锁定全部模型 tier 为 `deterministic:local`，后续有效 AgentRun 未调用云模型。 |
| 未执行范围 | Docker Java/Python 应用镜像因 Docker Hub 网络阻塞未完成构建/启动；真实 embedding API、吞吐/延迟/积压压测、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递和 SSE `Last-Event-ID` 专项验证继续暂缓 |
| 结论 | M2-1 deterministic 本地业务闭环的真实上传、索引、发布、检索、AgentRun 引用、下线/恢复业务证据成立；生产强化和用户明确暂缓的测试不计入完成门槛 |

## M2-1 Chat SSE V1 路由收尾（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 04:28-04:35（Asia/Shanghai） |
| 分支与提交 | `codex/m2-remaining-business`；`c37a2fc 修复(运行时): 统一V1聊天SSE回放入口` |
| 代码变更 | `/api/chat/runs/{runId}/stream` 对已存在的数值型 V1 Run 分流到持久化 `V1RuntimeEventService`；保留旧字符串 Run 的 RuntimeGateway 内存订阅路径；新增 `RunStreamControllerTest` |
| Java 定向验证 | `mvnw.cmd -pl foodmate-api -am test -Dtest=RunStreamControllerTest,ChatControllerTest -Dsurefire.failIfNoSpecifiedTests=false`：3/3 通过；`mvnw.cmd -pl foodmate-bootstrap -am package -DskipTests`：构建通过 |
| 真实业务验证 | 本地随机账号创建 deterministic AgentRun `349652008543719424`，最终状态 `completed`；请求 `/api/chat/runs/349652008543719424/stream` 携带 `Last-Event-ID: 5`，成功回放 `run.completed`，返回稳定 `sse_*` 事件 ID；Run 事件总数为 6，未出现 `runId does not exist`、重复终态或 SSE 缺口 |
| 运行环境 | Windows、Java 21、宿主 Java `18080`、宿主 Python Runtime `19000`、Docker PostgreSQL/Redis/RocketMQ 依赖；模型 tier 固定 `deterministic:local`，未调用付费模型或真实 embedding API |
| 清理 | 精确删除本轮用户 `349652007885213696`、Session `349652008514359296`、Run `349652008543719424`、消息 `349652008778600448` 及关联 Inbox/Outbox/SSE/审计；Redis checkpoint 2 个键删除；SQL 复核 users/sessions/runs/messages/audits 均为 0；删除本轮 Python 启动脚本和日志 |
| 未执行范围 | 吞吐/延迟/积压压测、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障矩阵、真实云模型/Embedding、Docker 应用镜像和生产环境继续暂缓 |
| 结论 | Chat 兼容入口现在能够复用 V1 持久化 SSE 回放服务；本轮只补齐业务正确性证据，不将 Last-Event-ID 业务回放扩大解释为故障恢复矩阵完成 |

## M2-2 database_query 多轮 AgentRun 业务收尾（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 04:48-05:20（Asia/Shanghai） |
| 代码变更 | 修复带 `sql_audit_id` 的 `time_parser` 结果误判为 `database_query` 已完成；数据库 Proposal 的回退 `invocation_id` 纳入 `run_id`，避免跨 Run 复用 `proposal_id`；多轮工具执行的 `run.checkpoint_saved` 事件 ID 纳入事件序号，避免 Java Inbox 去重阻断后续事件 |
| Python 定向验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest tests/test_runtime_server.py -q`：41 passed；新增跨 Run Proposal 唯一性和多轮事件 ID 唯一性回归断言 |
| Python 全量验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：113 passed、1 skipped、1 warning；跳过项为显式真实云集成，未调用付费模型或真实 embedding |
| 真实业务验证 | 随机用户创建 AgentRun `349662250480439296`，通过 Java `18080` -> RocketMQ -> Python `19000` -> Java 结果回写完成；`time_parser` 与 `database_query` Proposal 均为 `succeeded`，生成 2 条 `sql_query_audits` 且状态均为 `executed`（行数 1、0），Run 事件 `1..14` 连续，最终 `status=completed`、`result_type=normal` |
| 运行态 | Python readiness HTTP 200；Redis checkpoint、RocketMQ command/result consumer 和 Java Outbox/Inbox 均可用；最终恢复 Python 标准 consumer group，删除本轮临时 consumer group/retry Topic |
| 清理 | 精确清理本轮 10 个 `codex_sql_*` 用户、7 个 AgentRun、Session、消息、SQL/运行时/统一审计及 Outbox/Inbox；PostgreSQL 用户、Run、Session、审计、SQL 审计和运行时 Inbox/Outbox 复核均为 0；Redis 本轮 checkpoint、command/result Inbox 复核无残留；临时脚本和日志已删除 |
| 失败记录 | 修复前 4 个 Run 因跨 Run Proposal ID 冲突或重复 checkpoint ID 卡在工具等待并最终失败；另有 2 个 Run 受本地旧 RocketMQ consumer group 位点干扰；均已纳入本轮清理，不修改既有业务数据 |
| 未执行范围 | 吞吐/延迟/积压压测、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障矩阵、SSE `Last-Event-ID` 故障恢复、真实云模型/Embedding、Docker 应用镜像和生产环境继续暂缓 |
| 结论 | M2-2 结构化分析的真实业务主路径已补齐多轮工具、SQL 审计、事件连续性和 AgentRun 终态证据；本轮不据此扩大性能或故障恢复范围 |

## M3 受控数据库清理执行收尾（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 05:00-05:30（Asia/Shanghai） |
| 功能提交 | `c866460 feat(retention): 完成受控数据库清理执行` |
| 代码范围 | 增加受控数据库清理 Port/Adapter；知识文档子表按依赖顺序删除，限定 `is_deleted=TRUE`；对象存储和向量索引任务完成后才允许数据库任务领取；修复清理请求收敛到 `completed` 的 SQL。 |
| 安全边界 | `hard_delete_enabled=false` 默认关闭；本轮未执行迁移、truncate、宽泛删除、真实硬删除或备份恢复；未触碰现有本地业务数据。 |
| Java 验证 | Retention Application 定向测试 `13/13`；Retention Infrastructure/V25 定向测试 `5/5`；受影响模块 Spotless 通过。 |
| 结论 | 受控清理业务代码、状态收敛和依赖顺序具备测试证据；真实硬删除和生产删除演练继续后置。 |

## D1 全量业务门禁复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java 命令 | `.\mvnw.cmd clean verify` |
| Java 结果 | BUILD SUCCESS；Shared `12/12`、Application `155/155`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless 和 Spring Boot repackage 通过。 |
| Python 命令 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q` |
| Python 结果 | `113 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用付费模型或 embedding。 |
| 前端结果 | 36 个测试文件、`170 passed`；`npm.cmd run typecheck` 通过。 |
| 失败记录 | 同日首次 Maven 运行因本轮宿主 Java `18080` 进程占用 Bootstrap JAR，repackage 无法重命名；停止已确认的联调进程后重跑成功，未修改业务代码。 |
| 未执行范围 | 性能压测、Docker 应用镜像启动、真实云服务、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递、SSE 故障矩阵、数据库备份恢复和生产环境验证继续暂缓。 |
| 结论 | 当前代码与业务测试门禁通过；本地功能版可继续收尾，不将后置性能/故障/生产项标记为完成。 |

## D2 代码规范、失败补偿与业务门禁复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 代码规范命令 | `\.\mvnw.cmd -Palibaba-code-style verify -DskipTests` |
| 代码规范结果 | BUILD SUCCESS；Checkstyle 9.3 Java 21 可执行子集 0 violations，Spotless 通过。旧 P3C/PMD 规则因不能解析 Java 21 record 已移除，不把解析错误当作通过；手册完整条款继续人工审查。 |
| Java 业务门禁 | `\.\mvnw.cmd clean verify` BUILD SUCCESS；Shared `12/12`、Application `156/156`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`113 passed、1 skipped、2 warnings`；跳过项为显式真实云集成，未调用付费模型或真实 embedding。 |
| 前端业务门禁 | `npm.cmd run typecheck`、`npm.cmd test -- --run`、`npm.cmd run build` 均通过；36 个测试文件、170 个测试通过。 |
| Compose 校验 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过。 |
| 业务修复 | 单文件知识上传在对象写入后 PostgreSQL 失败会精确删除新对象；批次补偿删除失败保留为 suppressed exception；新增回归测试，KnowledgeServiceImplTest `7/7`。 |
| 文档与迁移 | 新增 `script/sql/FoodMate/README.md`，补齐 V23-V25 的人工执行、validation、rollback、seed 和台账边界；未执行迁移、truncate、回滚或备份恢复。 |
| Git 提交 | `4caa4d2`、`d945784`、`55a16ca`、`73f1f89`；用户既有 UI/Figma/ChatPage 改动未暂存。 |
| 未执行范围 | Docker 应用镜像构建、真实模型/embedding、吞吐/延迟压测、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障注入、SSE Last-Event-ID 故障矩阵、备份恢复和生产环境继续暂缓。 |
| 结论 | 当前业务代码、Java 21 规范子集、Python、前端和 Compose 配置门禁均通过；不能据此宣称后置性能、故障恢复或生产范围完成。 |

## D3 协议错误审计失败重试（2026-08-23）

| 项目 | 结果 |
|---|---|
| 代码提交 | `824ffe9 fix(runtime): 保留协议审计失败重试` |
| 场景 | Python -> Java 的不可解析 RunEvent 没有可信 `run_id`；协议错误审计成功后 REJECT，审计存储失败改为 RETRY，避免 ACK 后静默丢失审计事实。 |
| Java 定向验证 | `mvnw.cmd -pl foodmate-application -am test -Dtest=RuntimeEventMessageProcessorTest -Dsurefire.failIfNoSpecifiedTests=false`：`7/7` 通过；Spotless apply 通过。 |
| 边界 | 只修改协议错误审计失败分类；业务事件、数据库重试、DLQ 和用户可见状态未改变。 |

## D4 最终 Java 门禁数字复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 复核命令 | `mvnw.cmd verify` |
| 最终 Java 结果 | BUILD SUCCESS；Shared `12/12`、Application `157/157`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless、编译和 Spring Boot repackage 均通过。 |
| 数字更正 | D2 的 Application `156/156` 是当时记录值；以本次最终复核的 `157/157` 为准，未改写历史执行记录。 |
| 结论 | 当前业务代码 Java 门禁保持通过；性能压测、组件重启、ACK/重复投递故障注入、SSE Last-Event-ID 专项和生产范围仍按用户决定暂缓。 |

## M2-1 deterministic 宿主跨运行时业务 smoke（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 06:39-06:57（Asia/Shanghai） |
| 环境 | Windows；宿主 Java 21 `18080`；项目 `agent-runtime\\.venv` Python `19000`；Docker PostgreSQL、Redis、MinIO、RocketMQ NameServer/Broker/Proxy、Milvus 依赖保持 healthy；未调用真实模型或 embedding API |
| 配置 | Java 使用 `local + rocketmq + stub + deterministic`；Python 显式启用 `FOODMATE_KNOWLEDGE_INDEX_WORKER_ENABLED=true`、MinIO 读取和隔离 Redis 前缀；Python readiness HTTP 200，Redis/checkpoint/RocketMQ consumer 均 ready |
| 上传与索引 | 管理员批次 multipart 上传真实返回 `202`；Java `knowledge_index_outbox` 发布到 `foodmate-knowledge-index-v1`；Python Worker 从 MinIO 读取 Markdown、解析/分块、写入 Redis stub；`foodmate-knowledge-index-result-v1` 回写后批次 `completed`、条目 `indexed`、attempt `1` |
| 发布与检索 | 发布接口成功；公共检索按 `tenant_id=0/public_published` 返回当前文档安全引用，未暴露对象键或地址；同查询中的历史 smoke 文档通过按 `document_id` 复核排除 |
| AgentRun | 真实 Java -> RocketMQ -> Python -> Java 路径完成 3 个 deterministic AgentRun；有效收尾 Run 事件 6 条连续、状态 `completed`、`result_type=normal`、`run.completed` 包含 2 条引用，模型成本为 `0` |
| 可见性 | 当前文档下线后该文档不再出现在检索结果；恢复接口只回到 `draft`，恢复后仍不可检索；visibility Outbox 由 Java 权威状态产生并由 Worker 投影 |
| 失败记录与修正 | 首次脚本因 Python Worker 未显式启用停在 `uploaded/pending`，重启项目 `.venv` Runtime 后自动收敛；重复来源/版本/标题被 PostgreSQL 唯一约束正确拒绝；脚本先误读 camelCase 批次字段、后误把其他 smoke 文档命中计入下线断言，均修正为按业务字段和 `document_id` 断言 |
| 清理 | 精确删除本轮 operator `349684404412485632`、5 个批次/条目/文档、3 个 AgentRun、Session、消息、Outbox/Inbox/SSE/统一审计事实；MinIO 5 个测试对象确认不存在；Redis 隔离 chunks、5 条 Worker 完成事实和 3 个 checkpoint 删除；PostgreSQL 复核 user/jobs/docs/runs/sessions 均为 `0` |
| 未执行范围 | Docker Java/Python 应用镜像构建与启动、真实 embedding/云模型、吞吐/延迟/积压压测、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障矩阵、SSE `Last-Event-ID` 故障恢复、备份恢复和生产环境继续暂缓 |
| 结论 | M2-1 deterministic 公共知识库的上传 -> Java Outbox -> RocketMQ -> Python Worker -> Java 状态回写 -> 发布 -> 用户检索 -> AgentRun 引用 -> 下线/恢复业务闭环具备本轮真实证据；不据此扩大后置测试或生产完成范围 |

## D5 业务门禁复跑（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java | `./mvnw.cmd verify`（Windows 等价命令 `mvnw.cmd verify`）BUILD SUCCESS；Shared `12/12`、Application `157/157`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless、编译、Spring Boot repackage 和 ArchUnit 通过 |
| Python | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`113 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用付费模型或真实 embedding |
| 工作区与运行态 | 本轮临时 Java/Python 进程已停止；Docker 依赖仍 healthy；`git diff --check` 通过；用户已有 UI/Figma/`tmp` 改动未暂存 |
| 结论 | M2-1 deterministic 业务实现和当前 Java/Python 业务门禁通过；性能、重启、ACK/重复投递、真实服务和生产范围继续后置 |

## D6 文档与功能版范围收尾（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23（文档收尾轮次） |
| 分支 | `codex/m2-remaining-business` |
| 变更范围 | 对齐 `路线图.md`、`完整功能实施TODO.md`、`M2剩余功能执行计划.md`、`测试策略.md`、`本地开发指南.md` 和 `配置指南.md`；未修改业务代码、数据库或用户已有 UI/QA 改动 |
| 业务测试复核 | `mvnw.cmd -pl foodmate-application,foodmate-infra,foodmate-api -am test -Dtest=DataRetentionServiceImplTest,DataRetentionDeliveryServiceImplTest,DataRetentionTaskPublisherTest,DataRetentionResultMessageProcessorTest,DataRetentionDatabasePurgeAdapterTest,AdminRetentionControllerTest -Dsurefire.failIfNoSpecifiedTests=false`：21/21 通过 |
| 当前完成口径 | M2-1/M2-2/M2-3 业务功能和核心业务测试完成；M3 运营审计、DLQ 重放契约、保留治理、对象/向量清理和受控数据库清理代码切片完成 |
| 明确后置 | M1-6 Agent 业务压测、吞吐/延迟/积压、组件重启、ACK 丢失、重复投递、SSE 故障恢复；真实云服务、Docker 应用镜像、生产部署、备份恢复、发布回滚、真实依赖清理和不可逆数据库硬删除 |
| 安全边界 | `hard_delete_enabled=false` 默认关闭；本轮未执行迁移、truncate、真实对象/向量/数据库删除或备份恢复 |
| 文档结论 | D1 文档状态和业务完成边界已与代码、定向测试和既有执行证据对齐；不将后置范围标记为完成 |

## D7 M2/M3 代码规范收口与本地环境复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 07:17-07:20（Asia/Shanghai） |
| 代码变更 | 为知识索引结果处理、知识投递/检索/上传服务、保留投递、知识 Mapper、PostgreSQL 仓储适配器和管理端控制器补充职责 Javadoc；`KnowledgeIndexResultMessageProcessor.hash()` 将泛化异常捕获收紧为 `NoSuchAlgorithmException`，消息 ACK/RETRY/REJECT 行为不变 |
| Git 提交 | `f9e85ba 规范(知识库): 补充核心类注释并收紧异常捕获` |
| Java 定向测试 | `mvnw.cmd -pl foodmate-application,foodmate-infra,foodmate-api -am test '-Dtest=KnowledgeIndexResultMessageProcessorTest,KnowledgeServiceImplTest,KnowledgeSearchServiceImplTest,DataRetentionDeliveryServiceImplTest,KnowledgeRepositoryAdapterTest,KnowledgeControllerTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：Application 14/14、Infrastructure 5/5、API 3/3，共 22/22 通过 |
| Java 规范门禁 | `mvnw.cmd -Palibaba-code-style verify -DskipTests`：六个模块 Spotless 通过，Checkstyle 均为 0 violations，Bootstrap repackage 通过 |
| Compose/依赖复核 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；PostgreSQL、Redis、MinIO、RocketMQ NameServer/Broker/Proxy、Milvus 及其 etcd/MinIO 容器均 healthy |
| Docker 应用边界 | 本机没有可复用的 FoodMate 应用镜像；现有 RocketMQ Proxy 占用宿主 `8080/8081`。本轮未启动/重建应用容器，未重启现有依赖，不将静态配置或依赖健康误记为应用联调完成 |
| 未执行范围 | 真实 embedding/云模型、应用镜像启动、吞吐/延迟/积压压测、组件重启、ACK 丢失、重复投递故障矩阵、SSE 故障恢复、备份恢复、真实清理和生产环境继续暂缓 |
| 工作树保护 | 仅提交 8 个 Java 业务文件；用户已有 UI/Figma、`tmp` 和 Python 缓存改动未暂存 |
| 结论 | M2/M3 核心代码规范收口和业务门禁具备可复核证据；后置性能、故障、生产和不可逆删除范围保持未完成 |

## D8 生产 Java 规范与 SQL 配套矩阵复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 07:51-08:00（Asia/Shanghai） |
| Git 提交 | `8043f10 规范(java): 收紧异常边界并显式化生产导入`；`e2a81a3 docs(sql): 补齐迁移配套状态说明`；计划证据追加 `b763a5f docs(计划): 记录规范与SQL收口证据` |
| 代码规范修复 | 收紧生产源码泛化异常捕获；补齐 ZIP `IOException` 处理、JSON 协议错误分类和 RocketMQ 合约错误分类；生产源码 `catch (Exception/Throwable)` 扫描为 0 |
| 导入规范修复 | 移除 Shared、Application、Infrastructure、API、Bootstrap 生产源码中的通配符 import；MyBatis 注解统一为显式导入 |
| Java 业务门禁 | `mvnw.cmd -pl foodmate-shared,foodmate-application,foodmate-infra,foodmate-api,foodmate-bootstrap -am test -DskipTests=false`：BUILD SUCCESS；Shared 12/12、Application 157/157、Infrastructure 71/71（11 skipped）、API 59/59、Bootstrap 58/58（37 skipped） |
| 格式门禁 | `mvnw.cmd spotless:apply` 通过；随后编译与测试通过 |
| SQL 文档 | 更新 SQL 根 README 和 `migration/README.md`，增加 V2-V25 配套文件矩阵，明确历史 V3-V12 不补危险反向删除；未执行迁移、validation、rollback、truncate 或数据清理 |
| 数据边界 | 未修改 PostgreSQL、Redis、RocketMQ、MinIO、Milvus 中的业务数据；用户已有 UI/Figma、`tmp` 和 Python 缓存未暂存 |
| 未执行范围 | 性能压测、组件重启、ACK 丢失、重复投递、SSE 故障恢复、真实云模型/Embedding、应用 Docker 镜像和生产环境继续暂缓 |
| 结论 | Java 业务门禁和当前可执行规范子集通过；SQL 历史配套状态可追溯；不将后置性能、故障恢复或生产项标记为完成 |

## D9 最终业务门禁复跑（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java | `mvnw.cmd verify`：BUILD SUCCESS；Shared `12/12`、Application `157/157`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless、编译、ArchUnit 和 Spring Boot repackage 通过 |
| Python | `agent-runtime/.venv/Scripts/python.exe -m pytest -q`：`113 passed、1 skipped、2 warnings`；跳过项为显式真实云集成，未调用付费模型或真实 embedding |
| Compose | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；未启动或重启应用容器及基础设施 |
| 代码状态 | Java 规范提交 `8043f10`、SQL 矩阵提交 `e2a81a3`、计划证据提交 `b763a5f`、台账证据提交 `ea7cc1b` 已落库 |
| 工作区保护 | UI/Figma/QA、`tmp` 和 Python `__pycache__` 改动仍未暂存；未执行迁移、truncate、宽泛删除、备份恢复或实际清理 |
| 未执行范围 | 性能压测、组件重启、ACK 丢失、重复投递、SSE `Last-Event-ID` 故障矩阵、真实云服务、Docker 应用镜像和生产环境继续暂缓 |
| 结论 | 当前功能版 Java/Python 业务门禁和可执行 Java 规范子集复跑通过；后置性能、故障恢复和生产强化不计入完成 |

## D10 Context 来源 ID 审计业务切片（2026-08-23）

| 项目 | 结果 |
|---|---|
| 代码范围 | Python ContextBuilder 增加受控观察回调；Runtime 发布非终态 `run.context_assembled`，payload 仅包含 `message_id/summary_id/memory_id/citation_id`；Java 接受并通过统一 `OperationAuditService` 写入 `agent_run.context.assembled`，不保存正文、Prompt 或 Chain-of-Thought |
| Java 验证 | `mvnw.cmd -pl foodmate-application -am '-Dtest=V1RuntimeContextAuditTest,RuntimeEventMessageProcessorTest' '-Dsurefire.failIfNoSpecifiedTests=false' test`：9/9 通过；覆盖来源 ID、事件投影和审计失败时阻止事件落库 |
| Python 验证 | `agent-runtime/.venv/Scripts/python.exe -m pytest -q tests/test_runtime_server.py`：42/42 通过；覆盖正常、澄清、工具等待、恢复和来源脱敏路径 |
| 格式 | `mvnw.cmd -pl foodmate-application -am spotless:apply` 通过；新增/修改 Java 文件已格式化 |
| 数据边界 | 未执行迁移、清库、truncate、真实模型/embedding、性能压测或组件故障注入；用户已有 UI/Figma、`tmp` 和 Python 缓存改动未暂存 |
| 结论 | Context 来源 ID 已具备业务级可审计闭环；生产 Trace 聚合、预算/Eval 指标平台和用户反馈入口仍属于后续切片，不因本项完成而标记完成；已创建独立功能提交 |

## D11 M2-1 联调资源清理与终态核验（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；使用项目 `agent-runtime\\.venv` 的 `pymilvus` 客户端访问本地 Milvus `http://127.0.0.1:19530`。 |
| 进程清理 | 宿主 Java `18080` 与 Python Runtime `19000` 已停止；复核时两个端口均无监听进程。 |
| Milvus 清理命令 | `agent-runtime\\.venv\\Scripts\\python.exe -c "...MilvusClient...drop_collection('foodmate_knowledge_codex_20260823')..."`；清理前目标集合存在，清理后集合列表仅保留其他 3 个集合。 |
| 保留范围 | `foodmate_knowledge_codex_audit_20260823`、`foodmate_knowledge_codex_m22_20260823`、`foodmate_knowledge_chunks` 未删除；未操作 Milvus 命名卷。 |
| 依赖状态 | PostgreSQL、Redis、MinIO、RocketMQ NameServer/Broker/Proxy、Milvus 及其依赖容器保持 healthy；未执行 `docker compose down -v`。 |
| 数据边界 | 未执行 PostgreSQL 迁移、truncate、备份恢复、数据库硬删除或宽泛数据清理；用户已有 UI/Figma、`tmp` 和 Python 缓存改动未暂存。 |
| 结论 | 本轮 M2-1 真实 deterministic 业务证据对应的运行进程和隔离集合已清理；业务代码、核心业务测试和执行证据保持有效，Docker 应用镜像、真实云服务、性能压测、组件重启、ACK 丢失、重复投递和 SSE 故障矩阵继续暂缓。 |

## D12 最终业务门禁复跑与测试上下文修复（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 09:05-09:14（Asia/Shanghai） |
| Java | `mvnw.cmd clean verify`：BUILD SUCCESS；Shared `12/12`、Application `159/159`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit、编译和 repackage 通过。 |
| Python | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`114 passed、1 skipped、1 warning`；跳过项为显式真实云集成。 |
| 首次失败与修复 | 首次 Maven 复跑发现 API `ChatControllerTest` 因 `RunStreamController` 新增共享 `TaskScheduler` 依赖而无法加载测试上下文；补充 `@MockitoBean TaskScheduler` 后定向测试 `2/2` 通过，随后全量 Maven 通过。 |
| Docker | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；现有 PostgreSQL、Redis、MinIO、RocketMQ NameServer/Broker/Proxy、Milvus 及依赖容器均为 healthy。 |
| 数据边界 | 未执行迁移、truncate、备份恢复、数据库硬删除、组件重启、消息重放或真实云服务调用；未启动 Docker 应用镜像。 |
| Git | `42c051b 修复(测试): 补齐聊天流测试调度器`；用户已有 UI/Figma、`tmp` 和 Python 缓存改动未暂存。 |
| 结论 | 当前代码和业务测试门禁通过；性能压测、依赖重启、ACK 丢失、重复投递、SSE 故障恢复、真实云服务、生产部署和不可逆清理仍后置。 |

## D13 Docker 应用容器与 M2-1 双模式业务闭环（2026-08-23）

| 项目 | 结果 |
|---|---|
| Docker 构建/启动 | `docker compose --env-file .env -f docker/compose.yml up -d --build foodmate agent-runtime` 成功；Java `foodmate` 和 Python `agent-runtime` 均在容器内运行。由于 MinIO 使用宿主 `9000`，Runtime 宿主映射修正为 `9002:9000`；RocketMQ 初始化 CLI 增加 30 秒超时。 |
| Readiness | Java `/actuator/health/readiness` HTTP 200；Python `/foodmate/internal/health/ready` HTTP 200，Redis 与 RocketMQ 协调依赖均 ready。 |
| Stub 验证 | 批次 `349734074186731520` 完成索引，发布后检索返回 1 条引用；Run `349734865958080512` 经 RocketMQ 完成，`run.completed` 和 `Last-Event-ID: 6` 回放均包含同一安全引用；文档下线及恢复为 `draft` 后检索为空。 |
| Local 验证 | `FOODMATE_RAG_MODE=local`、`FOODMATE_RAG_EMBEDDING_PROVIDER=deterministic`、隔离集合 `foodmate_knowledge_codex_docker_local_20260823`；批次 `349737110476951552` 完成，Milvus 实际创建 64 维集合并返回引用。未调用真实 embedding API。 |
| 失败与清理 | 只有 Markdown heading 的首轮输入按规则三次失败为 `RAG_EMPTY_DOCUMENT`；有效正文批次成功。测试文档已软删除，3 个 MinIO 对象、Redis stub 索引字段/完成事实和隔离 Milvus 集合已精确清理；未执行数据库硬删除。 |
| 未执行 | 性能/吞吐、积压、组件重启、ACK 丢失、重复消息、SSE 故障恢复、真实云服务、备份恢复和生产环境仍按用户要求暂缓。 |

## D14 全量业务门禁、规范与 Docker 证据同步（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java 全量门禁 | `mvnw.cmd clean verify`：BUILD SUCCESS；Shared `12/12`、Application `159/159`、Infrastructure `71/71`（11 skipped）、API `59/59`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit、编译和 Spring Boot repackage 通过。 |
| Java 规范门禁 | `mvnw.cmd -Palibaba-code-style verify -DskipTests` 通过；Spotless 通过，Checkstyle `0 violations`。生产源码泛化 `catch (Exception/Throwable)`、通配符 import、`System.out/err`、`printStackTrace` 和 `MAX(id)+1` 扫描均为 0。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`114 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用付费模型或真实 embedding。 |
| 前端门禁 | `foodmate-ui` 的 `npm run typecheck`、`npm run build` 通过；用户已有 UI/Figma/QA 改动未纳入本轮文档提交。 |
| SQL 组织复核 | SQL 根 README 和 `migration/README.md` 已记录 V2-V25 配套文件矩阵；未执行迁移、validation、rollback、truncate、备份恢复或数据库硬删除。 |
| Docker 配置与 readiness | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；`foodmate` `/actuator/health/readiness` 和 `agent-runtime` `/foodmate/internal/health/ready` 均 HTTP 200，应用容器与 PostgreSQL、Redis、MinIO、RocketMQ、Milvus 依赖保持 healthy。 |
| M2-1 业务证据 | Docker stub 使用 Redis 确定性索引，Docker local 使用 deterministic embedding 与实际 64 维 Milvus 集合；两种模式均完成上传、索引、发布、检索和 AgentRun 引用路径。真实 embedding、性能/积压、组件重启、ACK 丢失、重复消息和 SSE 故障恢复仍暂缓。 |
| 工作树保护 | 仅计划范围文档和执行台账进入本轮提交；用户已有 UI/Figma/QA、`tmp` 与 Python `__pycache__` 改动未暂存。 |
| 结论 | 当前功能版业务代码、业务测试、Java 可执行规范子集和 Docker 应用 readiness 均有可复核证据；后置性能、故障、生产和不可逆清理范围保持未完成。 |

## D15 结构化 Agent 反馈业务切片（2026-08-23）

| 项目 | 结果 |
|---|---|
| 分支与提交 | `codex/m2-remaining-business`；`2d5bd05 feat(feedback): 增加结构化Agent反馈入口` |
| 代码范围 | 新增 V26 `agent_feedback` 迁移、validation 和只读 rollback precheck；Application 反馈服务与端口；PostgreSQL Mapper/适配器；`POST /api/agent-runs/{runId}/messages/{messageId}/feedback`；聊天页反馈组件和业务测试。 |
| 业务规则 | 仅允许当前用户对已完成 AgentRun 的 assistant message 提交一次；负面反馈至少一个稳定原因；幂等键参数一致时重放既有事实；同一回答并发冲突不重复写入；高风险原因可标记高优先级审计。 |
| 安全边界 | 反馈和审计不保存回答正文、Prompt、原始业务请求、密码、令牌或敏感内容；审计只保存关联 ID、结果、原因数量、幂等键和参数摘要。 |
| Java 验证 | `mvnw.cmd -pl foodmate-infra -am "-Dtest=FlywayV26MigrationScriptTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：2/2；Application：3/3；API：2/2；`mvnw.cmd -Palibaba-code-style verify -DskipTests`：Spotless 通过、Checkstyle `0 violations`。 |
| 前端验证 | `foodmate-ui` `npm run typecheck` 通过；`npm run test -- --run src/components/agent/AgentFeedback.test.tsx`：2/2；反馈组件 Prettier 检查通过。全量 Prettier 仍有既有 52 个文件格式问题，本轮未格式化无关文件。 |
| 数据库边界 | 未执行 V26 目标数据库迁移、truncate、备份恢复或清理；rollback 文件仅为人工只读前置检查。 |
| 未执行范围 | 不包含性能压测、组件重启、ACK 丢失、重复投递、SSE 故障恢复、真实云模型/embedding、生产部署或不可逆删除。 |
| 结论 | 结构化反馈代码与业务主路径测试完成；V26 迁移需按人工数据库流程另行执行并登记，不因本切片完成将 M1-6 或 M3 整体标记为完成。 |

## D16 反馈模块边界修复与全量 Java 门禁（2026-08-23）

| 项目 | 结果 |
|---|---|
| 修复提交 | `e0e6d5b fix(feedback): 隔离API与持久化视图依赖`；API 改为依赖 Application Service 的 `FeedbackResult`，不再引用 `port.out` 持久化视图。 |
| 全量验证 | `mvnw.cmd verify`：BUILD SUCCESS；Shared `12/12`、Application `162/162`、Infrastructure `73/73`（11 skipped）、API `61/61`、Bootstrap `58/58`（37 skipped）；ArchUnit、Spotless、编译和 Spring Boot repackage 通过。 |
| 失败与修正 | 首次全量验证发现 ArchUnit 拒绝 Controller 直接依赖 `AgentFeedbackRepository.FeedbackView`；已提取 Application Service 返回契约，并将幂等重放测试改为逐字段断言。 |
| 数据与运行边界 | 未执行 V26 迁移、真实 PostgreSQL 写入、性能压测、组件重启、ACK 丢失、重复投递或 SSE 故障恢复；用户已有 UI/Figma/QA、Python 缓存和 `tmp` 未提交。 |
| 结论 | 反馈业务代码通过全量 Java 业务门禁，模块依赖边界符合 ArchUnit；数据库迁移和后置运维测试仍未完成。 |

## D17 长期记忆三层数据边界（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 12:00-12:02（Asia/Shanghai） |
| Git 提交 | `063e85d feat(记忆): 固化长期记忆三层数据边界` |
| 代码范围 | Java 记忆候选增加允许类型白名单；拒绝饮食记录、餐食计划、周食谱、购物清单、Profile、营养目标等权威实体或字段，并拒绝过敏/医疗/诊断/处方等高影响健康事实；AgentRun Context 查询同步移除业务实体记忆类型。 |
| 业务验证 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am test '-Dtest=MemoryCandidateServiceImplTest,FlywayMigrationScriptTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：MemoryCandidateServiceImplTest `4/4`、FlywayMigrationScriptTest `7/7` 通过；随后 `mvnw.cmd verify` 全量通过（Shared `12/12`、Application `164/164`、Infrastructure `73/73`，11 skipped、API `61/61`、Bootstrap `58/58`，37 skipped）；Spotless、ArchUnit、编译和 repackage 通过。 |
| 规范门禁 | `mvnw.cmd -Palibaba-code-style verify -DskipTests` 通过，六个模块 Checkstyle 均为 `0 violations`；`git diff --check` 无错误。 |
| 数据边界 | 未执行迁移、真实业务数据写入、truncate、硬删除或缓存清理；用户已有 UI/Figma/QA、Python 缓存和 `tmp` 未暂存。 |
| 未执行范围 | 性能压测、队列积压、组件重启、ACK 丢失、重复消息、SSE 故障恢复、真实云模型/embedding、备份恢复、生产部署和发布回滚继续暂缓。 |
| 结论 | 长期记忆不再复制领域权威事实，稳定偏好/习惯仍可进入记忆候选；三层数据边界业务切片完成。 |

## D18 回答分片时间调度状态校正（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 12:05-12:07（Asia/Shanghai） |
| 既有实现 | `22499a1 feat(runtime): 增加回答分片间隔配置` 已实现 `FOODMATE_AGENT_STREAM_CHUNK_INTERVAL_MS`（默认 150ms）和 `FOODMATE_AGENT_STREAM_CHUNK_MAX_BYTES`；本轮未重复修改 Runtime 代码。 |
| 文档范围 | 将完整 TODO、配置指南、Runtime 架构和 M1-4 方案中的“尚未实现”描述校正为当前实际能力；明确 Eval 通过后才发布、按 UTF-8 字节切片、按分片间隔调度且不逐 Token 发布。 |
| 业务验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q tests/test_runtime_server.py -p no:cacheprovider`：`44 passed、1 warning`；覆盖 150ms 间隔和非法配置。使用 `PYTHONDONTWRITEBYTECODE=1`，未新增缓存写入。 |
| 未执行范围 | 未进行性能容量推断、生产长压、队列积压、组件重启、ACK 丢失或 SSE 故障矩阵；时间间隔测试只验证业务契约，不构成性能 SLO。 |
| 结论 | 回答分片 150ms 配置能力与文档状态已对齐；该能力不再作为未完成业务项。 |

## D19 V26 SQL 配套台账校正（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行时间 | 2026-08-23 12:16-12:18（Asia/Shanghai） |
| Git 提交 | `a04e271 docs(sql): 对齐V26迁移配套台账` |
| 文档范围 | SQL 根 README、migration README、CHANGELOG 和 M2 计划统一记录当前最高版本 V26；补充 `agent_feedback` 的 validation、只读 rollback precheck、数据安全边界和未执行说明。历史迁移文件未原地修改。 |
| 静态业务验证 | `mvnw.cmd -pl foodmate-infra -am test '-Dtest=FlywayV26MigrationScriptTest,FlywayV16V17KnowledgeMigrationScriptTest,FlywayV25MigrationScriptTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：`6/6` 通过；覆盖 V16/V17、V25 和 V26 配套脚本。 |
| 数据库边界 | 未执行 V26 或其他迁移、validation、rollback、truncate、备份恢复或数据清理；未改变目标 PostgreSQL 状态。 |
| 结论 | SQL 目录当前版本说明与实际文件一致；V26 迁移仍需单独人工授权、备份和目标库校验后才可执行。 |

## D20 最终业务门禁与前端构建（2026-08-23）

| 项目 | 结果 |
|---|---|
| 前端 | 在 `foodmate-ui` 执行 `npm.cmd run build`：TypeScript 两套配置检查通过，Vite 生产构建通过（2010 modules transformed）。未将用户已有 UI/Figma/QA 改动纳入本轮提交。 |
| Java | 复用本轮已登记的 `mvnw.cmd clean verify` 结果：BUILD SUCCESS；Shared `12/12`、Application `164/164`、Infrastructure `73/73`（11 skipped）、API `61/61`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit、编译和 repackage 通过。 |
| Java 规范 | 复用本轮已登记的 `mvnw.cmd -Palibaba-code-style verify -DskipTests` 结果：六个模块 Checkstyle 均为 `0 violations`；通配符 import、泛化 `catch (Exception/Throwable)`、`System.out/err`、`printStackTrace` 和 `MAX(id)+1` 扫描为 0。 |
| Python | 复用本轮已登记的项目 `.venv` pytest 结果：`116 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用付费模型或真实 embedding。 |
| Docker | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；Java `/actuator/health/readiness` 和 Python `/foodmate/internal/health/ready` 均已登记 HTTP 200，应用及 PostgreSQL、Redis、MinIO、RocketMQ、Milvus 依赖保持 healthy。 |
| PostgreSQL | 只读核验已登记：当前数据库未执行迁移；`flyway_schema_history`、`agent_feedback` 不存在，`knowledge_import_jobs`、`knowledge_index_outbox` 存在；未执行 truncate、备份恢复或硬删除。 |
| 数据与工作区 | 未修改或清理用户已有 UI/Figma/QA、Python `__pycache__` 和 `tmp` 改动；未新增业务数据、迁移或宽泛清理。 |
| 暂缓范围 | 性能压测、吞吐/延迟/积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递、SSE 故障恢复、真实云模型/Embedding、staging/production、备份恢复、发布回滚和不可逆硬删除继续暂缓。 |
| 结论 | 当前功能版 Java、Python、前端业务门禁、Docker 配置/readiness 和 M2-1 deterministic 业务闭环证据齐全；后置性能、故障、真实外部服务和生产项不标记为完成。 |

## D21 公共契约注释与业务门禁复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 代码范围 | `foodmate-shared` 的 `EventInbox` 补充类、方法和结果枚举的行为注释；Spotless 格式已对齐。未新增业务逻辑、迁移或运行时配置。 |
| Java 业务验证 | `mvnw.cmd clean verify`：BUILD SUCCESS；Shared `12/12`、Application `165/165`、Infrastructure `76`（14 skipped）、API `61/61`、Bootstrap `58`（37 skipped）；编译、单元测试、ArchUnit、Spotless 和 Spring Boot repackage 通过。 |
| Python 业务验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`116 passed、1 skipped、1 warning`；使用 `PYTHONDONTWRITEBYTECODE=1`，未调用真实模型或 embedding。 |
| Java 规范验证 | `mvnw.cmd -Palibaba-code-style verify '-DskipTests'`：六个模块 Checkstyle 均为 `0 violations`；生产源码泛化异常捕获、标准输出、堆栈打印和 `MAX(id)+1` 扫描均为 0。 |
| 前端与 Docker | `foodmate-ui` 的 `npm.cmd run typecheck` 和 `npm.cmd run build` 通过（Vite `2010 modules transformed`）；`docker compose --env-file .env -f docker/compose.yml config --quiet` 通过，当前 foodmate、agent-runtime、PostgreSQL、Redis、MinIO、RocketMQ 和 Milvus 容器均 healthy。 |
| 数据边界 | 未执行迁移、validation、rollback、truncate、备份恢复、数据库硬删除或宽泛清理；未新增测试业务数据。现有用户 UI/Figma/QA、Python 缓存和 `tmp` 改动未主动清理。 |
| 暂缓范围 | 性能压测、吞吐/延迟/积压、组件重启、ACK 丢失、重复投递、SSE 故障恢复、真实云模型/Embedding、staging/production、备份恢复、发布回滚和不可逆硬删除继续暂缓。 |
| 结论 | 当前本地功能版业务测试、Java 规范门禁、前端构建和 Docker 配置状态均可复核；后置性能、故障、真实外部服务和生产项不标记为完成。 |

## D22 管理仪表盘安全摘要收口（2026-08-23）

| 项目 | 结果 |
|---|---|
| Git 提交 | `a805a87 修复(admin): 脱敏后台运行摘要` |
| 代码范围 | 管理仪表盘 SQL 审计仅返回 `query_hash` 摘要；知识文档仅返回 `source_name/source_type`，不返回原始 SQL 或对象存储 `storage_key`。 |
| 业务验证 | `mvnw.cmd -pl foodmate-infra -am '-Dtest=AdminDashboardMapperContractTest' '-Dsurefire.failIfNoSpecifiedTests=false' test`：`1/1` 通过；契约测试同时拒绝原始 SQL 和对象 key 投影。 |
| 数据边界 | 未执行迁移、SQL 写入、truncate、备份恢复、硬删除或清理现有数据；未触碰用户已有 UI/Figma/QA、Python 缓存和 `tmp` 改动。 |
| 未执行范围 | 性能压测、组件重启、ACK 丢失、重复消息、SSE 故障恢复、真实云模型/embedding、生产价格审计和生产只读账号隔离继续后置。 |
| 结论 | 管理端安全摘要业务契约已收口；生产安全与运维门禁不由本地 Mapper 测试替代。 |

## D23 Docker M2-1 索引闭环与 AgentRun 引用复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行环境 | `codex/m2-remaining-business`；Docker Compose `.env`；Java `foodmate`、Python `foodmate-agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO、Milvus 均 healthy。Java readiness 和 Python `/foodmate/internal/health/ready` 均 HTTP 200。 |
| 配置 | `FOODMATE_RAG_MODE=local`、`FOODMATE_RAG_EMBEDDING_PROVIDER=deterministic`、64 维向量、隔离集合 `foodmate_knowledge_codex_chunks_20260823`；未读取真实 API Key，未调用付费服务。 |
| 上传与解析 | 管理员批次 `349798831908458496` 上传 Markdown；`knowledge_import_items` 为 `indexed`，批次为 `completed`，共 21 个切片，`attempt_count=1`，模型版本 `deterministic-local-v1`。 |
| Java Outbox/结果回写 | 索引 Outbox 状态为 `published`；结果回写同时更新条目、文档、批次和 `knowledge_chunks` 权威事实。批次 SSE 从游标 0 回放 `knowledge.index.indexed`、`knowledge.batch.progress` 两个事件。 |
| Milvus | 隔离集合实际存在，`num_entities=21`，schema 的向量维度为 `64`；发布可见性 Outbox 状态为 `published`。 |
| 检索与 AgentRun | 显式发布后公共检索返回安全引用；Docker AgentRun `349800593365143552` 完成，`run.completed` 含 2 条 citations，来源 ID 同时出现在 context 事件。用 `Last-Event-ID` 从中间事件回放可补发唯一 `run.completed` 终态。 |
| 可见性门禁 | 文档下线后检索引用数为 `0`；恢复仅回到 `draft`，检索仍为 `0`；随后通过删除接口将本轮文档置为 `deleted`。 |
| 清理与数据边界 | 本轮会话已通过业务删除接口软删除；知识文档、切片、Outbox、Redis/Milvus 去重或索引事实不做物理删除，避免破坏可追溯事实和其他历史数据。未执行迁移、truncate、数据库硬删除、备份恢复或宽泛清理。 |
| 暂缓范围 | 性能吞吐/延迟/积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复消息故障矩阵、真实 embedding、生产环境和发布回滚继续暂缓。 |
| 结论 | M2-1 Docker `local` deterministic 业务闭环已取得可复核证据：上传、解析、索引 Outbox、RocketMQ Worker、Java 结果消费、Milvus 写入、显式发布、检索、AgentRun 引用和批次/Chat SSE 回放均通过；后置性能与故障门禁不因此标记完成。 |

## D24 当前分支最终业务门禁复跑（2026-08-23）

| 项目 | 结果 |
|---|---|
| 分支 | `codex/m2-remaining-business`；本轮未新增业务代码，未改变数据库状态 |
| Java | `mvnw.cmd verify`：BUILD SUCCESS；Shared `12/12`、Application `166/166`、Infrastructure `81/81`（17 skipped）、API `61/61`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit、编译和 Spring Boot repackage 通过 |
| Python | 使用项目 `agent-runtime\\.venv` 执行全量 pytest：`116 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用真实模型或 embedding |
| 前端 | Vitest `37` 个测试文件、`189 passed`；`npm.cmd run typecheck` 通过；`npm.cmd run build` 通过，Vite 转换 `2010` 个模块 |
| 前端规范提示 | `npm.cmd run lint` 未作为业务门禁通过：仓库既有 CRLF/Prettier 规则产生 `10675 warnings`，`0 errors`；本轮未全仓格式化，避免覆盖用户 UI/Figma 改动 |
| 工作树保护 | 用户已有 UI/Figma/QA、Python `__pycache__`、`tmp` 和未提交 Chat CSS 差异均未暂存、未回滚 |
| 数据边界 | 未执行迁移、truncate、备份恢复、数据库硬删除、组件重启、消息重放或真实云服务调用 |
| 暂缓范围 | 性能压测、吞吐/延迟/积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递、SSE 故障恢复、真实 embedding、staging/production、发布回滚和不可逆清理继续暂缓 |
| 结论 | 当前功能版业务代码和业务测试门禁通过；M1-6/M3 的生产强化与真实依赖故障证据不因本轮复跑标记完成 |

## D25 M2-1 AgentRun HTTP SSE 回放与测试数据清理（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行环境 | Docker Compose `foodmate`；Java `127.0.0.1:8080`；使用本轮随机账号和既有完成 Run `349815929648975872`，未调用真实模型或 embedding 服务。 |
| SSE 验证 | `GET /api/chat/runs/349815929648975872/stream` 携带 `Last-Event-ID: 6` 返回 HTTP 200；仅回放 1 个 `run.completed`，稳定事件 ID 为 `sse_349815932530462720`，无重复终态；payload 含安全 `citations`，不含对象存储地址。 |
| PostgreSQL 事实 | Run 状态为 `completed`；7 个 `runtime_event_inbox_v2` 事件均为 `applied`；`run.completed` 的 `citation_count=1`；dispatch 为 `delivered`，RocketMQ dispatch outbox 为 `published`。 |
| 可见性清理 | 文档 `349815171083931648`、`349815899194134528` 均通过正式 `POST /api/admin/knowledge-documents/{id}/delete` 软删除；两条可见性 Outbox 已为 `published`，当前公共已发布可检索文档数量为 `0`。 |
| 数据边界 | 未执行 truncate、数据库硬删除、迁移、备份恢复或宽泛清理；知识切片、Outbox、Redis/Milvus 去重事实保留以维持审计和可追溯性；临时恢复用于 SSE 归属校验的测试账号已还原为禁用。 |
| 结论 | M2-1 本地 deterministic AgentRun 引用和 Chat 兼容 SSE `Last-Event-ID` 业务回放已取得直接 HTTP 证据；性能、重启、ACK 丢失、重复消息故障矩阵和真实外部服务仍按当前决策暂缓。 |

## D26 认证构造器注入修复与代码门禁复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| 失败与修正 | 首次 `mvnw.cmd verify` 因 `AuthController` 存在两个构造器且未标记 Spring 注入构造器，API Spring 测试上下文出现 `No default constructor found`；已在主构造器补充 `@Autowired`，保留测试用简化构造器。首次失败另因该文件补丁换行格式混用，已使用 Spotless 自动修复。 |
| 定向验证 | `mvnw.cmd -pl foodmate-api -am '-Dtest=AuthCookieMatrixTest,P1AccountControllerTest' '-Dsurefire.failIfNoSpecifiedTests=false' test`：`6/6` 通过。 |
| 全量 Java | 修复后 `mvnw.cmd verify`：BUILD SUCCESS；Shared `12/12`、Application `166/166`、Infrastructure `81/81`（17 skipped）、API `61/61`、Bootstrap `58/58`（37 skipped）；编译、Spotless、ArchUnit、Spring Boot repackage 通过。 |
| 代码规范 | `mvnw.cmd -Palibaba-code-style verify '-DskipTests'`：六个模块 Checkstyle 均为 `0 violations`。 |
| 数据与工作区 | 未执行迁移、数据库写入、truncate、备份恢复或运行时故障注入；用户已有 UI/Figma/QA 改动未暂存、未回滚。 |
| 暂缓范围 | 性能压测、吞吐/延迟/积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递、SSE 故障恢复、真实云模型/Embedding、staging/production、备份恢复、发布回滚和不可逆清理继续暂缓。 |
| 结论 | 认证控制器 Spring 注入问题已修复，当前 Java 业务测试、格式检查、架构检查和 Alibaba 规范门禁通过；环境依赖型测试仍按现有开关跳过。 |

## D27 Docker M2-1 stub 索引闭环与可见性验证（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/business-database-contracts`；Docker Compose `.env`；Java `foodmate`、Python `foodmate-agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO、Milvus 均 healthy；Java `/actuator/health/readiness` 和 Python `/foodmate/internal/health/ready` 均 HTTP 200。 |
| Docker 修复 | `docker/rocketmq/init-topics.sh` 移除 `grep -q` 管道早退，并将 consumer group 输出落到临时文件后校验；RocketMQ 初始化容器最终退出码 `0`，知识索引/结果/可见性 Topic 和 consumer group 创建成功。 |
| 配置边界 | `FOODMATE_RAG_MODE=stub`、`FOODMATE_RAG_EMBEDDING_PROVIDER=deterministic`；仅使用 Redis 确定性索引，不读取 API Key，不连接 Milvus 写入，不调用付费服务。 |
| 上传与索引 | 管理员批次 `349866183727517696` 上传 `README.md`；条目 `349866185271021569`、文档 `349866185271021568`；批次 `completed`，条目 `indexed`，`attempt_count=1`，解析生成 7 个 PostgreSQL chunk，索引 Outbox 为 `published`，Redis stub 共享索引键已产生。 |
| 发布与检索 | 显式发布后，普通用户 `POST /api/knowledge-base/search` 查询 `Agent Runtime` 返回 2 条安全 citations；引用不含对象存储地址。 |
| AgentRun | 普通用户创建真实 `/api/chat/runs`，Run `349867538139582464` 通过 RocketMQ 完成；事件序号连续 `1..7`，`run.completed` 包含 2 条 citations，来源 ID 同时出现在 context 事件。 |
| 可见性门禁 | 依次调用 disable、restore、publish、delete；检索引用数分别为 `0`、`0`、`2`、`0`。恢复仅回到 `draft`，未自动发布；5 条可见性 Outbox 均为 `published`，文档最终为 `visibility=deleted,is_deleted=true`。 |
| 审计与数据边界 | 本轮文档的管理员写操作产生 5 条 `operation_audits`；仅通过正式删除接口软删除本轮文档，保留 PostgreSQL chunk、Outbox、Redis 去重/索引事实以维持审计和可追溯性。未执行迁移、truncate、数据库硬删除、备份恢复或宽泛清理。 |
| 暂缓范围 | 性能吞吐/延迟/积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障矩阵、真实 embedding、staging/production 和发布回滚继续暂缓。 |
| 结论 | M2-1 Docker `local-stub` 业务主路径取得直接证据：上传、RocketMQ 索引、Java 结果回写、Redis 检索、显式发布、AgentRun 引用、下线/恢复/删除可见性门禁均通过；后置性能与故障类门禁不因此标记完成。 |

## D28 业务契约注释、导入规范与功能版门禁复核（2026-08-23）

| 项目 | 结果 |
|---|---|
| Git 提交 | `af294f3 fix(规范): 消除测试源码通配符导入`；`60ba6f4 规范(知识库): 补充跨模块契约注释`。用户已有 `foodmate-ui` CSS/TSX、QA 截图和 `tmp` 未暂存、未回滚。 |
| 代码规范 | 测试源码通配符 import 扫描为 `0`；生产源码控制台输出、堆栈打印、泛化异常捕获和 `MAX(id)+1` 扫描保持 `0`。受影响模块 Spotless check 和 Java 编译通过。 |
| Java 业务验证 | 知识库索引/检索/上传、DLQ 重放、保留治理和管理控制器定向测试共 `56` 个通过：Application `39`、Infrastructure `9`、API `8`；未开启本地依赖 E2E 的测试仍按开关跳过。 |
| Python 业务验证 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`116 passed、1 skipped、2 warnings`；跳过项为显式真实云集成，未调用真实模型或 embedding。 |
| Docker 验证 | 使用临时显式环境变量执行 `docker compose -f docker/compose.yml config --quiet`，结果为 `COMPOSE_CONFIG_OK`；foodmate、agent-runtime、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 相关容器均 healthy。 |
| SQL 目录 | `migration` V2-V26 共 25 个增量脚本，`validation` 18 个，`rollback` 18 个；V3-V12 历史缺失配套仍按 README 矩阵说明，不新增危险删除脚本，不执行迁移或校验写操作。 |
| 数据边界 | 未执行迁移、validation、rollback、truncate、数据库硬删除、备份恢复或宽泛清理；没有调用真实云模型/embedding，也未执行性能压测或故障矩阵。 |
| 结论 | M2-1/M2-2/M2-3 与 M3 当前业务代码及业务测试门禁保持通过；性能、重启、ACK/重复消息、SSE 故障恢复、真实外部服务、生产部署和不可逆清理继续后置。 |

## D29 全量功能版门禁与工作区收口（2026-08-23）

| 项目 | 结果 |
|---|---|
| Java 全量验证 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `166/166`、Infrastructure `81`（17 skipped）、API `61/61`、Bootstrap `58`（37 skipped）；Spotless、ArchUnit、编译和 Spring Boot repackage 通过。 |
| Alibaba profile | `mvnw.cmd -Palibaba-code-style verify -DskipTests`：六个模块 Checkstyle 均为 `0 violations`。该 profile 是项目内可执行子集，不替代人工完整手册审查。 |
| Python | 使用项目 `agent-runtime\\.venv` 执行 pytest：`116 passed、1 skipped、2 warnings`；真实云集成保持显式跳过。 |
| 前端 | 稳定参数下 Vitest `37` 个测试文件、`190/190` 通过；`npm.cmd run build`（含 typecheck 和 Vite）通过，转换 `2010` 个模块。默认并行模式的两个管理页超时在单 worker、15 秒门禁下全部通过，未修改其测试超时配置。 |
| 工作区与临时文件 | 用户已有聊天页/QA 变更已由提交 `c28a4bc fix(聊天): 对齐SSE重连状态与验收证据` 保留；阿里手册临时 PDF `tmp/pdfs` 已清理，当前 Git 工作树干净。 |
| 数据与暂缓边界 | 未执行迁移、validation、rollback、truncate、备份恢复、数据库硬删除、性能压测、依赖重启、ACK/重复消息故障注入或真实云模型/embedding 调用。 |
| 结论 | 当前业务功能、测试、Java 格式/架构/代码规范、Python 运行时和前端构建门禁均可复核；M1-6 性能/故障类门禁及 M3 生产运维项继续后置。 |

## D30 Refresh Token 业务路径接入与轮换验证（2026-08-23）

| 项目 | 结果 |
|---|---|
| 代码范围 | 接入已有 V1 `auth_refresh_tokens` 表：Java application/infrastructure 增加 refresh token 端口和 PostgreSQL 原子 claim；登录/注册设置 HttpOnly refresh Cookie；`POST /api/auth/refresh` 轮换 session、CSRF 和 refresh Cookie；注销、改密、密码重置、账号注销和管理员撤销全部会话联动撤销 refresh token；前端 API Client 对普通 API 401 做一次共享刷新后重试。 |
| 安全边界 | 数据库只保存 token hash、过期、撤销、轮换来源和设备摘要；明文 refresh token 不进入 JSON、日志或 localStorage。Refresh endpoint 不要求旧 session 的 CSRF，但强制同源；缺失、过期或已消费 token 返回 `AUTH_REFRESH_TOKEN_INVALID`。 |
| Java 业务测试 | `mvnw.cmd -pl foodmate-api -am test '-Dtest=AuthCookieMatrixTest,P1AccountControllerTest,AdminManagementControllerTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：`11/11` 通过；随后最终认证用例复跑 `AuthCookieMatrixTest,P1AccountControllerTest` 为 `9/9`；覆盖 Cookie 属性、明文 token 不进 JSON、轮换后旧 token 拒绝、注销撤销、缺失 token 稳定错误和管理员相关上下文。 |
| 前端业务测试 | `npm.cmd test -- --run`：`38` 个测试文件、`192/192` 通过；`npm.cmd run typecheck` 通过；新增 401 刷新重试和 refresh endpoint 不递归测试。 |
| 全量 Java 门禁 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `166/166`、Infrastructure `81`（17 skipped）、API `64/64`、Bootstrap `58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| 数据边界 | 未新增迁移，未执行迁移、truncate、备份恢复、数据库硬删除或生产数据库写入；V1 表和索引作为现有契约使用。工作树中用户已有 Planning/QA 文件未暂存、未回滚。 |
| 暂缓范围 | 未进行真实 PostgreSQL refresh HTTP 联调、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障矩阵、真实云模型/embedding、staging/production、发布回滚和不可逆清理。 |
| 结论 | 刷新令牌核心业务代码、API 契约、前端恢复行为和业务测试已完成；头像写路径独立验收、M1-6 性能/故障类门禁及 M3 生产运维项保持未完成。 |

## D31 头像安全写路径与补偿验收（2026-08-23）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/business-database-contracts`；Java 21；项目 `foodmate-ui` Node 依赖；未调用真实 MinIO、云模型或生产服务。 |
| 代码范围 | 头像上传增加 PNG/JPEG/WebP 实际签名、解码、尺寸、像素、字节数和路径穿越校验；对象键不再包含原始文件名；保存尺寸、原始文件名和 SHA-256 摘要；数据库/统一审计失败时补偿删除新对象；新增独立头像下载失败错误码；头像响应不暴露对象存储键。 |
| Java 定向测试 | `mvnw.cmd -pl foodmate-application -am test '-Dtest=PersonalDataServiceImplTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：`5/5` 通过，覆盖合法 PNG、伪造 MIME、数据库失败补偿删除、对象删除失败关闭和下载错误码。 |
| Java API/全量测试 | 头像相关账户 API 定向测试此前 `6/6` 通过；本轮 `mvnw.cmd verify`：BUILD SUCCESS；Shared `12/12`、Application `171/171`、Infrastructure `81`（17 skipped）、API `64/64`、Bootstrap `58`（37 skipped）；Spotless、ArchUnit、编译和 Spring Boot repackage 通过。 |
| 前端业务测试 | `npm.cmd test -- --run`：`38` 个测试文件、`192/192` 通过；前端头像响应类型和当前用户头像路径类型变更未引入业务回归。 |
| 失败记录 | 首次定向 Maven 命令因 PowerShell 未引用 `-D...=...` 被解析为非法生命周期阶段，未启动测试；改用项目既有引号写法后 `5/5` 通过。该命令行问题不属于代码失败。 |
| 数据与工作树边界 | 未执行迁移、truncate、备份恢复、数据库硬删除、真实 MinIO E2E 或宽泛清理；用户已有 Planning/QA 文件及其他未纳入本轮的改动未暂存、未回滚。 |
| 暂缓范围 | 性能压测、吞吐/延迟/积压、组件重启、ACK 丢失、重复投递、SSE 故障矩阵、真实云模型/embedding、staging/production、发布回滚和不可逆清理继续暂缓。 |
| 结论 | 头像安全业务写路径、对象补偿、统一审计失败记录、稳定资源路径和前端契约已通过业务门禁；真实对象存储联调及性能/故障类门禁不因本轮标记完成。 |

## D32 前端业务质量门禁复核（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | `foodmate-ui`；Node 依赖使用项目现有安装；未调用真实云模型、Embedding 或外部生产服务。 |
| Git 提交 | `9a33bec fix(前端): 收口业务代码质量门禁`。 |
| 代码质量 | `npm.cmd run lint`：退出码 `0`，无 ESLint 错误或未使用禁用指令；Prettier `endOfLine` 调整为 `auto`，避免对现有 LF/CRLF 文件进行全仓换行改写。 |
| 业务测试 | `npm.cmd test -- --run`：38 个测试文件、`192/192` 通过。 |
| 类型与构建 | `npm.cmd run typecheck` 通过；`npm.cmd run build` 通过，Vite 转换 `2010` 个模块。 |
| 代码范围 | 收口 Composer 无效 props、管理/业务页面数据订阅 effect 的规则提示和依赖、无效导入/变量；未暂存用户已有 `PlanningPage` CSS、Figma/QA JSON 和截图。 |
| 数据边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或真实云服务调用。 |
| 结论 | 当前前端业务质量门禁通过；性能、故障恢复、真实外部服务和生产环境门禁继续按项目决策后置。 |

## D33 当前分支全量业务门禁复跑（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/final-business-quality`；Java 21、项目 `agent-runtime\\.venv`；未调用真实云模型或付费 Embedding。 |
| Git 提交 | `2e83e7b docs(门禁): 同步前端业务验证状态`、`bae0d2e docs(执行记录): 登记全量业务门禁复跑`。 |
| Java 全量验证 | `.\mvnw.cmd verify`：`BUILD SUCCESS`；Shared `12/12`、Application `171/171`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Alibaba 规范 | `.\mvnw.cmd -Palibaba-code-style verify -DskipTests`：六个模块 Checkstyle 均 `0 violations`。 |
| Python 业务测试 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`116 passed、1 skipped、1 warning`；跳过项为显式真实云集成，未调用付费服务。 |
| 前端业务测试 | D32 已记录：lint、typecheck、Vitest `192/192` 和 Vite build 均通过。 |
| 数据与运行边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或生产环境操作。 |
| 结论 | 当前分支业务代码、Java/Python/前端业务门禁及 Java Alibaba 可执行规范子集均通过；真实依赖故障、性能、生产安全和不可逆清理继续后置。 |

## D34 本地依赖业务主路径回归（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/final-business-quality`；Java 21；Docker Engine `28.5.1`；未调用真实云模型或付费 Embedding。 |
| 依赖状态 | PostgreSQL 容器此前停止，本轮执行 `docker compose --env-file .env -f docker/compose.yml up -d postgres` 后恢复为 `healthy`；foodmate、agent-runtime、Redis、MinIO、RocketMQ NameServer/Broker/Proxy 保持 healthy。 |
| HTTP 业务回归 | `.\mvnw.cmd -pl foodmate-bootstrap -am test "-Dfoodmate.local-http-e2e=true" "-Dtest=M15FoodLogWriterHttpE2ETest" "-Dsurefire.failIfNoSpecifiedTests=false"`：`11/11` 通过，0 失败、0 错误。 |
| RocketMQ 业务回归 | `.\mvnw.cmd -pl foodmate-bootstrap -am test "-Dfoodmate.local-mq-e2e=true" "-Dtest=M15FoodLogWriterProposalResultE2ETest" "-Dsurefire.failIfNoSpecifiedTests=false"`：`11/11` 通过，0 失败、0 错误；覆盖 Proposal/Result 消息主路径。 |
| 数据边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测或故障注入；未清理现有本地数据。 |
| 暂缓范围 | Docker 流量统计、组件重启矩阵、ACK 丢失、重复投递故障注入、SSE 故障恢复、真实云模型/embedding、staging/production、发布回滚和不可逆清理继续暂缓。 |
| 结论 | PostgreSQL 恢复后，HTTP 与 RocketMQ 两条 `food_log_writer` 业务主路径均取得真实本地依赖回归证据；该证据不扩大 M1-6 性能与故障类门禁范围。 |

## D35 项目产品与实现入口状态收口（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/final-business-quality`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `1969e22 docs(项目): 对齐产品与实现入口状态`；仅更新产品范围/需求、Agent 架构、双运行时契约、后端现状、前端实现入口和前端实现清单 7 个文档。 |
| 文档对齐 | M2-1 公共知识库 deterministic 上传/索引/发布/检索/引用、M2-2 deterministic Tool/SQL 和 M2-3 管理核心切片按现有代码与业务证据登记；真实云服务、生产长稳、性能和故障门禁明确保留为后置范围。 |
| 文档校验 | 上述 7 个文档执行 `git diff --check`，无空白错误；未修改用户已有前端/Figma/QA 文件。 |
| 业务门禁依据 | 沿用 D32-D34：Java `verify`、Python `116 passed/1 skipped`、前端 `192/192` 及 lint/typecheck/build 通过，HTTP/MQ `food_log_writer` 各 `11/11` 通过。 |
| 数据与运行边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作。 |
| 结论 | 产品、架构、契约和实现入口已与当前 deterministic 本地业务状态一致；未将 deterministic 证据扩展为真实云、性能、故障恢复或生产完成。 |

## D36 历史状态文档口径修正（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | 分支 `codex/final-business-quality`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `9a0fbac docs(项目): 标注历史状态与当前闭环`；更新 MVP 主链路状态和 V2 双运行时迁移设计 2 个历史入口。 |
| 文档修正 | 更新主链路状态日期与 M2-1/M2-2/M2-3 当前 deterministic 业务闭环；将 V2 设计中的旧 Tool/SQL 判断明确标注为原始维护基线历史事实。 |
| 文档校验 | 两个文档执行 `git diff --check`，无空白错误；全量复核文档与执行记录执行 `git diff --check`，无错误。 |
| 数据与运行边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有 Figma/QA 和前端修改未暂存、未回滚。 |
| 结论 | 历史设计入口已明确与当前实现状态的时间边界；当前业务代码、测试与后置生产范围保持可追溯。 |

## D37 运行时异常处理与业务门禁复核（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/final-business-quality`；Java 21；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码提交 | `b3a089d fix(运行时): 补齐异常日志与代码规范`；仅修改 `RuntimeGatewayServiceImpl`，为监听器、超时取消和事件载荷解析异常补充结构化日志，补齐匿名实现 `@Override`、显式类型导入和控制语句大括号。 |
| 定向验证 | `.\mvnw.cmd --% -pl foodmate-application -am -Dtest=RuntimeGatewayServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`：`5/5` 通过。首次未带 `-am` 的命令因未构建 reactor 依赖导致共享类型缺失，已使用正确命令重跑成功。 |
| Java 全量验证 | `.\mvnw.cmd verify`：`BUILD SUCCESS`；Shared `12/12`、Application `171/171`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Alibaba 规范 | `.\mvnw.cmd --% -Palibaba-code-style verify -DskipTests`：根项目及六个模块均 `0 Checkstyle violations`。未使用默认 sun_checks 结果作为项目门禁。 |
| 只读审查 | 生产 Java 超长行共 `313` 条，主要来自既有 MyBatis SQL 注解；数字解析、反射查找中的 `ignored` 捕获属于预期控制流，未扩大为无关重构。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| Python 业务验证 | `.\agent-runtime\.venv\Scripts\python.exe -m pytest -q`：`116 passed、1 skipped、2 warnings`；跳过项为显式真实云集成，未调用真实模型或 Embedding。 |
| Docker 验证 | `docker compose --env-file .env -f docker/compose.yml config --quiet`：`COMPOSE_CONFIG_OK`；Java、Python、PostgreSQL、Redis、RocketMQ NameServer/Broker/Proxy、MinIO、Milvus 及其依赖当前均 healthy。 |
| 结论 | 运行时高置信度规范问题已修复并通过业务门禁；M2-1 deterministic 本地闭环沿用 D27/D34 直接证据，性能、故障恢复和真实外部服务继续后置。 |

## D38 运行时控制语句规范收尾（2026-08-26）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/final-business-quality`；Java 21；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | `RuntimeGatewayServiceImpl` 为事件 JDBC 分派、运行状态校验、监听器移除和事件发布等 5 处单行控制语句补齐大括号；未改变业务逻辑。 |
| 格式化 | `.\mvnw.cmd spotless:apply`：BUILD SUCCESS；Application 仅本次 Java 文件被格式化，其余模块无变更。 |
| 定向测试 | `.\mvnw.cmd -pl foodmate-application -am -Dtest=RuntimeGatewayServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`：`5/5` 通过，0 失败、0 错误。首次未带 `-am` 的命令因未构建 reactor 依赖导致共享类型缺失，已使用正确命令重跑成功；另一次 PowerShell 参数未引用导致 Maven 将参数误识别为生命周期阶段，均不属于代码失败。 |
| Alibaba 规范 | `.\mvnw.cmd --% -Palibaba-code-style verify -DskipTests`：根项目及五个 Java 模块均 `0 Checkstyle violations`，BUILD SUCCESS。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 运行时本轮控制语句规范收尾已通过定向业务测试、Spotless 和 Alibaba Checkstyle；性能、故障恢复、真实外部服务和生产门禁继续后置。 |

## D39 统一业务审计契约收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | Knowledge 与 Approval application 业务服务统一调用 `OperationAuditService`；移除两个 Repository 的旧 `insertAudit`/`nextAuditId` 契约及适配器实现；增加显式 `TraceContext` 审计重载，保留业务命令原始 request/trace 标识。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am -Dtest=OperationAuditServiceTest,KnowledgeServiceImplTest,KnowledgeUploadValidationTest,ApprovalServiceImplTest,KnowledgeRepositoryAdapterTest -Dsurefire.failIfNoSpecifiedTests=false test`：Application `27/27`、Infrastructure `6/6`，0 失败、0 错误。 |
| 格式与规范 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am spotless:apply` 成功；`mvnw.cmd -Palibaba-code-style verify -DskipTests` 成功，根项目及各 Java 模块 Checkstyle 均 `0 violations`；`git diff --check` 无错误。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；工作期间出现的用户已有前端 QA 修改未暂存、未回滚。 |
| 结论 | Knowledge/Approval 业务审计入口已收敛到统一 application 服务，测试和 Java 规范门禁通过；真实依赖、性能、故障恢复和生产门禁继续后置。 |

## D40 饮食业务统一审计契约收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | FoodLog/MealPlan application 服务改为直接调用 `OperationAuditService`；移除两个业务 Repository 的 `reserveAudit`、`completeAudit` 和 `AuditWrite` 写入契约；适配器仅保留幂等事实只读查询。 |
| 定向业务测试 | `mvnw.cmd -pl foodmate-application -am -Dtest=FoodLogServiceImplTest,MealPlanServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：`18/18` 通过，0 失败、0 错误。 |
| 相关模块测试 | `mvnw.cmd -pl foodmate-infra -am test`：Application `172/172`、Infrastructure `81/81`（17 skipped），0 失败、0 错误。 |
| Java 全量验证 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `172/172`、Infrastructure `81`（17 skipped）、API `64/64`、Bootstrap `58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Alibaba 规范 | `mvnw.cmd --% -Palibaba-code-style verify -DskipTests`：根项目及五个 Java 模块均 `0 Checkstyle violations`。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 饮食记录和餐食计划的业务审计写入入口已统一到 application 层服务，幂等重放与事务测试通过；真实性能、故障恢复和生产门禁继续后置。 |

## D41 FoodLog 失败审计闭环（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | FoodLog create/update/delete/restore 捕获业务失败；已占用审计在事务回滚后独立记录 `failed` 事实，未占用幂等键的参数/资源拒绝也通过 `OperationAuditService` 记录；竞争中的既有幂等事实不覆盖。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am -Dtest=FoodLogServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：`13/13` 通过，0 失败、0 错误；覆盖失败前后两类审计路径。 |
| 格式校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply`：`BUILD SUCCESS`。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | FoodLog 业务失败不会静默丢失审计事实；本项定向业务测试与格式校验通过，完整 Java 门禁待本轮相关改动收口后统一复跑。 |

## D42 MealPlan 失败审计闭环（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | MealPlan create/update/validate/save/delete/restore 统一跟踪审计占用状态；参数/资源拒绝写 `failed` 审计；已占用审计在事务回滚后通过独立事务记录失败事实；并发占用不覆盖既有幂等事实。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=MealPlanServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`9/9` 通过，新增参数拒绝和计划写入失败审计覆盖。 |
| 相关模块测试 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am test`：Application `176/176`、Infrastructure `81/81`（17 skipped），0 失败、0 错误。 |
| 格式校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply`：`BUILD SUCCESS`；`git diff --check` 无错误。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | MealPlan 业务失败审计与 FoodLog 保持一致；定向、相关模块和完整 Java 门禁均通过，Alibaba Checkstyle 为 `0 violations`；真实性能、故障恢复和生产门禁继续后置。 |

## D43 记忆候选失败审计闭环（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | Memory candidate 持久化、memory update/delete/confirm 异常统一写入 `failed` 审计；失败摘要仅保留异常类型、稳定错误码和关联 Run/Memory ID，不保存记忆值。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=MemoryCandidateServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`6/6` 通过，覆盖候选持久化和用户记忆更新失败审计。 |
| 格式校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply`：`BUILD SUCCESS`；未修改用户已有前端/Figma/QA 文件。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作。 |
| 结论 | 长期记忆业务写操作保留成功审计并补齐失败审计；定向业务测试和 Java 格式校验通过，完整门禁待相关切片收口后统一复跑。 |

## D44 密码重置审计闭环（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码范围 | 密码重置成功统一记录 `user.password.change`；无效/过期 token 和存储异常记录失败审计；审计不保存密码、token 或密码摘要。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=UserAccountServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`2/2` 通过。 |
| 格式校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply`：`BUILD SUCCESS`；未修改用户已有前端/Figma/QA 文件。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作。 |
| 结论 | 密码重置的成功和失败业务事实均进入统一审计；定向测试与格式校验通过，完整门禁待相关切片收口后统一复跑。 |

## D45 账户业务失败审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `99bc15b fix(审计): 补齐账户业务失败审计`。 |
| 代码范围 | 注册、密码修改、资料修改、会话创建/重命名/状态/删除/恢复、认证会话撤销、消息创建/修改/删除的异常路径统一记录 `failed` 审计；成功路径继续复用统一 `OperationAuditService`。 |
| 安全边界 | 失败审计只记录操作者、目标、action、稳定错误码、异常类型和必要关联 ID；不记录密码、令牌、消息正文或资料内容。非法参数映射为 `INVALID_ARGUMENT`，其他未分类异常映射为 `INTERNAL_ERROR`。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=UserAccountServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`6/6` 通过，覆盖注册、资料、会话和密码失败审计。 |
| 质量校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply` 与 `git diff --check` 通过。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 账户核心业务写操作具备成功/失败统一审计证据；M1-6 性能、故障恢复和生产门禁仍不因本切片改变。 |

## D46 AgentRun 创建与续接失败审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `a3e467e fix(审计): 补齐 AgentRun 创建失败审计`。 |
| 代码范围 | AgentRun 创建事务的消息、Run、预算、dispatch、Outbox、准入或审计失败统一记录 `agent_run.create/failed`；等待用户续接时父 Run `superseded` 冲突或写入失败单独记录 `agent_run.superseded/failed`。 |
| 安全边界 | 审计仅保存用户/Run/Session 关联 ID、稳定运行时错误码、状态关联和异常类型；不保存消息正文、Prompt、完整 command 或 payload。运行时协议错误保留原稳定错误码。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=AgentRunCommandServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`2/2` 通过，覆盖创建失败和父 Run `RUNTIME_STATE_CONFLICT`。 |
| 质量校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply` 与 `git diff --check` 通过。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | AgentRun 创建与父 Run 续接失败均有可追踪统一审计事实；本地业务测试通过，不扩展为消息故障恢复或性能证据。 |

## D47 个人数据请求失败审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `7e74d3f fix(审计): 补齐个人数据请求失败审计`。 |
| 代码范围 | 数据导出申请、账户注销申请和导出消费的数据库不可用、重复申请、过期/已消费状态及对象存储失败统一记录 `failed` 审计；既有头像安全与补偿审计保持不变。 |
| 安全边界 | 失败审计仅保存操作者、导出任务/用户目标、action、稳定错误码和异常类型；不保存导出对象键、预签名地址、账户内容或对象存储凭据。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=PersonalDataServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`8/8` 通过，覆盖导出申请、注销冲突和导出消费冲突。 |
| 质量校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply` 与 `git diff --check` 通过。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 个人数据导出/注销业务请求具备失败审计证据；后台异步任务技术状态仍遵循专用任务记录，不与申请审计重复。 |

## D48 Agent 反馈失败审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `6c829eb fix(审计): 补齐 Agent 反馈失败审计`。 |
| 代码范围 | 反馈功能关闭、参数校验、目标不存在、重复提交/幂等冲突和反馈持久化异常统一记录 `agent.feedback.submit/failed`；成功反馈继续记录结构化安全摘要。 |
| 安全边界 | 失败审计只记录用户/Run/消息关联 ID、稳定错误码和异常类型；不记录反馈评论、回答正文、Prompt、幂等参数原文或模型载荷。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=AgentFeedbackServiceImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`4/4` 通过，覆盖校验失败和持久化失败审计。 |
| 质量校验 | `mvnw.cmd -pl foodmate-application -am spotless:apply` 与 `git diff --check` 通过。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | Agent 反馈业务写操作具备成功/失败统一审计证据；不将业务测试结果扩展为生产质量或性能结论。 |

## D49 统一业务审计失败路径总门禁（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 全量 Java 业务验证 | `mvnw.cmd -pl foodmate-application -am test`：Application `190/190`、Shared `12/12`，0 失败、0 错误；`mvnw.cmd clean verify`：Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped），构建成功。 |
| 格式与规范 | `spotless:check`/`spotless:apply`、`git diff --check` 通过；`mvnw.cmd --% -Palibaba-code-style verify -DskipTests` 根项目及五个 Java 模块均 `0 Checkstyle violations`。 |
| 架构扫描 | `rg` 复核显示 `operation_audits` 的写入只存在于 `foodmate-infra` 统一适配器；业务 application 模块只依赖 `OperationAuditService`，未直接写表。 |
| 覆盖结论 | 账户、个人数据、AgentRun、Agent 反馈，以及此前已收口的 Knowledge/Approval/FoodLog/MealPlan/Memory/预算/取消/恢复写操作均具备统一成功/失败审计入口；协议错误、事件拒绝、SQL 查询和 Outbox/Inbox 技术状态仍保持专用审计。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；工作树中用户已有前端/Figma/QA 改动未暂存、未回滚。 |
| 结论 | 本轮统一业务审计失败路径收口及 Java 业务门禁完成；M1-6 整体仍不宣称完成，吞吐、队列、重启、故障恢复和生产治理按当前决策继续后置。 |

## D50 知识库业务失败审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `04ebb1d fix(审计): 补齐知识库业务失败审计`。 |
| 代码范围 | 单文件上传、批次上传、文档状态变更、发布/下线/删除/恢复可见性变更和索引条目手动重试的校验、依赖、存储、数据库及状态失败均记录 `failed` 审计；失败审计沿用独立事务并保留命令 trace。 |
| 安全边界 | 失败审计只保存操作者、知识文档/批次关联 ID、action、稳定错误码和异常类型；不保存文件原文、对象键、授权正文、预签名地址或模型密钥。 |
| 业务测试 | `mvnw.cmd --% -pl foodmate-application -am test`：Shared `12/12`、Application `195/195`，0 失败、0 错误；新增知识库失败路径和显式失败 trace 测试均通过。 |
| 质量校验 | `mvnw.cmd --% -pl foodmate-application spotless:apply` 与 `git diff --check` 通过。首次直接执行 application 模块未带 `-am`，因本地 Shared 依赖未在 classpath 导致 Maven 编译失败；随后使用 reactor `-am` 命令成功完成验证，该参数问题不是代码测试失败。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 知识库业务写命令的失败审计覆盖已补齐，且不改变既有成功路径和补偿行为；M1-6 整体仍不宣称完成，吞吐、队列、重启、故障恢复和生产治理按当前决策继续后置。 |

## D51 阿里 Java 规范与功能版门禁复核（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；官方手册来自 [alibaba/p3c](https://github.com/alibaba/p3c) 的《Java 开发手册（黄山版）》；未调用真实云模型、付费 Embedding 或生产服务。 |
| 规范复核 | 已读取手册 55 页；生产源码无字段注入、通配符 import、`System.out/err`、`printStackTrace`、泛化 `catch (Exception/Throwable)` 或 `MAX(id)+1`。`com.foodmate.shared.runtime.RuntimeException` 是携带稳定错误码的自定义协议异常，不属于无语义的 JDK `RuntimeException` 直接使用。 |
| Java 规范门禁 | `mvnw.cmd -Palibaba-code-style -DskipTests verify`：根项目及五个 Java 模块 Checkstyle 均 `0 violations`；Spotless、编译和 Spring Boot repackage 通过。 |
| Java 业务门禁 | `mvnw.cmd clean verify`：Shared `12/12`、Application `195/195`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped），BUILD SUCCESS；环境依赖型测试按既有开关跳过。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`116 passed、1 skipped、1 warning`；跳过项为显式真实外部服务，不调用付费模型或真实 Embedding。 |
| 前端业务门禁 | `npm.cmd test -- --run`：38 个测试文件、194/194 通过；`npm.cmd run typecheck` 和 `npm.cmd run build` 通过，Vite 转换 2010 个模块。`npm.cmd run lint` 未通过，但仅有用户现有 `HomePage.tsx` 与 `AnalysisPage.tsx` 各 1 条 Prettier CRLF warning、0 errors；本轮未修改或暂存这些用户改动。 |
| SQL 与数据边界 | SQL 迁移/validation/rollback 目录未修改；未执行迁移、truncate、数据库硬删除、备份恢复或宽泛清理。仅清理本轮创建的临时官方手册文件和浅克隆目录。 |
| 暂缓边界 | 不将本轮业务门禁扩展为吞吐/延迟/积压、组件重启、ACK 丢失、重复投递、SSE 故障恢复、真实云服务、生产部署或生产强化证据；M1-6 和 M3 后置范围保持未完成。 |
| 结论 | 当前功能版 Java/Python/前端业务测试、Java 21 可执行规范子集和安全扫描均有可复核结果；前端 lint 的两条用户现有格式 warning 需在其 UI 修改收口时一并处理，不影响本轮业务测试通过结论。 |

## D52 指定阿里 Java 手册 v1.3.0 与功能版门禁复核（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 手册来源 | 用户指定的 GitHub 仓库文件《阿里巴巴Java开发手册终极版 v1.3.0》；仓库 API 文件大小 `1056487` 字节，Git blob SHA `e6ed0c529f1f5ab8041388e60dcd28bb0d9dfdc7`，PDF 共 39 页；已渲染并目视检查封面、目录和正文页。 |
| 规范复核范围 | 复核命名/常量/格式、OOP/集合/并发、控制语句、注释、异常日志、单元测试、安全、SQL/ORM 和工程分层条款。当前生产源码未发现字段注入、通配符 import、`System.out/err`、`printStackTrace`、`MAX(id)+1` 或无稳定语义的 JDK `catch (Exception/Throwable)`；统一审计写入仍只有 `foodmate-infra` 适配器。 |
| Java 门禁 | 沿用本轮已通过结果：`mvnw.cmd clean verify` 的 Shared `12/12`、Application `195/195`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped），BUILD SUCCESS；Alibaba Checkstyle 根项目及五个模块均 `0 violations`。 |
| 前端门禁 | 对 `AnalysisPage.tsx`、`HomePage.tsx` 执行 Prettier 格式修复后，`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test -- --run`（38 个测试文件、194/194）和 `npm.cmd run build` 全部通过。用户已有 `ChatPage.module.css` 修改保持未暂存、未回滚。 |
| Python 门禁 | 沿用本轮已通过结果：`agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`116 passed、1 skipped、1 warning`；跳过项为显式真实外部服务。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复或宽泛清理；仅清理本轮下载的手册浅克隆、PDF 渲染图和提取文本。吞吐压测、队列积压、组件重启、ACK/重复消息故障注入、SSE 故障恢复、真实云服务和生产部署继续后置。 |
| 结论 | 用户指定的 v1.3.0 手册已完成可追溯核对；当前功能版业务门禁通过，前端 lint 两条格式 warning 已收口。该证据不扩大 M1-6/M3 的后置性能、故障和生产完成范围。 |

## D53 M14/M15 业务回归与统一审计收口（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；Docker Compose 依赖已恢复并保持 healthy；未调用真实云模型、付费 Embedding 或生产服务。 |
| 业务回归 | M14 本地业务 E2E `10/10` 通过；M15 HTTP `11/11` 通过；M15 RocketMQ `11/11` 通过；`ApprovalServiceImplTest` `14/14` 通过。覆盖 Proposal/Confirm/Reject/Failed/Superseded、food_log_writer 业务写入、消息主路径和幂等回归。 |
| 缺陷修复 | `cb3dc68 fix(审批): 注入统一审计并校正失败回归`：修复 `ApprovalServiceImpl` Spring 构造注入，确保审批终态及 food_log 失败事实通过统一审计入口落库；失败回归断言改为验证 `food_log.* failed` 审计存在。 |
| 环境隔离 | HTTP E2E 期间暂时停止并随后恢复 Docker `foodmate` 容器，避免宿主机测试 JVM 与容器 JVM 使用相同 Snowflake `workerId=1` 造成主键冲突；该措施属于测试环境隔离，不计入 Java 故障恢复矩阵。 |
| 其他门禁 | `mvnw.cmd -pl foodmate-application -am spotless:check`：BUILD SUCCESS；Python 既有业务门禁 `116 passed、1 skipped、1 warning`；前端 lint、typecheck、38 个测试文件 `194/194` 和 build 均通过；当前 Docker 服务均 healthy。 |
| 数据边界 | 本轮 E2E 仅生成随机命名空间的 `m15*` 测试数据，未执行迁移、truncate、数据库硬删除、备份恢复或宽泛清理；用户已有 UI/Figma/QA 改动未暂存、未回滚。 |
| 暂缓范围 | Docker-backed 流量统计、吞吐/延迟/队列积压、Java/Python/PostgreSQL/Redis/RocketMQ 重启、ACK 丢失、重复投递故障注入、SSE Last-Event-ID 故障恢复、真实云服务、staging/production 和发布回滚继续暂缓。 |
| 结论 | M14/M15 业务主路径、审批统一审计修复和受影响 Java 格式校验已取得可复核结果；该记录不将业务回归扩展为 M1-6 故障/性能门禁完成证据。 |

## D54 calculator/plan_validator 工具业务切片与统一审计修正（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Git 提交 | `8ac3a36`、`9419754`、`616e155`、`037cab2` 完成 calculator/plan_validator 的 Java 执行器和 Python Proposal/Composer 路径；`74f49bd fix(审计): 将工具执行审计收敛到统一入口` 修正工具执行审计适配。 |
| 代码范围 | Java calculator 使用有界表达式解析器，支持括号、四则运算、取余、小数和一元正负号，并拒绝代码片段、除零、超长表达式和超大结果；Java plan_validator 只读校验人数、天数、三餐、预算、营养目标、过敏原和忌口；Python 只从 Java 授权上下文生成 Proposal，Composer 只使用 Java 结果。 |
| 审计与安全 | calculator/plan_validator 成功与失败终态通过 `OperationAuditService` 记录；输入只保留 SHA-256 摘要和 invocation 关联，不保存表达式、计划内容或 Prompt。SQL 查询继续使用专用 `sql_query_audits`，未与业务审计重复写入。 |
| 业务测试 | `mvnw.cmd -pl foodmate-application -am "-Dtest=ToolPolicyGatewayServiceTest,ToolGatewayServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`：`ToolGatewayServiceTest` `14/14`、`ToolPolicyGatewayServiceTest` `7/7`，共 `21/21` 通过。 |
| 质量校验 | `mvnw.cmd -pl foodmate-application -am spotless:check` 通过；`mvnw.cmd -pl foodmate-application -am -P alibaba-code-style verify -DskipTests` 通过，相关模块 Checkstyle `0 violations`；`git diff --check` 通过。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | calculator 与 plan_validator 的确定性业务路径、Python 提案路径和统一工具执行审计修正已取得可复核证据；M1-6 的吞吐、队列、重启、故障恢复和生产治理仍按当前决策后置。 |

## D55 功能版全量业务门禁复核（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Java 全量门禁 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `200/200`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped）；编译、Spotless、ArchUnit、测试和 Spring Boot repackage 通过。 |
| Python 业务门禁 | 使用项目 `agent-runtime\.venv\Scripts\python.exe -m pytest -q`：`124 passed、1 skipped、2 warnings`；跳过项为显式真实外部服务，未调用真实模型或 embedding。 |
| 前端业务门禁 | `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test -- --run`（38 个测试文件、`194/194`）和 `npm.cmd run build` 全部通过；未修改用户现有页面差异。 |
| 失败与补偿记录 | 首次 `clean verify` 在 Bootstrap 发现既有测试支持文件混合换行并由 Spotless 拒绝；单独执行 Bootstrap Spotless 后仅统一换行，Git 内容 hash 未变化，再次 `clean verify` 成功。该格式修正未产生独立提交。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端/Figma/QA 修改未暂存、未回滚。 |
| 结论 | 当前功能版 Java、Python、前端业务门禁和本轮工具切片均有实际通过证据；不据此宣称 M1-6 性能/故障恢复或生产强化完成。 |

## D56 当前源码 Docker 应用恢复与业务门禁复核（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Docker 构建 | `docker compose --env-file .env -f docker/compose.yml up -d --build foodmate agent-runtime` 成功；当前源码构建的 `foodmate-foodmate` 与 `foodmate-agent-runtime` 镜像均完成导出并启动。RocketMQ 初始化容器最终退出码 `0`，Topic/consumer group 初始化完成。 |
| Docker readiness | `docker compose --env-file .env -f docker/compose.yml ps` 显示 Java `foodmate`、Python `agent-runtime`、PostgreSQL、Redis、MinIO、RocketMQ NameServer/Broker/Proxy、Milvus 及其依赖均 healthy；`docker compose --env-file .env -f docker/compose.yml config --quiet` 通过。 |
| 应用 readiness | Java `http://localhost:8080/actuator/health/readiness` HTTP `200`、状态 `UP`；Python `http://localhost:9002/foodmate/internal/health/ready` HTTP `200`，评估 `10/10` 通过，活动 dispatch 与 result waiter 均为 `0`。 |
| Docker 业务回归 | 当前源码重建前已在停止旧应用容器、隔离同一 consumer group 后完成 `M15FoodLogWriterProposalResultE2ETest` `11/11`；覆盖真实 RocketMQ Proposal/Result、PostgreSQL 写入、失败审计、终态和幂等回归。首次旧镜像与宿主测试 JVM 同时运行时出现预期审计数量为 `1`、实际为 `0` 的竞争干扰，已定位为旧镜像共享 consumer group，不作为业务代码失败。 |
| Python 业务门禁 | 项目环境 `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`124 passed、1 skipped、1 warning`；跳过项为显式真实外部服务，未调用付费模型或真实 Embedding。 |
| 前端业务门禁 | `npm.cmd run typecheck` 通过；`npm.cmd test -- --run`：38 个测试文件、`196/196` 通过；`npm.cmd run build` 通过并转换 2010 个模块。`npm.cmd run lint` 仅因既有 `ChatPage`、`PlanningPage` 文件的 31 条 Prettier CRLF warning 退出，0 errors；本轮未修改、未暂存这些 UI 文件。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK 丢失、重复投递故障注入或 SSE 故障恢复；本轮只使用既有本地 Docker 服务和随机测试命名空间，未删除数据卷。用户已有 UI/Figma/QA 改动未暂存、未回滚。 |
| 结论 | 当前源码 Docker 应用已恢复并通过 readiness，Java/Python/前端业务主路径门禁保持通过；lint 的既有换行 warning 和 M1-6 性能/故障恢复范围不扩大为本轮完成项。 |

## D57 功能版门禁最终复跑与状态文档同步（2026-08-27）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-quality-followup`；本轮未调用真实云模型、付费 Embedding 或生产服务。 |
| Java 业务门禁 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `200/200`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped）；编译、测试、Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Python 业务门禁 | 项目 `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`124 passed、1 skipped、2 warnings`；跳过项为显式真实外部服务，未调用真实模型或 Embedding。 |
| 前端业务门禁 | `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd test -- --run` 和 `npm.cmd run build` 均通过；Vitest 为 38 个测试文件、`196/196`，Vite 转换 2010 个模块。 |
| Java 规范与架构扫描 | `mvnw.cmd --% -Palibaba-code-style verify -DskipTests`：根项目及五个模块 Checkstyle 均 `0 violations`；生产源码未发现泛化异常捕获、通配符 import、标准输出/堆栈打印、`MAX(id)+1`，application/api/bootstrap 未直接写 `operation_audits`。消息序号和预算扩展序号的 `MAX(...)` 查询分别受 PostgreSQL advisory lock、`FOR UPDATE` 事务锁保护，不属于主键 ID 生成。 |
| 文档收口 | 同步 M2-1/M2-2/M2-3、M2 总计划、总 TODO、路线图、产品文档、测试策略、README 和本地开发指南的当前日期/门禁数字；带历史日期的执行证据保留原样。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或 SSE 故障恢复；用户已有前端/Figma/QA 改动未暂存、未回滚。 |
| 结论 | 当前功能版业务代码与测试门禁保持通过；M1-6 的吞吐/积压、完整故障恢复和生产强化仍按既定决策后置，不据此标记完成。 |

## D58 真实 PostgreSQL 全迁移与业务幂等约束验证（2026-08-28）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；Testcontainers 启动隔离的 PostgreSQL `16-alpine`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 执行命令 | `mvnw.cmd --% -pl foodmate-infra -am -Ddocker.available=true -Dtest=BusinessIdempotencyRealMigrationTest -Dsurefire.failIfNoSpecifiedTests=false test`；随后执行 `mvnw.cmd --% -pl foodmate-infra -am spotless:check`。 |
| 迁移验证 | 当前 baseline + migration 共 26 个版本在空数据库真实执行成功；第二次 `flyway.migrate()` 执行 `0` 个迁移，证明重复执行为 no-op。V12 的已存在列和 V18/V19 的事务提示为 PostgreSQL/Flyway 的非失败 warning。 |
| 幂等验证 | `food_logs`、`meal_plans`、`approval_requests` 和 `operation_audits` 的重复业务事实均返回 PostgreSQL SQLState `23505`；最终每类测试用户业务事实均保持 1 条，无额外写入。 |
| 质量门禁 | 定向测试 `2/2` 通过；Infrastructure 及上游 reactor 构建成功；Spotless `check` 通过；新增测试已提交为 `85fb2e6 test(数据库):补齐业务幂等写入验证`。 |
| 数据与暂缓边界 | 只使用隔离 Testcontainers 数据库，未连接或修改现有 FoodMate 数据；未执行迁移到现有库、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或 SSE 故障恢复。 |
| 结论 | M0-2 中并发消息序号、账号唯一性、会话撤销和业务幂等写入的数据库级测试均已有证据；M1-6 性能、完整故障矩阵和 M3 生产强化仍保持后置。 |

## D59 饮食记录真实业务闭环与前端周视图修复（2026-08-28）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；未调用真实云模型、付费 Embedding 或生产服务。 |
| 代码与提交 | 新增 `GET /api/food-logs/deleted`；前端 real 模式接入饮食记录查询、编辑、软删除查询与恢复，增加日/周视图和份量/单位录入；修正周视图具体日期新增写入错误。提交为 `2b6184f`、`d27bf20`、`29a3057`。 |
| Java 业务门禁 | 前置验证：Application `14/14`、API `3/3`、Spotless 通过；全量 `mvnw.cmd clean verify` 已通过。 |
| 前端业务门禁 | 饮食记录定向测试 `7/7`、ESLint、Prettier、typecheck 和 build 通过；全量 Vitest `38` 个文件、`201/201` 通过。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`124 passed、1 skipped、2 warnings`；跳过项为显式真实外部服务测试。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或 SSE 故障恢复；用户已有分析页改动和 UI 验收图片未暂存、未回滚。 |
| 结论 | 饮食记录 real 业务主路径与周视图日期修复取得可复核业务门禁结果；M1-6 性能、完整故障恢复和生产强化仍保持后置。 |

## D60 local RAG Worker readiness gate 与业务门禁复核（2026-08-28）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；默认 Docker 配置为 `FOODMATE_RAG_MODE=stub`；未读取真实 API Key，未调用真实云模型或付费 embedding。 |
| 代码与提交 | `17306d9 修复知识索引本地启动门禁`；local 模式在启动索引/可见性消费者前等待 Milvus `/healthz`，默认从 `19530` 推导 `9091/healthz`，可用 `FOODMATE_RAG_MILVUS_HEALTH_URL` 覆盖；stub 模式直接跳过探测。 |
| Python 业务测试 | `PYTHONDONTWRITEBYTECODE=1 .\\agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`126 passed、1 skipped、2 warnings`。新增 stub bypass 与 local health probe 定向用例包含在结果内。 |
| 前端业务测试 | `foodmate-ui` 的 `npm.cmd test -- --run`：38 个测试文件、`201/201` 通过；`npm.cmd run build`（含 typecheck）通过，Vite 转换 2010 个模块。 |
| Java 业务门禁 | `mvnw.cmd clean verify`：BUILD SUCCESS；Shared `12/12`、Application `201/201`、Infrastructure `83/83`（19 skipped）、API `65/65`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Docker 配置与容器 smoke | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；已有 `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO、Milvus 及依赖容器保持 healthy。使用现有已安装依赖的 Agent 镜像挂载当前源码：stub 输出 `STUB_READY_GATE_BYPASSED`；local 输出 `LOCAL_MILVUS_READY_GATE_PASSED`，并在容器网络内访问 `http://milvus:9091/healthz` 成功。 |
| Docker 构建记录 | `docker compose --env-file .env -f docker/compose.yml up -d --build agent-runtime` 在 `pip install .` 的构建隔离阶段因访问 `pypi.org` 的 TLS/网络错误失败，未将该次命令记为新镜像构建成功；原运行容器未被删除，readiness 保持正常。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；未新增业务数据。 |
| 结论 | local Worker 的启动顺序门禁已通过代码、定向 pytest 和容器网络 smoke 验证；stub 不受 Milvus 依赖影响。Docker 镜像完整重建仍受外部 PyPI TLS/网络条件阻断，需在网络恢复后重新执行；M1-6 性能/故障类门禁继续后置。 |

## D61 全项目代码规范与业务门禁最终复核（2026-08-28）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；未调用真实云模型、付费 Embedding 或生产服务。 |
| Java 规范 | `mvnw.cmd --% -Palibaba-code-style verify -DskipTests` 通过；根项目及 Shared、Application、Infrastructure、API、Bootstrap 均为 Checkstyle `0 violations`，Spotless 通过。生产源码扫描未发现泛化异常捕获、通配符 import、控制台输出、`Executors` 工厂或 `MAX(id)+1` 主键生成；application/api/bootstrap 未直接写 `operation_audits`。 |
| SQL 组织 | `baseline/migration/validation/rollback/seed` 分层保持一致；V3-V12 历史配套文件缺失范围已在 SQL README 与执行台账说明，本轮未改写已执行迁移、未补危险 rollback。 |
| Java 业务门禁 | `mvnw.cmd clean verify`：`BUILD SUCCESS`；Shared `12/12`、Application `201/201`、Infrastructure `83/83`（19 skipped）、API `65/65`、Bootstrap `58/58`（37 skipped）；Spotless、ArchUnit 和 Spring Boot repackage 通过。 |
| Python 业务门禁 | `PYTHONDONTWRITEBYTECODE=1 .\\agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`126 passed、1 skipped、2 warnings`；跳过项为显式真实外部服务测试。 |
| 前端业务门禁 | `foodmate-ui` `npm.cmd test -- --run`：38 个测试文件、`201/201` 通过；`npm.cmd run typecheck` 与 `npm.cmd run build` 通过，Vite 转换 2010 个模块。 |
| Docker | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；现有 PostgreSQL、Redis、MinIO、RocketMQ、Milvus 及应用容器均 healthy。Docker `agent-runtime` 完整重建仍受 PyPI TLS/网络错误阻断，未伪造为成功。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产环境操作；用户已有前端视觉改动未暂存、未回滚。 |
| 结论 | 功能版 Java/Python/前端业务门禁和当前可执行的 Alibaba 规范子集均通过；不可逆硬删除、真实依赖清理、性能/故障矩阵、生产安全与部署演练继续后置。 |

## D62 SiliconFlow 真实 Chat 与双 Embedding smoke（2026-08-28）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；API Key 仅通过当前进程环境变量传入，未写入仓库、日志或执行记录。 |
| 服务发现 | SiliconFlow `https://api.siliconflow.cn/v1/models` HTTP 成功；目标模型 `BAAI/bge-m3`、`Qwen/Qwen3-Embedding-0.6B` 和 `deepseek-ai/DeepSeek-V4-Flash` 均可见。 |
| Embedding 验证 | `FOODMATE_RUN_REAL_EMBEDDING_TESTS=true .\\agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q agent-runtime/tests/test_real_embedding_integration.py`：`1 passed`；同一测试分别请求两个模型，均返回 1 个、1024 维浮点向量。 |
| Chat 验证 | `FOODMATE_RUN_REAL_CLOUD_TESTS=true`，primary/eval 显式使用 `cloud_primary:deepseek-ai/DeepSeek-V4-Flash`，执行 `agent-runtime/tests/test_real_cloud_integration.py`：`1 passed`；真实 Chat 和独立评测请求均返回非空内容、provider request ID 和 usage。 |
| 代码修正 | 真实云测试现在尊重显式 `FOODMATE_MODEL_TIER_STANDARD/EVAL`，只配置 SiliconFlow primary 也可执行；离线 pytest 默认仍隔离为 deterministic。新增安全扫描脚本默认 secret scan：`secret_scan_hits=0`、`tracked_env_files=0`、`security_scan_status=passed`。 |
| 依赖扫描 | `security-scan.ps1 -RunNpmAudit` 未发现可判定漏洞；当前 npm registry `registry.npmmirror.com` 的 advisory endpoint 返回 `404/[NOT_IMPLEMENTED]`，脚本将其记录为 skipped，不伪造为通过的漏洞结论。Python `pip-audit` 尚未安装，OWASP dependency-check 未执行。 |
| 数据与边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产服务；真实调用是单次 smoke，不代表云模型长稳、价格审计、账单对账或生产容量完成。 |
| Git 提交 | `2cbab19 test(runtime): verify real cloud provider configuration safely`。 |
| 结论 | SiliconFlow 真实 Chat 与两个 Embedding 的最小调用合同已取得可复核证据；真实云长期稳定性、正式价格/账单审计和生产强化保持未完成。 |

## D63 M3 清理执行结果对账闭环定向验证（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；未连接现有业务数据库、未执行真实硬删除、未调用付费云服务。 |
| 代码范围 | 清理结果台账 `data_purge_task_results`、PostgreSQL/MinIO/Redis/Milvus 删除后存在性验证、外部结果上下文校验、结果摘要幂等和数据库清理事务入口。 |
| 执行命令 | `.\mvnw.cmd --% -pl foodmate-application,foodmate-infra -am -Dtest=DataRetentionDeliveryServiceImplTest,DataRetentionResultMessageProcessorTest,DataRetentionTaskPublisherTest,DataRetentionDatabasePurgeAdapterTest,FlywayV27MigrationScriptTest -Dsurefire.failIfNoSpecifiedTests=false test` |
| Java 结果 | Application `14/14`、Infrastructure `8/8` 通过；编译、定向业务测试和 V27 迁移脚本安全检查通过。 |
| 关键断言 | 外部结果必须匹配任务不可变上下文；重复结果生成相同摘要且只触发一次状态收敛；数据库/对象存储结果记录删除数量并验证资源缺失；成功结果必须 `verified_absent=true`。 |
| 规范检查 | 受影响 Java 模块已执行 `spotless:apply`；`git diff --check` 通过；新增/修改类级注释已使用中文。 |
| 数据与暂缓边界 | 未执行 V27 到现有数据库的迁移、truncate、真实数据库硬删除、备份恢复、组件重启、性能压测或故障注入；V27 rollback 仍为只读前置检查。 |
| 结论 | M3 清理结果对账和失败关闭校验具备定向业务证据；真实环境执行、备份恢复和生产强化仍未完成，不能据此标记整个 M3 完成。 |

## D64 真实隔离 PostgreSQL 全量迁移与业务幂等复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；Testcontainers 启动隔离 PostgreSQL `16-alpine`；未连接现有 FoodMate 数据库，未调用真实云服务。 |
| 执行命令 | `mvnw.cmd --% -pl foodmate-infra -am -Ddocker.available=true -Dtest=BusinessIdempotencyRealMigrationTest -Dsurefire.failIfNoSpecifiedTests=false test` |
| 迁移结果 | baseline 与 migration 共 27 个版本从空数据库执行成功，Flyway 当前版本为 `v27`；第二次 `flyway.migrate()` 执行 `0` 个迁移。V12/V13/V15/V16 的已存在对象提示是脚本的兼容性 warning，不影响迁移成功。 |
| 幂等结果 | `food_logs`、`meal_plans`、`approval_requests` 和 `operation_audits` 的重复事实均被 PostgreSQL 以 SQLState `23505` 拒绝；每类测试事实最终保持 1 条。 |
| 质量结果 | Infrastructure reactor 定向测试 `2/2` 通过；测试容器正常启动并由 Testcontainers 回收；本轮未修改用户已有前端、QA 或 NutritionSeedScript 改动。 |
| 数据与暂缓边界 | 只使用隔离 Testcontainers 数据库；未执行现有库迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或 SSE 故障恢复。 |
| 结论 | V27 已在真实 PostgreSQL 空库中取得可复核的迁移和业务幂等证据；M3 实际清理、备份恢复及生产强化仍需独立验证，不能据此宣称完成。 |

## D65 真实隔离 PostgreSQL 知识文档硬删除与重放验证（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；Testcontainers PostgreSQL `16-alpine`；只使用随机测试数据，未连接现有 FoodMate 数据库。 |
| 执行命令 | `mvnw.cmd --% -pl foodmate-infra -am -Ddocker.available=true -Dtest=DataRetentionDatabasePurgeRealIntegrationTest,DataRetentionDatabasePurgeAdapterTest,DataRetentionTaskPublisherTest -Dsurefire.failIfNoSpecifiedTests=false test` |
| 删除结果 | 真实 MyBatis Mapper 按依赖顺序删除知识文档的结果 Inbox、索引 Outbox、批次 SSE、chunks、可见性 Outbox、导入条目和文档；首次返回 `backend=postgresql/deleted_count=7/verified_absent=true`。 |
| 保留结果 | `data_purge_task_results`、`data_purge_tasks` 和 `data_purge_requests` 均保留，证明执行对账事实与清理计划不会随业务资源删除。 |
| 重放结果 | 同一已批准清理流程再次调用返回 `deleted_count=0/verified_absent=true`，无唯一键或外键错误；guard 仅允许存在已软删除资源或在同一批准流程下已不存在的资源。 |
| Java 结果 | Application `7/7`、Infrastructure `7/7` 通过；包含对象/向量/数据库任务业务测试和真实隔离 PostgreSQL 删除验证。 |
| 数据与暂缓边界 | 未对现有库执行硬删除、truncate、备份恢复、性能压测、组件重启、ACK/重复消息故障注入或 SSE 故障恢复；真实云服务未调用。 |
| 结论 | M3 数据库清理的真实删除、结果保留和幂等重放已有隔离环境证据；现有生产数据清理、备份恢复和生产强化仍未完成。 |

## D66 Python 依赖与仓库秘密扫描（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；使用项目环境 `agent-runtime\\.venv\\Scripts\\python.exe`；未调用云模型、Embedding 或生产服务。 |
| 执行命令 | `script\\security\\security-scan.ps1 -RunPythonAudit` |
| 扫描结果 | `secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`；`pip-audit --local` 未报告已知漏洞。 |
| 扫描边界 | 秘密规则只匹配高置信度凭据格式；未把配置名、测试占位值或文档中的变量名误报为密钥。对话中曾公开的旧 API Key 未写入仓库，后续不再使用。 |
| 数据与暂缓边界 | 未修改业务数据、未执行性能压测、组件重启、故障注入、备份恢复或生产部署；npm advisory/OWASP 扫描不在本轮命令中执行。 |
| 结论 | Python 依赖和 Git 跟踪文件秘密扫描已有本地证据；完整生产安全流程、密钥轮换执行和渗透测试仍未完成。 |

## D67 SiliconFlow 双 Embedding 真实接口复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；使用项目 `agent-runtime\.venv`，Python 字节码写入已关闭。 |
| 执行命令 | 在当前 PowerShell 进程临时注入 SiliconFlow endpoint 和 embedding credential：`$env:FOODMATE_RUN_REAL_EMBEDDING_TESTS=true`；`PYTHONDONTWRITEBYTECODE=1 .\\.venv\\Scripts\\python.exe -m pytest -q tests/test_real_embedding_integration.py -p no:cacheprovider`。凭据未写入文件、源码、日志或执行记录。 |
| 验证结果 | `1 passed in 0.57s`；测试覆盖 `BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B`，两者各返回 1 个、1024 维浮点向量。 |
| 缓存检查 | 项目范围 `*.pyc/*.pyo=0`、`__pycache__/.pytest_cache=0`；`.gitignore` 已忽略 Python 生成缓存。 |
| 数据与边界 | 未写入 Milvus 业务数据，未执行索引批次、真实 AgentRun、性能压测或生产调用；本次只证明 SiliconFlow `/embeddings` 的协议和模型维度契约。对话中公开的 credential 不再复用，应在供应商控制台轮换。 |
| 结论 | 两个指定 Embedding 模型的真实接口 smoke 通过；真实 RAG 全链路、长期稳定性、正式价格/账单审计和生产强化仍未完成。 |

## D68 本地业务门禁与 Python 缓存清理复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；使用项目 `agent-runtime\\.venv`；未调用云服务或生产依赖。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q`：`154 passed、2 skipped、4 subtests passed`；跳过项为显式外部服务测试。 |
| Java 业务门禁 | `mvnw.cmd --% -pl foodmate-application,foodmate-infra,foodmate-api -am test`：Shared `12`、Application `211`、Infrastructure `96`（20 skipped）、API `68`，无失败。 |
| 规范与安全 | `mvnw.cmd --% -Palibaba-code-style verify -DskipTests` 成功，所有 Java 模块 Checkstyle `0 violations`；Spotless 通过；安全扫描 `tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`。 |
| Python 缓存 | 源码与测试目录的 `.pyc/.pyo`、`__pycache__`、`.pytest_cache` 已清理；`.venv` 内部依赖缓存保留并由 `.gitignore` 忽略，不纳入版本库。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产操作；未使用对话中暴露的旧凭据。 |
| 结论 | 当前本地业务门禁和规范/秘密扫描通过；真实云调用需使用轮换后的新凭据，生产强化和暂缓验证仍不能标记完成。 |

## D69 依赖漏洞扫描复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行命令 | `script\\security\\security-scan.ps1 -RunPythonAudit -RunNpmAudit`；并使用 `agent-runtime\\.venv\\Scripts\\python.exe -m pip_audit --local` 复核。 |
| Python | `pip-audit` 报告 `No known vulnerabilities found`；项目自身 editable 包不在 PyPI，按工具提示跳过该包，不影响第三方依赖扫描结论。 |
| npm | `package-lock.json` 存在，但当前 registry advisory endpoint 返回不可用，脚本记录 `npm audit: registry advisory endpoint unavailable` 并将该项标记为 skipped。 |
| 秘密扫描 | `tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`。 |
| 结论 | Python 依赖和仓库秘密扫描有本地证据；npm advisory 服务恢复后需重新执行，OWASP dependency-check、渗透测试和生产安全验证仍未完成。 |

## D70 Python 缓存清理与本地安全/业务门禁复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；使用项目 `agent-runtime\\.venv\\Scripts\\python.exe`；未使用或读取对话中暴露的旧 API Key。 |
| 缓存清理 | 清理项目范围内 `.pyc`、`.pyo`、`__pycache__` 和 `.pytest_cache`；保留 `agent-runtime\\.venv` 环境本身；清理后相关文件/目录计数为 `0`。 |
| 安全门禁 | `script\\security\\security-scan.ps1 -RunPythonAudit -RunNpmAudit`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`154 passed、2 skipped、4 subtests passed`；通过 `PYTHONDONTWRITEBYTECODE=1` 避免重新生成字节码。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产操作；真实云 smoke 等待轮换后的新凭据。 |
| 结论 | Python 缓存清理、安全扫描和业务测试门禁取得本地证据；真实云调用、生产强化及暂缓的性能/故障验证仍不能标记完成。 |

## D71 Retention 与营养目录 Java 业务门禁复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；Java 21；未连接生产或现有业务数据库，未执行不可逆清理。 |
| 执行命令 | `mvnw.cmd --% -pl foodmate-application,foodmate-infra,foodmate-api -am test -Dtest=DataRetentionDeliveryServiceImplTest,DataRetentionResultMessageProcessorTest,DataRetentionTaskPublisherTest,DataRetentionDatabasePurgeAdapterTest,FlywayV27MigrationScriptTest,NutritionCommonV5SeedScriptTest,NutritionSeedScriptTest,AdminRetentionControllerTest -Dsurefire.failIfNoSpecifiedTests=false`。 |
| Java 结果 | Application `14/14`、Infrastructure `18/18`、API `4/4`，无失败。覆盖 retention 任务结果、对象/向量/数据库清理门禁、V27 脚本、营养 seed 和管理 API。 |
| 规范结果 | `-Palibaba-code-style -DskipTests verify` 通过；受影响模块 Spotless clean，Shared/Application/Infrastructure/API Checkstyle 均为 `0 violations`。 |
| 数据与暂缓边界 | 未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复或生产操作；用户已有未提交改动未纳入本次提交。 |
| 结论 | 当前 retention、营养 seed 与管理 API 的业务门禁和 Java 规范检查通过；真实硬删除、备份恢复及生产强化仍不能标记完成。 |

## D72 Python 缓存边界、双 PowerShell 扫描与 Java 注释复核（2026-08-29）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/business-db-idempotency`；未使用对话中暴露的旧云凭据。 |
| Python 业务门禁 | 在 `agent-runtime` 目录执行 `PYTHONDONTWRITEBYTECODE=1 .\\venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`154 passed、2 skipped、4 subtests passed`。 |
| Python 缓存 | 项目源码范围 `.pyc/.pyo=0`、`__pycache__=0`、`.pytest_cache=0`；`agent-runtime\\.venv` 内依赖缓存 `419` 个文件和 `62` 个目录保留，并由 `.gitignore` 忽略，未删除虚拟环境。 |
| 安全扫描 | `security-scan.ps1 -RunPythonAudit` 在 Windows PowerShell 5.1 与 PowerShell 7 均通过：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`。 |
| 代码规范 | 目标 Java 公共类/接口说明已统一为中文，提交 `d80d8f8d`；安全扫描器 Shell 兼容修复提交 `125c9c5c`；application/infra 定向业务测试合计 `67` 个通过。 |
| 数据与边界 | 未调用真实云服务、未执行迁移、truncate、数据库硬删除、备份恢复、性能压测、组件重启或生产操作；未清理虚拟环境依赖缓存。 |
| 结论 | 项目源码没有 Python 字节码残留；虚拟环境中的依赖缓存属于本地运行环境并保持隔离。安全扫描兼容两种 PowerShell，当前业务门禁通过；真实云与生产强化范围仍按既定边界执行。 |

## D73 隔离 PostgreSQL 硬删除与幂等重放复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；Testcontainers 临时 PostgreSQL `16-alpine`；未连接现有 `foodmate-postgres`，未使用云服务。 |
| 执行命令 | `mvnw.cmd --% -pl foodmate-infra -am -Ddocker.available=true -Dtest=DataRetentionDatabasePurgeRealIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false test` |
| 迁移结果 | 空库真实执行 baseline 与 migration 共 28 个版本，Flyway 校验和迁移均成功；测试容器在 JVM 结束后由 Testcontainers 回收。 |
| 删除结果 | 真实清理适配器按子表到父表顺序删除知识文档关联的结果 Inbox、索引/可见性 Outbox、批次事件、chunks、导入条目和文档，首次结果为 `backend=postgresql/deleted_count=7/verified_absent=true`。 |
| 保留与重放 | `data_purge_requests`、`data_purge_tasks` 和 `data_purge_task_results` 保留；同一文档再次执行返回 `deleted_count=0/verified_absent=true`，无重复副作用。 |
| Java 结果 | Infrastructure reactor `BUILD SUCCESS`；目标测试 `1/1` 通过，Failures/Errors/Skipped 均为 `0`。 |
| 数据边界 | 未对现有数据库执行硬删除、truncate、迁移、备份恢复或宽泛清理；该结果只证明隔离测试库中的受控清理实现。 |

## D74 Docker RAG 密钥命名空间轮换预检收口（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；未读取或使用聊天中公开的旧 API Key。 |
| 代码与提交 | 轮换预检同时校验 `FOODMATE_RAG_*` 与 Compose 宿主侧 `FOODMATE_DOCKER_RAG_*`；Chat 与 Embedding 凭据按命名空间隔离。提交 `f01ddfe3`。 |
| 执行命令 | `script\\security\\secret-rotation-check.tests.ps1`；`script\\security\\security-scan.ps1`。 |
| 结果 | PowerShell 契约测试通过；安全扫描 `tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`security_scan_status=passed`。 |
| 数据边界 | 未写入密钥、未调用真实云服务、未修改业务数据库；真实 SiliconFlow smoke 需使用供应商控制台轮换后的新密钥。 |

## D75 低基数指标与 Trace 统计口径复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；使用项目 `agent-runtime\\.venv\\Scripts\\python.exe`；未读取或使用聊天中公开的旧 API Key。 |
| 指标修复 | Java 队列深度统一使用 `transport/operation/result/reason` 固定标签，动态状态归入 `other`；定向测试 `AgentOperationMetricsTest` 为 `3/3`。提交 `084a96d0`。 |
| Trace 修复 | Trace 列表的 `span_count` 与详情一致，纳入 Runtime 事件、工具、模型、SSE、SQL 审计和操作审计事实；新增 Mapper 契约测试 `1/1`。提交 `245c03c9`。 |
| Java 规范 | Application 与 Infrastructure Spotless 检查通过；新增/修改 Java 类注释使用中文。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`163 passed、2 skipped、4 subtests passed`；未产生源码范围 `.pyc`。 |
| 安全门禁 | `script\\security\\security-scan.ps1`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`；`secret-rotation-check.tests.ps1` 通过。 |
| Python 缓存边界 | `.pyc` 共 `419` 个，全部位于 `agent-runtime\\.venv` 第三方依赖缓存，约 `5.64 MB`；源码范围为 `0`，Git 跟踪为 `0`，由 `.gitignore` 忽略。未删除虚拟环境。 |
| 未执行范围 | 未调用真实 SiliconFlow Chat/Embedding、未执行性能压测、组件重启、ACK/重复消息故障注入、备份恢复、生产监控部署或不可逆清理。真实云 smoke 需使用供应商控制台轮换后的新凭据。 |

## D76 本地营养目录 V5/V6 实际执行与校验（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；运行中的 `foodmate-postgres` 容器；数据库 `FoodMate`；PostgreSQL `16.14`；未调用云服务。 |
| 执行前置 | 备份 `FoodMate_before_nutrition_20260830_033607.dump`，大小 `1,341,380` bytes，SHA-256 `D4BB127B5E36227526CFD27EB71070CF62A1C230746260509702D1B21712D113`；备份位于 Git 忽略的 `script/sql/FoodMate/backups`。 |
| 执行命令 | `Get-Content seed/V5__nutrition_usda_common_foods_seed.sql | docker exec -i foodmate-postgres psql -v ON_ERROR_STOP=1 -U postgres -d FoodMate`；同样方式执行 `seed/V6__nutrition_mass_unit_seed.sql`；随后执行对应 `validation/V5__nutrition_usda_common_foods_validation.sql` 和 `validation/V6__nutrition_mass_unit_seed_validation.sql`。 |
| V5 结果 | 新增/更新 9 条常见食材和 9 条 USDA foodPortions 换算；`common_nutrition_seed_rows=9`、`common_unit_conversion_seed_rows=9`；非法行、食材关联错误均为 `0`。 |
| V6 结果 | 新增/更新 75 条 `kg/mg/lb -> g` 精确质量换算；`mass_unit_conversion_seed_rows=75`；非法行、食材关联错误、规则形状错误均为 `0`。数据库按 `numeric(12,4)` 保存磅系数为 `453.5924`。 |
| 代码验证 | `NutritionCommonV5SeedScriptTest` `4/4`、`NutritionSeedScriptTest` `9/9` 通过；受影响 Infrastructure Spotless 检查通过。提交 `c957a831` 包含 V5 长度契约，提交 `f3c2af41` 已补齐 V5/V6 的唯一索引冲突目标、磅系数精度校验和 validation 契约。 |
| 数据边界 | 未执行 `TRUNCATE`、宽泛删除、迁移、数据库硬删除、备份恢复、性能压测、组件重启或生产操作；seed 可重复执行且未覆盖既有业务数据。 |

## D77 本地 PostgreSQL 备份隔离恢复复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；运行中的 `foodmate-postgres` 容器；使用已有 `FoodMate_before_nutrition_20260830_033607.dump`；未连接生产环境。 |
| 执行方式 | 通过 Docker 容器内 `pg_restore` 将备份恢复到随机命名的本地临时数据库 `FoodMateRecovery0761c13cee38`；未覆盖源数据库。 |
| 恢复校验 | `pg_restore --exit-on-error --no-owner --no-privileges` 成功；只读 SQL 返回 `64` 张 public base table、`37` 个 `is_deleted` 列，数据库名与临时库一致。 |
| 清理校验 | 恢复库和容器内 `/tmp/foodmate-recovery.dump` 均在 `finally` 清理；恢复库不存在性校验为 `true`；源 `FoodMate` 数据未执行删除或覆盖。 |
| 结论 | 本地隔离备份恢复和清理流程取得实际证据；不等同于生产备份恢复、跨环境灾备、RPO/RTO 或发布回滚演练。 |

## D78 当前分支业务门禁与 Python 字节码边界复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；使用 `agent-runtime\\.venv`；Docker Server `28.5.1`。 |
| Python 业务门禁 | 在 `agent-runtime` 目录执行 `PYTHONDONTWRITEBYTECODE=1 .\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`163 passed、2 skipped、4 subtests passed`。 |
| Java 业务门禁 | `mvnw.cmd verify`：Shared `12`、Application `214`、Infrastructure `102`（20 skipped）、API `68`、Bootstrap `58`（37 skipped），无失败；Spotless 通过。 |
| 隔离清理验证 | `DataRetentionDatabasePurgeRealIntegrationTest` 在 Testcontainers PostgreSQL 空库中 `1/1` 通过；现有业务数据库未连接。 |
| 安全扫描 | `script\\security\\security-scan.ps1`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`。 |
| Python 缓存边界 | `.pyc` 共 `419` 个、约 `5.64 MB`，全部位于 `agent-runtime\\.venv` 第三方依赖缓存；源码范围 `0`，Git 跟踪 `0`。未删除虚拟环境。 |
| 云服务边界 | 未调用 SiliconFlow；对话中公开的旧凭据不再使用。真实 Chat 和两个 Embedding smoke 需在供应商控制台轮换后，通过当前 PowerShell 进程显式注入新凭据。 |
| 暂缓范围 | 未执行性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复、生产监控部署或现有数据库不可逆清理。 |
| 结论 | 当前本地业务、隔离清理、Java 构建规范和秘密扫描均有本轮证据；真实云联调和生产强化仍不能标记完成。 |

## D79 M1-6 业务入口与当前缓存边界复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Docker Server `28.5.1`。 |
| M1-6 入口 | `script\local\m1-6-traffic-recovery.tests.ps1`：`m1_6_traffic_contract=passed`；PowerShell 脚本解析通过。新增入口默认只做 readiness 预检，必须显式传入 `-ExecuteTraffic` 才会注册随机用户并执行 80% AgentRun、20% Proposal 业务路径。 |
| M1-6 预检 | `m1-6-traffic-recovery.ps1 -WarmupSeconds 1 -SteadySeconds 1 -Workers 1`：Java readiness、Actuator metrics、Python readiness 和 PostgreSQL outbox 查询均可用；本轮未发业务流量、未重启容器、未注入故障。 |
| Python 业务门禁 | 在 `agent-runtime` 目录执行 `PYTHONDONTWRITEBYTECODE=1 .\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`163 passed、2 skipped、4 subtests passed`。 |
| Java 业务门禁 | `mvnw.cmd -B -ntp verify`：Shared `12`、Application `214`、Infrastructure `102`（20 skipped）、API `68`、Bootstrap `58`（37 skipped），无失败；Spotless 通过。 |
| 安全门禁 | `security-scan.ps1`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`；`secret-rotation-check.tests.ps1` 通过。轮换脚本提示默认 Docker 环境未开启 JWT。 |
| Python 缓存 | 当前 `agent-runtime` 范围 `.pyc=1434`，其中源码目录 `29`、`.venv` `1405`；全部未被 Git 跟踪，`.gitignore` 已覆盖。递归删除命令被当前环境策略阻止，本轮未删除缓存；后续测试继续使用 `PYTHONDONTWRITEBYTECODE=1`。 |
| 云服务边界 | 未读取或使用对话中公开的旧 API Key，未调用 SiliconFlow Chat/Embedding；两个真实 Embedding profile 的 smoke 需在供应商控制台轮换后由当前 PowerShell 进程显式注入新密钥。 |
| 暂缓边界 | 未执行 30 秒预热/120 秒稳态长时流量、组件重启、ACK/重复消息故障注入、SSE 断线恢复或生产操作；该入口提交为 `2f3b649c`。 |
| 结论 | M1-6 本地业务入口、Python/Java 业务门禁和安全扫描有本轮证据；`.pyc` 仅为可再生缓存且当前未清理，真实云联调及性能/故障验证仍未完成。 |

## D80 Python 源码字节码清理与业务门禁复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；使用 `agent-runtime\.venv\Scripts\python.exe`。 |
| 缓存清理 | 删除 `agent-runtime` 源码、评估和测试目录中的 29 个 `.pyc` 及 3 个 `__pycache__` 目录；清理后项目源码范围 `*.pyc=0`、`__pycache__=0`。 |
| 虚拟环境边界 | `agent-runtime\.venv` 内 1405 个第三方 `.pyc` 保留，属于可复用依赖缓存；该路径已由 `.gitignore` 忽略，未纳入 Git。 |
| Python 业务门禁 | 设置 `PYTHONDONTWRITEBYTECODE=1` 后执行 `\.venv\Scripts\python.exe -m pytest -q`：`163 passed、2 skipped、4 subtests passed`。 |
| 工作树保护 | 未修改用户已有 UI/QA 文件；未执行迁移、truncate、宽泛删除、生产操作或真实云调用。 |
| 结论 | 项目源码无 Python 字节码残留；后续测试继续使用 `PYTHONDONTWRITEBYTECODE=1`，真实云 smoke 仍需供应商控制台轮换后的新凭据。 |

## D81 当前分支 Java、Python 与安全门禁复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Java 21；Python 使用 `agent-runtime\.venv`。 |
| Python 业务门禁 | 设置 `PYTHONDONTWRITEBYTECODE=1` 后执行 `\.venv\Scripts\python.exe -m pytest -q`：`163 passed、2 skipped、4 subtests passed`。 |
| Java 全量门禁 | 执行 `mvnw.cmd -B -ntp verify`：Shared `12/12`、Application `214/214`、Infrastructure `102`（20 skipped）、API `68/68`、Bootstrap `59`（37 skipped），最终 `BUILD SUCCESS`；Spotless 通过。 |
| 安全扫描 | 执行 `script\security\security-scan.ps1 -RunPythonAudit`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`。 |
| 外部服务边界 | 未读取或使用对话中公开的旧 API Key，未调用 SiliconFlow；真实 Chat 与两个 Embedding smoke 仍需控制台轮换后的新凭据。 |
| 工作树保护 | 未修改用户已有 UI/QA 改动；未执行迁移、truncate、生产部署、性能压测、故障注入或不可逆清理。 |
| 结论 | 当前业务代码、Java 规范和安全扫描门禁有新鲜证据；生产长稳、真实云联调及后置运维验证仍未完成。 |

## D82 Python 虚拟环境字节码缓存清理（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/runtime-observability`。 |
| 清理范围 | 仅处理明确的 `agent-runtime\\.venv` 缓存目录；没有删除虚拟环境、依赖包或项目源码。 |
| 清理结果 | 删除 1405 个第三方依赖 `.pyc` 文件和 253 个空 `__pycache__` 目录；仓库递归检查剩余 `.pyc=0`、`__pycache__=0`。 |
| Git 状态 | Git 跟踪的字节码路径为 `0`；清理未产生需提交的后端变更，用户已有前端 QA 文件未修改。 |
| 解释器校验 | `agent-runtime\\.venv\\Scripts\\python.exe -B --version` 返回 `Python 3.13.14`。 |
| 安全边界 | 未读取或使用对话中公开的旧 API Key，未调用 SiliconFlow，未执行迁移、删除业务数据、生产操作或故障测试。 |
| 结论 | `.pyc` 均为可再生缓存，当前已全部清理；后续 Python 测试继续设置 `PYTHONDONTWRITEBYTECODE=1`，真实云联调仍需轮换后的新凭据。 |

## D83 恢复 RAG Embedding 错误测试覆盖（2026-08-30）

| 项目 | 结果 |
|---|---|
| 发现 | `agent-runtime/tests/test_knowledge_rag.py` 存在两个同名测试类，后定义覆盖前定义，导致一组 Embedding 配置和错误处理测试未被 pytest 收集。 |
| 修复 | 重命名前一个测试类，并将其 HTTP fixture 改为支持上下文管理器的 `MagicMock`；未修改生产 Embedding 逻辑。提交 `8ec185c9`。 |
| 验证 | RAG 定向测试 `42 passed、4 subtests passed`；Python 全量业务测试 `168 passed、2 skipped、6 subtests passed`；测试设置 `PYTHONDONTWRITEBYTECODE=1`。 |
| 安全边界 | 未读取或使用对话中公开的旧 API Key，未调用 SiliconFlow，未修改业务数据库或 Docker 数据。 |
| 结论 | SiliconFlow-compatible Embedding 的错误映射、配置失败关闭和协议 fixture 已实际纳入本地测试收集；真实 endpoint、模型维度和账单仍需轮换后的凭据与外部调用证据。 |

## D84 真实云 smoke 证据出口与本地强化门禁复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Python 使用 `agent-runtime\\.venv`；Java 21；Docker Server `28.5.1`。 |
| Smoke 改动 | 提交 `3ce776a3`：真实 Chat/Embedding opt-in smoke 在成功时输出脱敏的 provider/model、场景、维度和延迟；PowerShell 入口使用 `-s`，不输出 API Key、请求正文或回答正文。 |
| 无凭据回归 | 在 `agent-runtime` 执行 `tests/test_real_cloud_integration.py` 与 `tests/test_real_embedding_integration.py`：`2 skipped`，未发起网络请求；模型/RAG 定向回归为 `61 passed、6 subtests passed`。 |
| M3 隔离验证 | `mvnw.cmd -B -ntp --% -pl foodmate-infra -am -Ddocker.available=true -Dtest=DataRetentionDatabasePurgeRealIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false test`；临时 PostgreSQL 执行 28 个迁移，目标测试 `1/1` 通过，未连接现有业务库。 |
| Java 规范 | `mvnw.cmd -B -ntp -Palibaba-code-style -DskipTests verify`；Spotless clean，Shared/Application/Infrastructure/API/Bootstrap Checkstyle 均为 `0 violations`。 |
| 安全扫描 | `script\\security\\security-scan.ps1 -RunPythonAudit -RunNpmAudit`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`。 |
| Python 缓存 | 当前源码范围 `.pyc=0`、`__pycache__=0`；`agent-runtime\\.venv` 内第三方缓存为 `419` 个 `.pyc`、`62` 个目录，Git 已忽略；本轮删除操作被执行环境策略拒绝，未删除 `.venv` 内容。 |
| 外部与暂缓边界 | 未读取或使用聊天中公开的旧 API Key，当前进程未配置轮换后的 Chat/Embedding 密钥，因此未调用 SiliconFlow；未执行性能压测、组件重启、ACK/重复消息故障注入、SSE 故障恢复、生产监控部署、生产发布回滚或现有数据库不可逆清理。 |
| 结论 | 云 smoke 已具备可审计的脱敏输出和安全入口；本地业务、隔离 M3、Java 规范及安全门禁有新鲜证据。真实云调用与生产强化仍需轮换凭据及对应外部环境证据，不能标记为完成。 |

## D85 本地业务门禁与 Python 缓存边界复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/runtime-observability`；Python 使用 `agent-runtime\\.venv`；Java 21。 |
| Python 业务门禁 | 在 `agent-runtime` 执行 `PYTHONDONTWRITEBYTECODE=1 .\\.venv\\Scripts\\python.exe -B -m pytest -q -p no:cacheprovider`：`168 passed、2 skipped、6 subtests passed`。 |
| Java 规范门禁 | `mvnw.cmd -B -ntp -Palibaba-code-style -DskipTests verify`：`BUILD SUCCESS`；Spotless 通过，Shared/Application/Infrastructure/API/Bootstrap Checkstyle 均为 `0 violations`。 |
| 安全门禁 | `script\\security\\security-scan.ps1 -RunPythonAudit`：`tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`、`skipped_checks=0`、`security_scan_status=passed`。 |
| Python 缓存 | 当前 `.pyc=419`、`__pycache__=62`，全部位于 `agent-runtime\\.venv` 第三方依赖；源码范围和 Git 跟踪均为 `0`。本轮删除操作受执行环境策略拒绝，未删除虚拟环境内容。 |
| 外部服务边界 | 未读取或使用对话中公开的旧 API Key，未调用 SiliconFlow；真实 Chat 和 `BAAI/bge-m3`/`Qwen/Qwen3-Embedding-0.6B` smoke 仍需供应商控制台轮换后的新凭据。 |
| 工作树与数据边界 | 未修改用户已有 UI/QA 改动；未执行迁移、truncate、业务数据删除、性能压测、组件重启、ACK/重复消息故障注入或生产操作。 |
| 结论 | 当前业务测试、Java 规范和安全扫描门禁保持通过；虚拟环境 `.pyc` 属于可再生依赖缓存，不进入 Git。真实云联调及生产强化仍不能标记完成。 |

## D86 SiliconFlow Embedding API 契约只读核验（2026-08-30）

| 项目 | 结果 |
|---|---|
| 文档来源 | `https://api-docs.siliconflow.cn/docs/api/embeddings-post`；只读请求返回 HTTP `200`。 |
| 契约核对 | 文档页面包含 `embeddings`、`model`、`input` 和 `encoding_format`；Runtime 发送 `POST /v1/embeddings`，请求体使用模型名、批量输入和 `encoding_format=float`，与现有本地契约测试一致。 |
| 模型配置 | 已支持 `BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B` 两个显式 profile；两者使用隔离的 Milvus collection 命名空间。 |
| 安全边界 | 未读取或使用对话中公开的旧 API Key，未发起 Embedding 请求，未产生付费调用；凭据只能由当前进程环境显式注入。 |
| 结论 | API 请求/响应适配具备本地契约证据；真实返回维度、供应商延迟和计费结果仍需轮换后的新凭据执行 opt-in smoke。 |

## D87 Docker Python Runtime 启动与云配置边界复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Docker Server `28.5.1`。 |
| Python 启动链路 | [docker/python.Dockerfile](../../../docker/python.Dockerfile) 的入口为 `python runtime_server.py`；Compose `agent-runtime` 容器内监听 `9000`，宿主映射 `9002`，容器健康状态为 `healthy`。 |
| 依赖检查 | 容器内 `pymilvus`、`pypdf`、RocketMQ 客户端可导入；`GET /foodmate/internal/health/live` 返回 HTTP `200` 和 `status=UP`。DOCX 解析使用受限 ZIP/XML 路径，不依赖执行宏或外部链接。 |
| Compose 配置 | `docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；当前展开配置为 `FOODMATE_RAG_MODE=local`、OpenAI-compatible、Qwen3 Embedding、Milvus 服务名 `milvus:19530`，Chat tier 为 `cloud_primary:deepseek-ai/DeepSeek-V4-Flash`。 |
| 配置修复 | `docker/.env.example` 改用 Compose 内部服务名 `http://milvus:19530`；Chat smoke 改为读取 `CLOUD_PRIMARY` 命名空间，并复制模型级价格配置。提交 `a876ebd1`、`5f628b59`。 |
| 业务测试 | Python Docker/云 smoke 契约测试分别为 `3 passed`、`2 passed, 1 skipped`；无凭据时真实云测试跳过，未发起 SiliconFlow 请求。 |
| 容器状态边界 | 当前运行容器创建于配置更新前，`docker inspect` 显示仍为旧 stub 环境；应用新 `.env` 必须显式执行 `up -d --force-recreate agent-runtime`。本轮未执行该重建，以避免使用对话中已公开的旧密钥。 |
| 结论 | Docker 可以负责启动 Python，启动链路和配置映射已有证据；真实 Chat/Embedding 调用与新配置容器联调待供应商控制台轮换后执行。 |

## D88 V29 Embedding Trace 与 Docker Python 启动文档复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 D:/develop/FoodMate；分支 codex/runtime-observability；Java 21；Python 使用 agent-runtime/.venv。 |
| V29 迁移契约 | 新增 knowledge_import_items.provider_trace_id 的 migration、validation、rollback 前置检查和 FlywayV29MigrationScriptTest；不执行 V29，不修改现有数据库。 |
| Java 验证 | 运行 KnowledgeIndexResultMessageProcessorTest、KnowledgeMapperContractTest、KnowledgeRepositoryAdapterTest、FlywayV29MigrationScriptTest：Application 5/5，Infrastructure 2+3+6/6，无失败。 |
| Python 验证 | agent-runtime/.venv/Scripts/python.exe -B -m pytest tests/test_knowledge_rag.py tests/test_knowledge_worker.py -q：65 passed、4 subtests passed；Docker 文档契约：5 passed。 |
| Docker 文档 | docker/README.md 已明确 agent-runtime 的 up -d --build、日志、readiness 和源码变更后的重建要求；提交 332a828d。 |
| 代码提交 | V29 trace 关联事实提交 c10186e5；Docker Python 启动文档提交 332a828d。 |
| 外部服务边界 | 未读取、回显或使用对话中公开的旧 API Key；未发起 SiliconFlow Chat/Embedding 请求，真实 smoke 仍需供应商控制台轮换后的新凭据。 |
| 结论 | Docker 可直接启动 Python Runtime，两个 SiliconFlow profile 的配置与本地协议测试已具备；真实云返回维度、延迟和账单事实尚未取得。 |

## D89 USDA 营养目录 V7 扩展实际执行（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；运行中的 `foodmate-postgres`；数据库 `FoodMate`；PostgreSQL `16.14`。 |
| 数据来源 | USDA FoodData Central SR Legacy（published 2019-04-01）CSV 数据包；营养值来自 `food_nutrient.csv`，份量来自 `food_portion.csv`；每行保留 FDC ID 和 portion 序号。 |
| 执行前检查 | V7 食材 ID `510026-510048` 和换算 ID `520026-520048` 均不存在；未执行 truncate、迁移或覆盖现有行。 |
| 执行命令 | `Get-Content seed/V7__nutrition_usda_directory_expansion_seed.sql -Raw | docker exec -i foodmate-postgres psql -v ON_ERROR_STOP=1 -X -U postgres -d FoodMate`。 |
| 执行结果 | 事务成功提交：新增 23 条 `nutrition_foods` 和 23 条 `nutrition_unit_conversions`；seed 使用主键冲突跳过，支持重复执行。 |
| Validation | `validation/V7__nutrition_usda_directory_expansion_validation.sql`：`expansion_nutrition_seed_rows=23`、`expansion_unit_conversion_seed_rows=23`、非法食材/换算/食材关联/规则形状错误均为 `0`。 |
| 代码测试 | `NutritionExpansionV7SeedScriptTest` `2/2` 通过；受影响模块 Maven 测试 `BUILD SUCCESS`。 |
| 总量 | 当前本地目录为 48 条 approved USDA 食材、48 条 approved foodPortions 规则和 75 条精确质量换算。 |
| 失败记录 | 首次执行因 V7 份量 `source_version` 超过数据库 `VARCHAR(64)` 约束回滚；随后缩短为 FDC ID + portion 序号并重新执行成功，未留下半成品。 |
| 代码提交 | 待本轮验证完成后以 `codex:` 前缀单独提交。 |

## D90 SiliconFlow 真实模型与 Docker Runtime 出站验证（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/runtime-observability`；宿主机使用现有本地 `.env`，密钥仅在当前进程内存中读取；未把密钥写入命令、脚本或记录。 |
| 真实 Embedding | 宿主机内存探针调用 SiliconFlow `POST /v1/embeddings`：`BAAI/bge-m3` HTTP `200`、1024 维、9 prompt tokens、348.38 ms；`Qwen/Qwen3-Embedding-0.6B` HTTP `200`、1024 维、5 prompt tokens、320.37 ms。未保存向量正文。 |
| 真实 Chat | 显式运行 `script\\local\\siliconflow-chat-smoke.ps1`，命中 `cloud_primary / deepseek-ai/DeepSeek-V4-Flash`；Composer `passed`、1032.6 ms，Eval `passed`、4482.38 ms，pytest `1 passed`。未保存回答正文或 provider key。 |
| Docker Runtime 启动 | `docker compose --env-file .env -f docker/compose.yml ps agent-runtime` 显示 `foodmate-agent-runtime` `healthy`；宿主机 `/foodmate/internal/health/live` 与 `/ready` 均 HTTP `200`；Compose config 校验通过。 |
| Docker 真实 Embedding | 显式执行 `script\\local\\siliconflow-docker-embedding-smoke.ps1 -Profile qwen3-embedding-0.6b -ExecuteRequest`；预检通过，但容器内请求失败为 `URLError`，根因是 TLS `UNEXPECTED_EOF_WHILE_READING`。容器 DNS 可解析目标；TLS 1.2、TLS 1.3 及 Docker `host` 网络均复现，未进入 HTTP 鉴权层。 |
| 网络对照 | 宿主机 `curl -k` 对同一 endpoint 无 Authorization 请求返回 HTTP `401`，证明宿主机可达；本机注册的 `127.0.0.1:7897` 代理端口当前未监听。未通过关闭 Python TLS 校验来绕过问题。 |
| Python 业务门禁 | `agent-runtime\\.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`：`177 passed、2 skipped、6 subtests passed`；Docker/云契约测试 `9 passed`。 |
| Java 业务与规范门禁 | `mvnw.cmd clean verify`：最终 `BUILD SUCCESS`；显式 `-P alibaba-code-style -DskipTests verify`：Shared/Application/Infrastructure/API/Bootstrap 均 `0 Checkstyle violations`，Spotless 通过。 |
| 安全门禁 | `security-scan.ps1` 与 `secret-rotation-check.ps1` 均报告 tracked secret `0`、tracked env `0`，但本地忽略 `.env` 的工作树密钥命中为 `1`；该结果按失败处理，等待密钥轮换后复验。 |
| 数据与提交边界 | 未执行迁移、truncate、现有业务数据删除、备份恢复、组件重启、ACK/重复消息故障注入或生产操作；本轮只更新执行记录，未新增代码提交。 |
| 结论 | 两个真实 Embedding 模型和 DeepSeek Chat 的供应商契约在宿主机已验证；Docker Python 启动链路已验证，容器内真实云调用仍受本机 Docker 出站 TLS 限制，不能标记为完成。 |

## D91 SiliconFlow 宿主机真实云 smoke 与 Docker 出站复核（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Python 使用 `agent-runtime\.venv`；密钥只从本地忽略 `.env` 读取到当前进程，未输出或持久化。 |
| Embedding 真实调用 | 宿主机 `siliconflow-embedding-smoke.ps1 -Profile all`：`BAAI/bge-m3` HTTP 200、1024 维、约 367.76 ms；`Qwen/Qwen3-Embedding-0.6B` HTTP 200、1024 维、约 548.02 ms。未保存向量正文。 |
| Chat 真实调用 | 宿主机 `siliconflow-chat-smoke.ps1`：`cloud_primary/deepseek-ai/DeepSeek-V4-Flash` Composer 通过、约 714.85 ms；Eval 通过、约 13,776.29 ms；两次均有 provider request ID。第一次连续 Eval 请求超时，独立中文请求及完整 smoke 重跑通过。 |
| Docker Python | `agent-runtime` 保持 `healthy`；live/ready HTTP 200；Compose 配置校验通过。Docker smoke 的 PowerShell 引号、UTF-8/行尾和参数位次问题已修复，提交 `8c1dbde5`、`f9c3dfbe`；契约测试 `7 passed`。 |
| Docker 真实调用 | Qwen Docker smoke 预检通过，实际请求在 TLS 握手阶段失败为 `URLError/SSL_UNEXPECTED_EOF_WHILE_READING`；DNS 可用，未进入 HTTP 鉴权层。未关闭 TLS 校验，也未把密钥写入命令或日志。 |
| 网络对照 | 宿主机真实调用成功；本机代理候选端口 `7897/7890/1080` 无监听，Docker `host` 网络此前同样复现 TLS EOF。需配置 Docker 可访问的 HTTPS 代理或修复 Docker Desktop 出站网络后重跑 Docker smoke。 |
| 业务测试 | `agent-runtime\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider`：此前基线 `177 passed、2 skipped、6 subtests passed`；本轮新增云 smoke 契约 `7 passed`。 |
| 结论 | 宿主机两个真实 Embedding profile 和 DeepSeek Chat 已取得真实协议证据；Docker Python 启动及配置映射已取得证据，但 Docker 云调用、长稳/性能、故障矩阵和生产强化仍未完成，不能更新为完成状态。 |

## D92 SiliconFlow 两个 Embedding Profile 宿主机复验（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；Python 使用 `agent-runtime\.venv`；真实凭据仅从本地忽略 `.env` 临时映射到当前进程，未输出、写入脚本或提交 Git。 |
| 执行命令 | `script\local\siliconflow-embedding-smoke.ps1 -Profile all`；脚本显式覆盖两个已支持 profile。 |
| `BAAI/bge-m3` | `passed`；返回向量维度 `1024`；本轮延迟 `363.72 ms`。 |
| `Qwen/Qwen3-Embedding-0.6B` | `passed`；返回向量维度 `1024`；本轮延迟 `205.8 ms`。 |
| Python 测试 | 真实 Embedding 集成测试 `1 passed`；未保存向量正文。 |
| 结论 | SiliconFlow `/v1/embeddings` 的两个 profile 在宿主机可用；Docker Runtime 内真实请求仍受既有 Docker 出站 TLS EOF 阻塞，需单独修复网络后复验。 |

## D93 M3 隔离 PostgreSQL 硬删除真实业务验证（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Testcontainers `postgres:16-alpine` 隔离容器；未连接当前 `foodmate-postgres`，未修改现有本地业务数据。 |
| 执行命令 | `mvnw.cmd -B -ntp -pl foodmate-infra -am test -Ddocker.available=true -Dtest=DataRetentionDatabasePurgeRealIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false`。 |
| Schema | Flyway 在临时数据库中成功应用 V1-V29；测试 fixture 使用随机 ID/邮箱和随机后缀。 |
| 首次清理 | PostgreSQL 真实删除知识文档及其 chunks、导入条目/批次、索引 Outbox/Inbox、SSE 事件和可见性 Outbox；结果 `postgresql`、`verified_absent=true`。 |
| 幂等复放 | 同一文档再次执行清理返回 `deleted_count=0` 且 `verified_absent=true`；无重复删除异常。 |
| 测试结果 | `DataRetentionDatabasePurgeRealIntegrationTest` `1/1` 通过，Maven `BUILD SUCCESS`。 |
| 边界 | 本轮未在现有业务库执行迁移、硬删除、备份恢复、truncate 或组件故障注入；生产清理仍受策略、应用开关和备份校验三重门禁。 |

## D94 Docker PostgreSQL 备份与隔离恢复验证（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | 当前本地 `foodmate-postgres` 容器；PostgreSQL `16.14`；源库 `FoodMate`。宿主机未安装 PostgreSQL 客户端，因此使用脚本的 `-DockerContainer` 路径。 |
| 执行命令 | `backup-restore.ps1 -DatabaseName FoodMate -Username postgres -DockerContainer foodmate-postgres -BackupFile codex_local_foodmate_20260830.dump -RestoreDatabaseName FoodMateCodexRestore20260830 -Execute -RunValidation -DropRestoreDatabaseAfterValidation`。 |
| 备份结果 | 自定义格式备份创建成功，文件大小 `1,344,249` bytes；SHA-256 已在本地命令输出中取得，未写入源码或密钥相关日志。 |
| 恢复结果 | 新恢复库创建成功，`validation.sql` 通过；验证后恢复库已按显式开关删除。 |
| 源库保护 | 恢复库删除后确认 `FoodMateCodexRestore20260830` 不存在；源库只读计数复核为 `users=627`、`knowledge_documents=35`、`food_logs=235`。 |
| 文件边界 | 备份文件保留在 `script/sql/FoodMate/backups/`，被 `.gitignore` 排除，不进入 Git；不得将其上传到仓库或公共位置。 |

## D95 M1-6 队列事实语义与 Docker Embedding Profile 预检（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\develop\FoodMate`；分支 `codex/runtime-observability`；Docker Compose `foodmate` 与 `agent-runtime` 保持运行；未读取或输出任何凭据。 |
| 业务基线 | 项目 `.venv` Python pytest：`180 passed、2 skipped、6 subtests passed`；`mvnw.cmd -B -ntp verify`：`BUILD SUCCESS`。 |
| M1-6 预检 | `m1-6-traffic-recovery.ps1 -WarmupSeconds 1 -SteadySeconds 1` readiness 通过：Java、Python 均 HTTP 200；未启动流量、未执行重启或故障注入。 |
| 队列快照 | `pending=10`（仅可排空项）；`delivery_pending=0`；`proposal_inbox_pending=1`；`runtime_inbox_pending=9`；`sse_replay_retained=1546`。SSE 回放保留事实不再计入积压或排空判断。 |
| Docker profile 预检 | 当前 Qwen profile 预检通过；请求 BGE 时因容器仍为 Qwen 被明确拒绝，避免模型/集合错配。契约测试通过。 |
| 代码提交 | `2eb1c6e1` 修正 M1-6 队列排空语义；`aaab2480` 增加 Docker Embedding profile 安全回读与 PowerShell 参数回归。 |
| 暂缓范围 | 按当前业务门禁决策，未执行 16 worker 长压、吞吐/延迟容量测试、组件重启、ACK 丢失、重复投递或 SSE 故障矩阵；Docker 真实云请求仍受既有出站 TLS 环境阻塞。 |

## D96 SiliconFlow 双 Embedding 宿主机复验与 Docker 出站诊断（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/runtime-observability`；Python 使用 `agent-runtime\\.venv`；密钥只从本地忽略 `.env` 读取，未输出、写入脚本或提交 Git。 |
| 宿主机真实 Embedding | `siliconflow-embedding-smoke.ps1 -Profile all`：`BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B` 均 `HTTP 200`、`1024` 维；本轮延迟分别约 `414.08 ms`、`190.61 ms`。向量正文未保存。 |
| Docker 配置 | Compose 展开和 Runtime 回读均确认 `local + openai-compatible`、当前 profile 为 `qwen3-embedding-0.6b`、模型为 `Qwen/Qwen3-Embedding-0.6B`、Milvus 使用 Compose 服务名；Runtime live/ready 为 HTTP `200`。 |
| Docker 真实请求 | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest` 预检通过，实际请求失败于 TLS 握手 `SSL_UNEXPECTED_EOF_WHILE_READING`，未进入 HTTP 鉴权层；BGE profile 在当前 Qwen 容器中被配置门禁拒绝，防止 collection/model 错配。 |
| 网络诊断 | 容器 DNS 与 `443` TCP 可达；TLS 1.2、TLS 1.3 和直连均复现 EOF。Docker Desktop 声明的 `http.docker.internal:3128` 代理继续转发到宿主 `127.0.0.1:7897`，该本机端口当前未监听。未关闭证书校验、未硬编码 IP、未把 Chat 与 Embedding 密钥混用。 |
| 配置修复 | `agent-runtime` 新增可选 `HTTP_PROXY`、`HTTPS_PROXY` 和隔离内部服务的 `NO_PROXY` Compose 映射；默认均为空，不改变 stub/deterministic 行为。提交 `77f2cdee`。 |
| 业务验证 | Python 全量 `183 passed、2 skipped、6 subtests passed`；Docker Compose 契约 `6 passed`；Compose config 校验通过；Java `-P alibaba-code-style -DskipTests verify` 为 `BUILD SUCCESS`，各模块 `0 Checkstyle violations`，Spotless 通过。 |
| 安全门禁 | tracked secret `0`、tracked env `0`；working-tree secret 命中 `1`，来源为本地忽略 `.env` 中的真实凭据，按失败处理。必须在 SiliconFlow 控制台轮换曾在对话中暴露的密钥后复验。 |
| 结论 | 两个 Embedding profile 的宿主机协议调用已取得证据；Docker Python 启动、配置映射和 fail-closed 行为已验证，容器真实云请求仍等待可用 Docker 出站代理或网络环境修复，不能标记为 Docker 云联调完成。 |

## D97 SiliconFlow 双 Embedding 真实协议复验（2026-08-30）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Python 使用 `agent-runtime\\.venv`；密钥仅从本地忽略 `.env` 映射到当前进程，未输出、写入脚本或提交 Git。 |
| 执行命令 | `script\\local\\siliconflow-embedding-smoke.ps1 -Profile all`；请求体仅包含固定 smoke 文本，不保存向量正文。 |
| `BAAI/bge-m3` | `passed`；SiliconFlow `/v1/embeddings` 返回 HTTP `200`，向量维度 `1024`，本轮延迟约 `397.09 ms`。 |
| `Qwen/Qwen3-Embedding-0.6B` | `passed`；SiliconFlow `/v1/embeddings` 返回 HTTP `200`，向量维度 `1024`，本轮延迟约 `219.72 ms`。 |
| 配置隔离 | 两个 profile 均由显式模型校验；实际运行仍一次选择一个 profile，并使用独立 Milvus collection，禁止混写。 |
| 结论 | 宿主机真实 Embedding 服务和两个模型适配均已取得新鲜业务证据；Docker 容器内真实请求仍受出站 TLS 环境阻塞，不能以宿主机结果代替 Docker 云联调证据。 |

## D98 Docker Runtime 双 Embedding 真实协议复验（2026-08-31）

| 项目 | 结果 |
|---|---|
| 执行环境 | Docker Compose `foodmate`/`agent-runtime`/Milvus；凭据仅由本地忽略 `.env` 注入容器，未输出、写入脚本或提交 Git。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：请求通过，模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，延迟约 `411.64 ms`，返回 `prompt_tokens=5`。 |
| BGE profile | 临时使用独立 collection `foodmate_knowledge_chunks_bge_m3` 重建 Runtime 后执行 `-EmbeddingProfile bge-m3 -ExecuteRequest`：请求通过，模型 `BAAI/bge-m3`，向量维度 `1024`，延迟约 `302.4 ms`，返回 `prompt_tokens=9`。 |
| 配置恢复 | BGE 验证后已按 `.env` 恢复 Qwen profile；Runtime readiness 为 `healthy`，Milvus readiness 为 `healthy`。 |
| 安全边界 | 未关闭 TLS 校验；没有在命令、日志或仓库中输出密钥；两个模型使用互斥 profile 和独立 collection，禁止混写。 |
| 结论 | Docker 容器内两个 SiliconFlow Embedding profile 均已取得真实协议证据；这不等同于 M1-6 性能/故障矩阵或生产稳定性完成。 |

## D99 Docker Runtime SiliconFlow Chat 与双 Embedding 复验（2026-08-31）

| 项目 | 结果 |
|---|---|
| 执行环境 | Docker Compose `foodmate`/`agent-runtime`/Milvus；凭据仅由本地忽略 `.env` 注入，未输出、写入脚本或提交 Git。 |
| Chat | `siliconflow-docker-chat-smoke.ps1 -Tier standard -ExecuteRequest`：`cloud_primary/deepseek-ai/DeepSeek-V4-Flash` 返回有效回答，`total_tokens=23`，延迟约 `4968.76 ms`。 |
| Qwen Embedding | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：`Qwen/Qwen3-Embedding-0.6B` 返回 `1024` 维，`prompt_tokens=5`，延迟约 `4409.28 ms`。 |
| BGE Embedding | 一次性 Docker Runtime 容器覆盖为 `bge-m3` 后调用 `/embeddings`：`BAAI/bge-m3` 返回 `1024` 维，`prompt_tokens=14`，延迟约 `9058.94 ms`；未改写持久 `.env`。 |
| 配置隔离 | 两个 Embedding profile 仍一次只启用一个，并使用独立 Milvus collection；Chat 与 Embedding 使用不同配置入口。 |
| 安全边界 | 未关闭 TLS 校验；请求正文仅为固定 smoke 文本；未保存向量、回答正文、API Key 或供应商原始响应。 |
| 结论 | Docker Python Runtime 可通过 Compose 调用 SiliconFlow Chat 和两个真实 Embedding 模型；本证据仅证明协议/配置/单次业务调用，不代表长稳、容量、成本对账或生产门禁完成。 |

## D100 Docker Python Runtime 双 Embedding 当前凭据复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`/`agent-runtime`/Milvus；凭据仅从本地忽略 `.env` 注入，未输出或写入仓库。 |
| Python 启动 | `docker compose --env-file .env -f docker/compose.yml ps agent-runtime`：容器由 `python runtime_server.py` 启动，状态 `healthy`，宿主端口 `9002 -> 9000`。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：HTTP 请求通过，模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `1693.95 ms`。 |
| BGE profile | 临时以 Compose 进程变量覆盖 profile 和独立 collection 后执行 `-EmbeddingProfile bge-m3 -ExecuteRequest`：HTTP 请求通过，模型 `BAAI/bge-m3`，向量维度 `1024`，`prompt_tokens=9`，延迟 `1268.72 ms`。 |
| 配置恢复 | BGE 验证后恢复 `.env` 原 Qwen profile 和 collection；`GET /foodmate/internal/health/ready` 返回 `200`，RAG 为 `local/openai-compatible`。 |
| 安全边界 | 未在命令、日志、执行记录或 Git 中写入 API Key；未关闭 TLS 校验；两个模型使用互斥 profile 和独立 Milvus collection。 |
| 结论 | Docker 可直接启动 Python，并已验证 SiliconFlow 两个 Embedding profile 的真实协议调用；该证据不替代生产长稳、性能、故障矩阵和账单审计。 |

## D101 M3 硬删除隔离验证与本地备份恢复演练（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；硬删除使用 Testcontainers `postgres:16-alpine` 隔离数据库；备份恢复使用当前本地 `foodmate-postgres`，源库数据未删除。 |
| 硬删除验证 | `mvnw.cmd -B -ntp -pl foodmate-infra -am test '-Ddocker.available=true' '-Dtest=DataRetentionDatabasePurgeRealIntegrationTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：Flyway V1-V29 应用成功，知识文档及关联索引/事件事实按依赖顺序清理，重复清理幂等，测试 `1/1` 通过。 |
| 备份恢复验证 | `backup-restore.ps1 -DatabaseName FoodMate -Username postgres -DockerContainer foodmate-postgres -BackupFile codex_local_foodmate_20260901.dump -RestoreDatabaseName FoodMateCodexRestore20260901 -Execute -RunValidation -DropRestoreDatabaseAfterValidation`：备份 `5127414` bytes，SHA-256 `6fe4e944be9e99dcf98d9dcf809b5c067631b3cf6dbce41b6338dc6d05fcedff`，恢复库 validation 通过并已删除。 |
| 数据边界 | 未执行迁移改写、truncate、生产库操作或现有业务数据硬删除；备份文件保留在 Git 忽略目录，源库仍由 Docker 卷保留。 |
| 结论 | M3 的隔离硬删除和本地备份恢复已有直接执行证据；这不等同于生产灾备、生产删除授权或发布回滚完成。 |

## D102 Docker Runtime SiliconFlow 双 Embedding profile 复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；凭据仅由本地忽略 `.env` 注入，未输出或写入仓库。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `1185.97 ms`，请求通过。 |
| BGE profile | 临时切换到独立 collection `foodmate_knowledge_chunks_bge_m3` 后执行 `-EmbeddingProfile bge-m3 -ExecuteRequest`：模型 `BAAI/bge-m3`，向量维度 `1024`，`prompt_tokens=9`，延迟 `1218.7 ms`，请求通过。 |
| 配置恢复 | BGE 验证后恢复 Qwen profile、模型和 collection；`foodmate-agent-runtime` 为 `healthy`，`/foodmate/internal/health/ready` 返回 HTTP `200`，RAG 为 `local/openai-compatible`。 |
| 隔离与费用边界 | 两次请求均使用固定 smoke 文本；未保存向量正文、API Key 或供应商原始响应；两个 profile 使用独立 collection，禁止混写。 |
| 结论 | Docker 可启动 Python Runtime，并已取得 SiliconFlow `BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B` 的新鲜真实协议证据；该结果不替代长稳性能、故障矩阵、成本对账或生产门禁。 |

## D103 M1-6 deterministic Agent/Proposal 业务流量与审计复核（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Docker Compose `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO、Milvus；流量期间临时将 Docker Chat tiers 设为 `deterministic:local`，结束后恢复 `.env` 的 SiliconFlow DeepSeek 路由。 |
| 正式档位 | `m1-6-traffic-recovery.ps1 -ExecuteTraffic`：预热 `30s`、稳态 `120s`、`16` workers、AgentRun/Proposal 目标比例 `80/20`。 |
| 业务结果 | 总操作 `117`；AgentRun `97`；Proposal `18`；成功 `94`；业务拒绝 `4`；业务失败 `14`；意外错误 `2`；意外错误率 `1.709%`；未发现 worker 错误。 |
| 时延与吞吐 | 吞吐 `0.975 ops/s`；P50/P95/P99 为 `15722.982/30767.0658/36037.16848 ms`。该数据是本机 deterministic 业务基线，不是容量或生产 SLO。 |
| 重复与队列 | 重复投递 `7`；重复副作用 `0`；队列峰值相对基线增加 `1`；结束时可排空队列回到基线，排空等待约 `267.616 ms`。SSE replay 保留事实单独统计，不计入积压。 |
| 审计取数修复 | 修复 Windows Docker 调用中 `psql -v` 变量未展开导致审计快照为空的问题；随机测试用户名经过固定格式校验后再进入查询。短复核 `1 worker/1+1s`：操作 `2`，审计由 `1` 增至 `15`，success `15`，failed/rejected/pending 均为 `0`。 |
| 数据边界 | 测试账号、会话和业务数据均使用随机命名空间，脚本 finally 软删除测试账号；未执行 truncate、数据库硬删除或性能故障注入。 |
| 结论 | M1-6 本地业务流量入口和审计统计已取得可复核基线；意外错误率和较高时延需作为本机诊断结果保留，不宣称达到生产性能门禁。 |

## D104 M3 本地 Docker PostgreSQL 备份恢复复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；源库为本地 Docker `foodmate-postgres`，恢复目标为本轮唯一隔离库。 |
| 执行命令 | `backup-restore.ps1 -DatabaseName FoodMate -Username postgres -DockerContainer foodmate-postgres -BackupFile codex_local_foodmate_20260901_m3.dump -RestoreDatabaseName codex_restore_20260901_m3 -Execute -RunValidation -DropRestoreDatabaseAfterValidation` |
| 备份事实 | 文件大小 `5541357` bytes；SHA-256 `855b49c761cd508c789cdef21441d7b28140cd2aa5287cd13ad619f3e4895176`。 |
| 恢复校验 | 隔离恢复库执行 `validation.sql` 为 `passed`；验证结束后恢复库清理为 `passed`。 |
| 数据边界 | 未覆盖源库、未执行 truncate、迁移回写或源库硬删除；备份文件保留在 Git 忽略目录供本地追溯。 |
| 结论 | 本地 Docker 备份、隔离恢复和 schema/约束校验已取得新鲜执行证据；不将其等同于生产灾备或跨环境恢复演练。 |

## D105 Docker Runtime SiliconFlow 双 Embedding 当前凭据复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；凭据仅由本地忽略 `.env` 注入，未输出或写入仓库。 |
| BGE profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile bge-m3 -ExecuteRequest`：模型 `BAAI/bge-m3`，向量维度 `1024`，`prompt_tokens=9`，延迟 `1894.89 ms`，请求通过。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `3502.4 ms`，请求通过。 |
| 配置与启动 | 两次验证均使用独立 Milvus collection；切换期间一次性 RocketMQ 初始化最终正常退出，`foodmate-agent-runtime` 恢复为 `healthy`，宿主端口 `9002 -> 9000`。验证后 `.env` 恢复为 Qwen profile。 |
| 安全边界 | 未输出 API Key、向量正文或供应商原始响应；未关闭 TLS 校验；未执行迁移、truncate、现有业务数据删除或生产操作。 |
| 结论 | Docker 可启动 Python Runtime，并已取得两个指定 SiliconFlow Embedding 模型的真实协议证据；该证据不替代长稳性能、成本对账、故障矩阵或生产门禁。 |

## D106 Docker Runtime SiliconFlow 双 Embedding 当前轮次复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；密钥仅由本地忽略 `.env` 注入，未输出或写入仓库。 |
| BGE profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile bge-m3 -ExecuteRequest`：模型 `BAAI/bge-m3`，向量维度 `1024`，`prompt_tokens=9`，延迟 `2243.95 ms`，请求通过。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `880.63 ms`，请求通过。 |
| 配置恢复 | BGE 验证后恢复 Qwen profile、模型和 `foodmate_knowledge_chunks_qwen3_embedding_0_6b` collection；Runtime readiness 为 `healthy`。 |
| 安全边界 | 未输出 API Key、向量正文或供应商原始响应；未关闭 TLS 校验；两个 profile 使用独立 collection，禁止混写。 |
| 结论 | Docker Python Runtime 的两个指定 SiliconFlow Embedding profile 均取得本轮真实协议证据；该证据不替代长稳性能、成本对账、故障矩阵或生产门禁。 |

## D107 Docker Runtime SiliconFlow DeepSeek Chat 当前轮次复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate` 与 `agent-runtime`；密钥仅由本地忽略 `.env` 注入，未输出或写入仓库。 |
| 路由 | `siliconflow-docker-chat-smoke.ps1 -Tier standard -ExecuteRequest`：`cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，预检通过。 |
| 真实调用 | 返回有效响应摘要，`total_tokens=23`，延迟 `5961.05 ms`，请求通过；未保存回答正文或供应商原始响应。 |
| 结论 | Docker Python Runtime 的真实 Chat 配置已生效；该证据不替代长稳、容量、价格账单对账或生产可用性结论。 |

## D108 Docker Runtime SiliconFlow 双 Embedding 当前轮次复验（2026-09-01）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；凭据仅从本地忽略 `.env` 注入，未输出或写入仓库。 |
| Python 启动 | `docker compose --env-file .env -f docker/compose.yml ps agent-runtime`：容器以 `python runtime_server.py` 启动，状态 `healthy`，宿主端口 `9002 -> 9000`。 |
| BGE profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile bge-m3 -ExecuteRequest`：模型 `BAAI/bge-m3`，向量维度 `1024`，`prompt_tokens=9`，延迟 `6069.13 ms`，请求通过。 |
| Qwen profile | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：模型 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `10921.07 ms`，请求通过。 |
| 配置恢复 | BGE 验证完成后恢复 Qwen profile、模型和 `foodmate_knowledge_chunks_qwen3_embedding_0_6b` collection；Runtime readiness 恢复为 `healthy`。 |
| 安全边界 | 未输出 API Key、向量正文或供应商原始响应；未关闭 TLS 校验；两个 profile 使用独立 collection，禁止混写。 |
| 结论 | Docker Python Runtime 可直接调用 SiliconFlow 的两个指定 Embedding 模型；本结果是单次协议/配置业务证据，不代表长稳、容量、成本对账、故障矩阵或生产门禁完成。 |

## D109 Docker Python 启动与安全配置预检（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；现有 Docker Compose 应用容器保持运行；未修改数据库、Redis、RocketMQ、MinIO 或 Milvus 数据。 |
| Python 启动 | `docker inspect foodmate-agent-runtime` 确认入口为 `python runtime_server.py`，工作目录为 `/app`；容器内 Python `3.12.14`，宿主机端口映射为 `9002 -> 9000`。 |
| 运行状态 | `GET http://127.0.0.1:9002/foodmate/internal/health/live` 返回 `200`；`GET http://127.0.0.1:9002/foodmate/internal/health/ready` 返回 `200`，Runtime、Redis、RocketMQ 协调状态为 ready。 |
| 安全扫描 | `script\\security\\security-scan.ps1`：tracked secret `0`、working-tree secret `0`、tracked env `0`，扫描通过；本地忽略 `.env` 仅计数，不输出密钥内容。 |
| 轮换预检 | `script\\security\\secret-rotation-check.ps1`：预检通过；RAG/Chat 凭据分离检查通过。当前本地 `RUNTIME_SERVICE_JWT_ENABLED` 未开启，JWT 重叠轮换检查按脚本规则跳过，不宣称已完成供应商控制台或 JWT 轮换。 |
| 配置边界 | Docker 使用 `FOODMATE_DOCKER_*` 输入映射到容器内 `FOODMATE_*`；真实 API Key 未写入 Git、执行记录、日志或命令参数。修改代码需 `--build`，修改环境变量需 `--force-recreate`。 |
| 结论 | Docker 可直接负责启动 Python Runtime，当前实例健康；本轮仅完成启动、readiness 和本地安全预检，不替代生产密钥轮换、生产监控、性能容量或故障恢复证据。 |

## D110 营养目录与单位换算只读核验（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行环境 | 本地 Docker PostgreSQL `foodmate-postgres` / `FoodMate`；仅执行只读 SQL，未修改业务数据。 |
| 营养目录 | `nutrition_foods` 未删除记录 `48` 条，其中 `approved=48`；当前 V1/V4/V5/V7 USDA 增量均已进入本地目录。 |
| 单位换算 | `nutrition_unit_conversions` 未删除记录 `123` 条，其中 `approved=123`；包含食材级 USDA `foodPortions` 规则和 V6 精确质量单位规则。 |
| 约束 | 未覆盖的食材、家庭单位和密度换算继续返回 `pending`；不使用模型推断营养值或单位密度。 |
| 结论 | 当前本地功能范围的营养目录扩展和单位换算数据已具备数据库事实与 validation 依据；更广泛目录仍可在未来按新的官方来源增量评审，不作为本轮未验证数据补录。 |

## D111 安全配置预检支持显式环境文件（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行命令 | `script\\security\\secret-rotation-check.tests.ps1`；`script\\security\\secret-rotation-check.ps1 -EnvFile .env`；`script\\security\\security-scan.tests.ps1`。 |
| 回归测试 | `secret_rotation_check_tests=passed`；覆盖环境文件加载、进程环境优先和敏感值不出现在输出中。 |
| 实际配置 | `.env` 预检输出 `docker_rag_mode=local`、`docker_rag_embedding_key_configured=true`、`environment_file_loaded=true`；服务 JWT 当前关闭并按规则提示跳过轮换检查。 |
| 安全结果 | `tracked_secret_scan_hits=0`、`working_tree_secret_scan_hits=0`、`tracked_env_files=0`；脚本仅输出状态/计数，不输出 API Key。 |
| 兼容性 | 解析器兼容现有 Compose `.env` 中带点号的模型价格变量；只导入脚本检查的配置名，不把其他环境变量注入当前进程。 |
| 结论 | Docker 实际配置现在可以通过显式 `-EnvFile .env` 进行脱敏预检；这仍不等同于供应商控制台密钥轮换或生产 JWT 重叠轮换已完成。 |

## D112 Docker Runtime SiliconFlow 双 Embedding 本轮真实复验（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；API Key 仅从本地忽略 `.env` 注入，未输出或写入仓库。 |
| BGE profile | `switch-rag-embedding-profile.ps1 -Profile bge-m3 -Apply -Recreate` 后执行 `siliconflow-docker-embedding-smoke.ps1 -Profile bge-m3 -ExecuteRequest`：`BAAI/bge-m3` 返回 `1024` 维，`prompt_tokens=9`，延迟约 `1870.06 ms`，请求通过。 |
| Qwen profile | 恢复 `qwen3-embedding-0.6b` 后执行 `siliconflow-docker-embedding-smoke.ps1 -Profile qwen3-embedding-0.6b -ExecuteRequest`：`Qwen/Qwen3-Embedding-0.6B` 返回 `1024` 维，`prompt_tokens=5`，延迟约 `1167.1 ms`，请求通过。 |
| 配置恢复 | BGE 验证完成后恢复 Qwen profile、模型和 `foodmate_knowledge_chunks_qwen3_embedding_0_6b` collection；`foodmate-agent-runtime` readiness 为 `healthy`，宿主端口为 `9002 -> 9000`。 |
| 安全边界 | 未输出 API Key、向量正文或供应商原始响应；未关闭 TLS 校验；两个 profile 使用独立 collection，禁止混写。 |
| 结论 | Docker Python Runtime 可以在 `local` 模式下调用两个指定 SiliconFlow Embedding 模型，并可通过 profile 脚本切换；本证据不替代性能容量、成本对账、故障矩阵或生产门禁。 |

## D113 USDA 营养目录 V8 增量与本地 PostgreSQL 验证（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；本地 Docker PostgreSQL 容器 `foodmate-postgres`，数据库 `FoodMate`；没有执行 truncate、宽泛删除或历史迁移修改。 |
| 数据来源 | USDA FoodData Central SR Legacy 2019-04-01；新增 FDC `169330`、`169473`、`170000`、`170026`、`170845`、`170894`、`171688`、`172388`、`172420`、`172449`、`173734`、`175168`，保留 FDC 与 portion 序号。 |
| 执行命令 | `docker exec foodmate-postgres psql --no-psqlrc --set ON_ERROR_STOP=1 --username postgres --dbname FoodMate --file /tmp/foodmate-v8-seed.sql`；随后执行同路径 `V8__nutrition_usda_directory_expansion_validation.sql`。 |
| Seed 结果 | 食材 `12/12` 写入，foodPortion 规则 `12/12` 写入；重复执行时食材按稳定 ID 幂等更新 `12` 行，规则新增 `0` 行。 |
| Validation 结果 | V8 食材行 `12`、无效食材 `0`；V8 规则行 `12`、无效规则 `0`；食材外键不匹配 `0`；换算规则形状错误 `0`。 |
| 当前总量 | `nutrition_foods` approved 未删除 `60` 条；USDA foodPortion approved 未删除 `60` 条；精确质量换算 `75` 条；active conversion 合计 `135` 条。 |
| 业务测试 | `mvnw.cmd -pl foodmate-infra -am test -Dtest=NutritionExpansionV8SeedScriptTest -Dsurefire.failIfNoSpecifiedTests=false`：`2/2` 通过。先行运行缺失文件时按预期失败，补齐 seed/validation 后转绿。 |
| 数据边界 | 发现并修正初版 seed 的同名冲突、希腊酸奶中文名和 validation 规则 ID；未覆盖已有 V1/V4/V5/V7 事实，未写入原始数据包、API Key 或供应商响应。 |
| 结论 | 本地营养目录已从 48 条扩展至 60 条，V8 seed、来源追溯、份量归一化、幂等和只读 validation 已取得直接证据；后续新增仍需使用新 seed 编号和独立稳定 ID。 |

## D114 Docker Runtime 当前 Embedding 密钥复验（2026-09-02）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime` 和 Milvus；密钥仅从本地忽略 `.env` 注入，未输出或写入仓库。 |
| 配置预检 | `bge-m3` profile、`BAAI/bge-m3`、`local`、`openai-compatible` 和容器 readiness 均通过；Runtime 可从 Docker 启动并监听宿主 `9002`。 |
| 真实请求 | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile bge-m3 -ExecuteRequest` 和 `-EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest` 均到达 `https://api.siliconflow.cn/v1/embeddings`，供应商均返回 HTTP `401 Unauthorized`，安全响应摘要为 `Api key is invalid`。 |
| 影响范围 | 两次请求均未取得向量，不能据此确认当前密钥下 BGE 或 Qwen 的真实 Embedding 业务调用；未使用旧密钥静默替换，也未继续重复请求。 |
| 业务测试 | Python RAG/Worker/云 smoke 契约测试：`77 passed, 4 subtests passed`；该结果只证明本地业务和配置契约，不替代供应商认证。 |
| 结论 | Docker Python Runtime 启动链路和两个 profile 配置正常，当前密钥需要在 SiliconFlow 控制台确认有效性或轮换后再进行真实请求复验；D112 的成功记录仍仅代表当时使用的历史密钥。 |

## D115 Docker 真实公共知识库与 Chat 引用闭环（2026-09-04）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus；管理员会话仅在当前 PowerShell 进程使用，未输出 Cookie、API Key、回答正文或原文。 |
| Java 修复与测试 | 修正知识索引 Outbox SQL 的 PostgreSQL JSONB 存在性判断，兼容尚未执行 V29 的本地数据库；`KnowledgeMapperContractTest` 与 `KnowledgeRepositoryAdapterTest` 定向测试 `9/9` 通过。 |
| Java Docker 部署 | `mvnw.cmd -pl foodmate-bootstrap -am package -DskipTests` 和 `docker compose --env-file .env -f docker/compose.yml build foodmate` 均 `BUILD SUCCESS`；重建后的 `foodmate` readiness 为 `healthy`，未重启或改动依赖服务及持久化卷。 |
| Python Runtime | `/foodmate/internal/health/ready` 返回 HTTP `200`；实际模式为 `local`，后端为 Milvus，Embedding provider 为 `openai-compatible`，模型为 `Qwen/Qwen3-Embedding-0.6B`；RocketMQ producer/consumer 与 Redis 均 ready。 |
| 上传批次 | 使用管理员账号和随机幂等键提交 1 个 Markdown 文件；批次 `354150618522193920`，文档 `354150620275412992`，条目 `354150620275412993`；来源类型为允许的 `admin_upload`。 |
| 真实索引 | Java Index Outbox `foodmate-knowledge-index-v1` 为 `published/attempt=1`；Python 从 MinIO 读取并解析，真实 Embedding 返回 `1024` 维并写入 Milvus；Java 消费结果后条目和文档均为 `indexed`，批次为 `completed`，chunk `10`，token `2116`，成本摘要 `0.00014812`，模型版本为 `Qwen/Qwen3-Embedding-0.6B`；结果 Inbox 为单条幂等事实。 |
| 显式发布与检索 | 文档由管理员显式发布；Visibility Outbox `foodmate-knowledge-visibility-v1` 为 `published/attempt=1`。`POST /api/knowledge-base/search` 返回该文档的 2 条安全引用，未暴露 MinIO 地址或对象键。 |
| 真实 Chat AgentRun | 创建 Run `354151297747783680`；`run.model_usage` 记录 `cloud_primary / deepseek-ai/DeepSeek-V4-Flash`、`total_tokens=481`、状态 `success`。`/api/chat/runs/{runId}/stream` 使用 `Last-Event-ID: 0` 回放 7 个连续事件，唯一终态为 `run.completed`，其中包含 2 条引用；PostgreSQL SSE Outbox `stream_seq=1..7`、唯一 SSE ID `7` 个、终态事件 `1` 个。 |
| 失败记录 | 首轮测试中使用不允许的来源类型和自动上传 MIME 各触发一次稳定 `INVALID_ARGUMENT`，未创建批次或对象；修正为 `admin_upload` 并使用显式 `text/markdown` 后成功。 |
| 清理边界 | 证据核对完成后，仅清理本轮上述批次、文档、条目、chunk、Outbox/Inbox、SSE 事实、Run 及 MinIO/Milvus 测试索引；不执行迁移、truncate、备份恢复或现有数据宽泛删除。 |
| 暂缓范围 | 未执行性能压测、组件重启、ACK 丢失/重复投递故障注入、生产环境容量或发布回滚；本记录只证明一次真实付费主链路业务闭环。 |

## D116 本轮真实闭环测试数据定点清理（2026-09-04）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker PostgreSQL、Redis、MinIO、Milvus、RocketMQ、Java 和 Python 容器保持运行；未执行迁移、truncate、备份恢复或宽泛删除。 |
| PostgreSQL 清理 | 在一个 `BEGIN/COMMIT` 事务中按外键依赖删除本轮批次 `354150618522193920`、文档 `354150620275412992`、条目 `354150620275412993`、10 个 chunk、索引/结果/可见性 Outbox、2 条批次 SSE，以及 Run `354151297747783680`、1 个会话、2 条消息、1 个预算快照、7 条 Run SSE 和 7 条 Runtime 事件；事务提交成功。 |
| 外部索引与对象 | Milvus 精确删除 10 个本轮 `embedding_id`，删除后目标查询为 `0`；Redis 删除 3 个本轮精确 key；MinIO 删除 `foodmate-private/knowledge/public/354150620275412992/README.md`，对象查询无结果。 |
| 反向验证 | PostgreSQL 目标批次/条目/文档/chunk/Outbox/Inbox/SSE/Run/会话/消息查询均为 `0`；本轮 4 条 `operation_audits` 保留作为真实执行证据；Java 与 Python 容器 health 状态仍为 `healthy`。 |
| 保护范围 | 未删除管理员、用户、历史知识文档、历史 Run、全局审计、未确认用途的 `tmp/pdfs/` 和 `tmp/resume-pdf-review-20260903/`；Milvus collection 中其余历史实体保留。 |
| 结论 | 本轮真实付费 Embedding + Milvus + DeepSeek Chat 的业务闭环证据已落档，测试数据已完成精确清理；性能压测、组件重启、ACK/重复投递故障注入、SSE 故障恢复和生产环境验证继续按计划暂缓。 |

## D117 真实云 Chat 驱动 food_log_writer 审批写入闭环（2026-09-04）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker Compose `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 保持运行；临时认证会话仅在当前 PowerShell 进程使用，未输出 Cookie、API Key、完整 Prompt 或模型回答。 |
| 真实 Chat | 已由 `deepseek-ai/DeepSeek-V4-Flash` 生成 `food_log_writer` Proposal；Run `354172422154358784`，Proposal `prop_food_log_773c60f91c1b63d5842da390`，Approval `354172435995561984`。 |
| 失败记录 | 首次使用 SSE 确认卡中的安全展示摘要调用确认接口，Java 按参数摘要校验返回 `409 CONFLICT`，审批仍为 `pending`，没有产生业务写入；随后从 Java Proposal Inbox 读取原始结构化参数并按原始字段顺序重试。 |
| 审批与业务写入 | 原始参数确认成功，随后执行成功；Approval 状态为 `executed`，资源 `food_log_id=354175290076827648`；`food_logs` 新增 1 条 `agent` 来源记录，revision 为 `1`。 |
| 营养事实 | 该 food log 包含 3 条 `food_log_items`，3/3 为 `matched`，0 条为 `pending`；营养字段均已写入，合计热量 `542.5000 kcal`。 |
| Run/SSE | AgentRun 状态为 `completed`、`result_type=normal`；Runtime Inbox 事件 `11` 条、`event_seq=1..11`，其中 `run.completed=1`；SSE Outbox `11` 条、`stream_seq=1..11`、唯一事件 ID `11` 个，其中终态 `run.completed=1`；助手终态消息存在。 |
| 统一审计 | 当前审批事实对应 `approval.propose`、`approval.confirm`、`approval.execute` 和 `food_log.create` 成功审计各 1 条；审计未保存密码、令牌、Prompt、完整回答或原始请求。 |
| 业务验证 | `mvnw.cmd verify`：全 Reactor 构建成功，Java Shared `12/12`、Application `221/221`、Infrastructure `111/111`（20 条条件跳过）、API `68/68`、Bootstrap `59/59`（37 条条件跳过）；Python `.venv` 全量 `198 passed, 2 skipped`；前端 `npm.cmd run typecheck` 通过；Spotless 和 `git diff --check` 通过。 |
| 数据边界 | 本轮仅使用已有测试 Run/Approval 及新增 food log 事实，未执行迁移、truncate、备份恢复或性能/故障注入；新增业务事实按当前真实闭环证据保留，未做宽泛清理。 |
| 结论 | 真实 SiliconFlow Chat -> Python Runtime -> RocketMQ -> Java Proposal -> 管理员确认 -> Java 营养业务写入 -> `run.completed`/SSE 的审批写入闭环已取得直接证据；真实餐食计划闭环、SQL Agent 扩展以及性能、重启、ACK 丢失和组合故障门禁仍未完成。 |

## D118 SQL Agent 共享 Chat Router 实现与业务门禁（2026-09-04）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/real-sql-agent-e2e`；未调用真实云模型、真实 Embedding 或生产服务。 |
| 实现范围 | `local-stub` 保持 deterministic Planner；`local` SQL Planner 改为复用共享 `ModelRouter`，沿用 `FOODMATE_MODEL_TIER_*`、provider、价格审计和 ProviderAttempt，不再读取独立 SQL API Key、Base URL 或 Model 配置。 |
| 安全边界 | SQL Planner 仅生成结构化 QueryPlan；Java 继续执行 Schema 白名单、JSqlParser AST 只读校验、当前用户范围、LIMIT 和 SQL 审计。`local` 拒绝 deterministic 主路由及 fallback，模型结构化响应无效时失败关闭。 |
| 运行时配置 | Docker 新增 `FOODMATE_DOCKER_SQL_PLANNER_MODE`、`FOODMATE_DOCKER_SQL_PLANNER_TIER` 和 `FOODMATE_DOCKER_SQL_PLANNER_TIMEOUT_SECONDS`；Docker SQL Planner 不需要额外 API Key。 |
| 用量审计 | SQL Planner 的 token、成本、路由和 provider attempt 纳入 AgentRun 模型用量；同一 AgentRun 的 SQL 计划缓存，避免 `time_parser -> database_query` 多轮重复调用模型。 |
| Java 门禁 | `mvnw.cmd verify`：全 Reactor 构建成功；Java Shared `12/12`、Application `226/226`、Infrastructure `111/111`（20 条条件跳过）、API `68/68`、Bootstrap `59/59`（37 条条件跳过）。 |
| Python 门禁 | 在项目 `.venv` 下执行 `agent-runtime\\.venv\\Scripts\\python.exe -B -m pytest -q -p no:cacheprovider`：`206 passed、2 skipped、6 subtests passed`；未写入 `.pyc`。 |
| 配置门禁 | `docker compose --env-file .env -f docker/compose.yml config --quiet`：通过。 |
| 证据边界 | 本轮离线 provider 测试只证明共享路由、结构化契约、用量映射和 fail-closed 业务行为；没有发起真实 SQL Agent 付费 Chat 请求，因此不将 M2-2 真实云调用标记为完成。性能压测、组件重启、ACK 丢失、重复投递、SSE 故障恢复和生产验证继续后置。 |

## D119 真实云 SQL Agent 只读分析闭环（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/real-sql-agent-e2e`；Docker Compose `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均保持 healthy；Chat API Key 仅从当前进程注入，未输出或写入仓库。 |
| 真实 Chat | 使用 SiliconFlow `deepseek-ai/DeepSeek-V4-Flash` 执行问题“分析最近7天蛋白质摄入”；Run `354317208152707072`，Session `354317208098181120`，测试账号为随机账号 `codex_sql_paid_37fbde2552a845d9ad07889d9210f730`。 |
| AgentRun 结果 | Run 最终状态为 `completed`；Runtime 产生 `18` 条事件，终态事件 `1` 条；SSE 存在 `run.completed` 终态事件。 |
| 模型用量 | `run.model_usage` 记录 `sql_planner=1`、`composer=3`、`eval=0`；真实请求通过共享 Cloud Router，未启用 deterministic Planner fallback。 |
| SQL Proposal | 生成并执行 `2` 个 Proposal：`time_parser` 和 `database_query`；两者均成功，Java 侧继续执行只读 SQL、Schema 白名单、当前用户范围和 LIMIT 安全校验。 |
| SQL 审计 | SQL 查询审计 `2` 条，结果均为 `executed`；统一操作审计 `7` 条；没有发现 `SQL_SCHEMA_DENIED` 或未授权查询。 |
| 业务终态 | 助手终态消息 `1` 条；`run.completed` 通过现有 Runtime -> Java Inbox -> SSE 投影链路输出，未泄露密码、令牌、完整 Prompt、完整回答或高基数标识到 metrics 标签。 |
| 缺陷修复 | 首次真实模型响应包含末尾分号/完整 Markdown SQL 围栏，已在安全解析边界归一化；同时收紧 Planner 提示词到 Java 授权 Schema，未放宽 JSqlParser AST、字段白名单或用户范围校验。 |
| 测试门禁 | SQL Planner 定向测试 `14 passed`；Python 全量业务测试 `209 passed, 2 skipped, 6 subtests passed`；两个 `integration` marker warning 不影响通过。Java 全量 `mvnw.cmd verify` 与 Docker Compose 校验沿用 D117/D118 已通过证据。 |
| 数据清理 | 已精确清理本轮创建的 `6` 个随机管理员账号及关联 Session、AgentRun、消息、Runtime Inbox/Outbox、Proposal Inbox、SQL 审计、SSE 事实和认证令牌；反向核验 `users=0`、`sessions=0`、`runs=0`、`runtime_events=0`、`proposals=0`、`sql_audits=0`。统一 `operation_audits` 按审计保留约定保留；历史 `codex_sql_real_*` 账号未触碰。 |
| 暂缓范围 | 未执行性能压测、组件重启矩阵、Outbox/Inbox ACK 丢失、重复投递故障注入、SSE 断线恢复、生产容量、备份恢复或发布回滚；本记录只证明一次真实付费 SQL Agent 主链路业务闭环。 |
| 结论 | 真实 SiliconFlow Chat -> Python Runtime -> RocketMQ -> SQL Proposal -> Java 只读校验与执行 -> SQL 审计 -> `run.completed`/SSE 的 SQL Agent 业务闭环已取得直接证据；餐食计划扩展及性能/故障恢复门禁仍按路线后置。 |

## D120 真实云闭环 SSE 回放、Embedding smoke 与全量业务门禁复核（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；分支 `codex/real-sql-agent-e2e`；Docker Compose `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均为 healthy。密钥只由 Docker Compose 从本地忽略 `.env` 注入，未输出、写入仓库或执行记录。 |
| SSE 完整流 | 管理员 Run `354336612697509888` 的 `GET /api/chat/runs/{runId}/stream` 返回 HTTP `200`；完整回放 15 个事件，15 个 `sse_event_id` 全部唯一，`run.completed` 终态 1 个。 |
| SSE Last-Event-ID | 使用第 5 个事件 `sse_354336629667663872` 作为 `Last-Event-ID` 回放返回 HTTP `200`，得到后续 10 个事件；首尾 ID 与完整流一致，10 个 ID 全部唯一，`run.completed` 终态 1 个。此次验证是业务回放契约复核，不扩展解释为组件断线故障矩阵。 |
| Docker 真实 Embedding | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest`：`Qwen/Qwen3-Embedding-0.6B` 返回向量维度 `1024`、`prompt_tokens=5`，延迟 `296.18 ms`，`embedding_smoke_status=passed`。未保存向量正文。 |
| 数据库事实 | 同一 Run `status=completed/result_type=normal`；Runtime Inbox V2 `15/15` 为 `applied`、事件序号 `1..15`、终态 1 个；SSE Outbox `15` 条、终态 1 个且 `sse_event_id` 唯一；模型用量为 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`、`1166` tokens、成本约 `0.002021 CNY`、状态 `success`。 |
| 业务门禁 | `mvnw.cmd verify`：`BUILD SUCCESS`，Shared `12`、Application `228`、Infrastructure `113`（20 条条件跳过）、API `68`、Bootstrap `59`（37 条条件跳过）；项目 `.venv` Python `210 passed、2 skipped、2 warnings、6 subtests passed`；前端 `npm.cmd run typecheck` 通过；`docker compose --env-file .env -f docker/compose.yml config --quiet` 通过。 |
| 运行态 | Docker 应用和依赖容器继续 healthy；未执行迁移、truncate、备份恢复、宽泛删除、性能压测、组件重启、ACK 丢失/重复投递故障注入或生产操作。 |
| 结论 | 当前凭据下 Docker 真实 Embedding、真实 Chat AgentRun、业务写入和 SSE 回放均有可复核证据；M2-1 公共知识库和 M2-2 SQL Agent 业务闭环可以按“已验证”记录。性能、完整故障恢复、生产容量、备份恢复和发布回滚继续后置。 |

## D121 M1-4 记忆治理来源失效与意图分层（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Java 21；未启动或重启 Docker 依赖，未读取或输出 API Key、Prompt、回答正文或用户业务内容。 |
| 实现 | `user_memories` 增加 `source_message_ids` 和 `suppressed_source_message_ids` 契约；Java 记忆候选保存受限来源 ID，修改/删除后阻止来源消息进入近期 Context、摘要重建和重复候选写入；AgentRun 按 `cooking`、`nutrition`、`record`、`planning`、`general` 做类型分层检索。 |
| 迁移 | 已对本地 Docker PostgreSQL 执行 `V31__m1_4_memory_invalidation_boundary.sql`；validation 结果为 `memory_rows=0`、空值/非数组计数均为 `0`，两个 GIN 索引和数组约束均存在；未清理或修改既有数据。 |
| Java 业务验证 | `mvnw.cmd -pl foodmate-application,foodmate-infra -am test -Dtest=MemoryCandidateServiceImplTest,SessionSummaryServiceImplTest,AgentRunCommandServiceImplTest,FlywayV31MigrationScriptTest -Dsurefire.failIfNoSpecifiedTests=false`：`11/11` 通过。 |
| 前置门禁 | 同一轮变更前置回归：Application `228/228`、Infrastructure `113/113`（20 条条件跳过）、API `68/68` 通过；新增测试仅补充失效边界，不改变已通过的业务路径。 |
| 数据边界 | 不保存原文、Prompt、Token、凭据或完整请求；只保存受限来源 ID。未执行性能压测、依赖重启、ACK 丢失、重复投递、SSE 故障恢复或生产操作。 |
| 结论 | 记忆意图分层、来源抑制和失效摘要重建已取得代码、定向业务测试及本地数据库 validation 证据；Docker Java/Python 容器 readiness 已通过。性能、依赖重启、ACK/重复投递和 SSE 故障恢复仍按范围暂缓。 |

## D122 Docker 真实云配置门禁与启动脚本修复（2026-09-05）

| 项目 | 结果 |
|---|---|
| 实现 | 修复 `paid-cloud-preflight.ps1` 的参数错位：base64 源代码使用 `sys.argv[1]`，场景使用 `sys.argv[2]`；RocketMQ Topic 初始化新增幂等存在性回读和 `mqadmin updateTopic` 30 秒有界调用，避免重复 Topic 阻塞 `agent-runtime` 启动。 |
| 付费门禁 | `script/local/paid-cloud-preflight.ps1 -Scenario rag -ExecutePaid` 通过；容器内报告 `paid_execution=true`、`scenario=rag`、`max_scenarios=4`、`max_total_cost_cny=5`、`no_retry=true`、`require_cloud=true`。 |
| Chat smoke | `siliconflow-docker-chat-smoke.ps1 -Tier standard -ExecuteRequest` 通过；provider 为 `cloud_primary`，模型为 `deepseek-ai/DeepSeek-V4-Flash`，返回 `23` tokens，延迟 `945.12 ms`。 |
| Embedding smoke | `siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile qwen3-embedding-0.6b -ExecuteRequest` 通过；模型为 `Qwen/Qwen3-Embedding-0.6B`，向量维度 `1024`，`prompt_tokens=5`，延迟 `185.0 ms`。 |
| Runtime | `agent-runtime` readiness HTTP 200；Redis checkpoint、RocketMQ producer/consumer 和 Milvus local RAG 均为 ready。 |
| 业务边界 | 本轮只验证当前密钥和 Docker 云端点的最小请求，没有重复调用完整业务链路；真实 RAG/SQL/写确认链路以 D117、D119、D120 的直接证据为准。未执行压测、组件故障注入、ACK/重复投递、备份恢复或生产操作。 |
| 结论 | 当前密钥的 Docker Chat 与 Embedding 认证已恢复，付费预检和 Runtime 启动门禁可正常工作；真实业务闭环的稳定性、性能和故障专项继续后置。 |

## D123 真实 RAG 业务闭环可重复执行入口与预检复核（2026-09-05）

| 项目 | 结果 |
|---|---|
| 实现 | 新增 `script/local/real-rag-e2e.ps1` 及契约测试。入口默认只执行 Compose 配置、Java/Python readiness、真实 RAG 配置和付费门禁预检；只有显式 `-ExecutePaid` 才会登录管理员、上传隔离文档并运行 R1 真实业务闭环。管理员凭据仅从当前 PowerShell 进程环境读取，不接受命令行凭据参数。 |
| 真实闭环覆盖 | 显式付费执行路径覆盖批次上传、Java Index Outbox/RocketMQ、Python 解析/真实 Embedding/Milvus、Java 结果回写、批次 SSE、显式发布、公共检索、真实 Chat AgentRun、`run.completed` 引用、SSE `Last-Event-ID` 回放和下线后的不可检索；默认使用 3 份隔离 Markdown 样例，也支持 1 至 5 个 PDF/DOCX/Markdown/TXT 文件。 |
| 安全边界 | 脚本不输出或记录 API Key、密码、Prompt、回答、原文、对象键或供应商原始响应；默认只软删除本轮文档和自动创建的会话。付费执行固定单场景、累计 5 CNY、云 provider 门禁和无自动重试。 |
| 本轮预检 | `powershell.exe -NoProfile -NonInteractive -File .\script\local\real-rag-e2e.ps1` 返回 `status=preflight_passed`；RAG 为 `local`，Embedding 为 `openai-compatible/Qwen/Qwen3-Embedding-0.6B`，Milvus collection 已配置，Chat 为 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，Chat/Embedding Key 均已配置但未输出。 |
| 业务测试 | PowerShell parser 通过；`real-rag-e2e.tests.ps1` 返回 `real_rag_e2e_contract=passed`；项目 `.venv` 执行 `python -B -m pytest -q -p no:cacheprovider`：`212 passed、2 skipped、2 warnings、6 subtests passed`；`docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；`git diff --check` 通过。 |
| 未执行 | 本轮未再次执行真实付费 RAG 上传/索引/Chat 闭环，未产生新增供应商费用；D115/D120 保留的真实付费 RAG 证据仍是当前业务闭环依据。未执行性能压测、组件重启、ACK/重复投递故障注入、生产操作、备份恢复或发布回滚。 |
| 结论 | M2-1 真实 RAG 业务验收已有安全、受限且可重复的执行入口，当前配置预检和业务门禁通过；要新增一轮付费证据，必须由执行人显式提供管理员账号密码并运行 `-ExecutePaid`。 |

## D124 R3 真实餐食计划业务闭环验收入口（2026-09-05）

| 项目 | 结果 |
|---|---|
| 实现 | 新增 `script/local/real-meal-plan-e2e.ps1` 及契约测试；同时修正 `real-rag-e2e.ps1` 的持久化 SSE 路径为 `/api/agent-runs/{runId}/stream`。 |
| 业务路径 | 入口覆盖真实 `POST /api/chat/runs`、AgentRun SSE、`run.clarification_requested`、`meal_plan.save_plan`、approval confirm/execute、Java `meal_plans`、购物清单和唯一 `run.completed`；确认与执行复用同一 `{"plan": ...}` 参数。 |
| 付费门禁 | R3 固定 `meal-plan` 单场景、累计 5 CNY、云 provider、无 fallback 和无自动重试；管理员账号密码只从当前 PowerShell 进程读取，不接受脚本参数。 |
| 默认行为 | 无参数仅做 Docker Compose、Java/Python readiness、high Chat 云路由和付费门禁预检；付费执行默认软删除本轮餐食计划和会话，`-KeepData` 才保留。 |
| 验证 | PowerShell parser 通过；`real-rag-e2e.tests.ps1` 返回 `real_rag_e2e_contract=passed`；`real-meal-plan-e2e.tests.ps1` 返回 `real_meal_plan_e2e_contract=passed`；`git diff --check` 通过。 |
| 本轮执行边界 | 未执行真实付费 R3，不产生新增云费用；因此不把 R3 真实云闭环标记为完成。未执行性能压测、组件重启、ACK/重复投递故障注入、备份恢复、生产操作或发布回滚。 |
| Git | `ea7a9c13 feat(agent): add bounded paid meal plan acceptance runner`。 |

## D125 R3 入口业务门禁与 SSE 路径复核（2026-09-05）

| 项目 | 结果 |
|---|---|
| R3 预检 | `script/local/real-meal-plan-e2e.ps1` 无参数返回 `status=preflight_passed`；容器内 Chat 路由为 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，endpoint/key 已配置，fallback 为 `false`；未创建 Run、未调用付费模型。 |
| Python 业务测试 | 项目 `.venv` 执行 `python -B -m pytest -q -p no:cacheprovider`：`212 passed、2 skipped、2 warnings、6 subtests passed`。 |
| Java SSE 测试 | `mvnw.cmd -pl foodmate-api -am test '-Dtest=RunStreamControllerTest,ChatControllerTest' '-Dsurefire.failIfNoSpecifiedTests=false'`：`ChatControllerTest=2/2`、`RunStreamControllerTest=1/1`，Reactor `BUILD SUCCESS`。 |
| 配置与契约 | `real-rag-e2e.tests.ps1`、`real-meal-plan-e2e.tests.ps1` 均通过；`docker compose ... config --quiet` 通过；脚本和文档 `git diff --check` 通过。 |
| 路径结论 | 当前创建 Run 使用 `POST /api/chat/runs`，持久化 SSE 使用 `GET /api/agent-runs/{runId}/stream`；RAG 入口已同步修正为该路径，历史执行记录中的旧路径仅作为历史事实保留。 |
| 付费边界 | 当前进程未提供 `FOODMATE_E2E_ADMIN_USERNAME`/`FOODMATE_E2E_ADMIN_PASSWORD`，本轮未执行真实付费 R3，不产生新增云费用；R3 仍需执行人显式注入管理员凭据并传入 `-ExecutePaid` 后才能形成真实云闭环证据。 |

## D126 R2 真实饮食记录业务闭环验收入口（2026-09-05）

| 项目 | 结果 |
|---|---|
| 实现 | 新增 `script/local/real-food-log-e2e.ps1` 及契约测试；入口使用当前持久化 SSE 路径 `/api/agent-runs/{runId}/stream`。 |
| 业务路径 | 覆盖真实 `POST /api/chat/runs`、`run.clarification_requested`、`food_log_writer`、approval confirm/execute、Java `food_logs` 查询、营养 `matched` 快照和唯一 `run.completed`；确认与执行复用同一份安全业务参数。 |
| 付费门禁 | R2 固定 `food-log` 单场景、累计 5 CNY、云 provider、无 fallback 和无自动重试；管理员账号密码只从当前 PowerShell 进程读取，不接受脚本参数。 |
| 默认行为 | 无参数仅做 Docker Compose、Java/Python readiness、high Chat 云路由和付费门禁预检；付费执行默认软删除本轮记录和会话，`-KeepData` 才保留。 |
| 本轮执行边界 | 未执行真实付费 R2，不产生新增云费用；因此不把 R2 真实云闭环标记为完成。未执行性能压测、组件重启、ACK/重复投递故障注入、备份恢复、生产操作或发布回滚。 |

## D127 R4 真实云 SQL Agent 业务验收入口与预检复核（2026-09-05）

| 项目 | 结果 |
|---|---|
| 实现 | 新增 `script/local/real-sql-agent-e2e.ps1` 及契约测试。入口默认只执行 Compose 配置、Java/Python readiness、SQL Planner/Composer 云路由和付费门禁预检；只有显式 `-ExecutePaid` 才会登录管理员、创建 Run 并调用真实云 Chat。管理员凭据仅从当前 PowerShell 进程读取，不接受命令行凭据参数。 |
| 真实闭环覆盖 | 显式付费路径覆盖真实 Chat -> SQL Planner -> `time_parser`/`database_query` -> Java Schema/AST/用户范围/只读 Guard -> PostgreSQL SQL 审计 -> Composer -> `run.completed`/SSE，并验证 `Last-Event-ID` 回放。 |
| 安全与费用边界 | 固定单个 `sql-agent` 场景、累计预算上限 5 CNY、要求 `cloud_primary`、关闭 fallback 和自动重试；脚本不输出或记录 API Key、密码、Prompt、完整回答或 SQL 原文，默认只软删除本轮会话。 |
| 本轮预检 | `powershell.exe -NoProfile -NonInteractive -File .\script\local\real-sql-agent-e2e.ps1` 返回 `status=preflight_passed`；SQL Planner/Composer 均为 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，`FOODMATE_SQL_PLANNER_MODE=local`，fallback 为 `false`，价格审计为 `true`；未创建 Run、未调用付费模型。 |
| 业务测试 | `real-sql-agent-e2e.tests.ps1` 返回 `real_sql_agent_e2e_contract=passed`；PowerShell 5.1 解析通过；`docker compose --env-file .env -f docker/compose.yml config --quiet` 通过；本轮未改动 Java/Python 核心实现，因此沿用前置业务测试证据。 |
| 付费边界 | 当前进程未提供 `FOODMATE_E2E_ADMIN_USERNAME`/`FOODMATE_E2E_ADMIN_PASSWORD`，本轮未执行真实付费 SQL Agent，不产生新增供应商费用；要新增 R4 真实云证据，必须由执行人显式注入管理员凭据并运行 `-ExecutePaid`。 |
| 暂缓范围 | 未执行性能压测、组件重启、ACK 丢失/重复投递故障注入、SSE 断线故障矩阵、备份恢复、生产容量或发布回滚。 |
| 结论 | R4 真实 SQL Agent 业务验收入口已经具备可重复、受限和脱敏的执行条件；本轮只证明配置与业务门禁预检通过，不把 R4 真实云主链路标记为本轮新增完成证据。 |

## D128 R3 真实云餐食计划审批写入闭环（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Java、Python Runtime、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均为 healthy；临时管理员凭据仅在当前 PowerShell 进程注入，未写入 `.env`、日志或本记录。 |
| 镜像与启动 | Java Docker 镜像重建成功；Runtime 使用已构建镜像启动并通过 readiness。RocketMQ 初始化容器在最后的 `topicList` 信息步骤存在约 2 分钟延迟，本轮验收对 Runtime 重建使用 `--no-deps`，未修改初始化脚本或消息数据。 |
| 失败记录与修复 | 首轮付费 R3 Run `354559592874643456` 因验收脚本 SSE 客户端固定 45 秒超时提前清理会话，后续工具调用得到 `RUN_NOT_FOUND`；将 `real-meal-plan-e2e.ps1` 的客户端超时改为跟随 `RunTimeoutSeconds` 后，脚本契约测试通过。该轮未产生餐食计划写入。 |
| 真实 Chat | 第二轮显式 `-ExecutePaid` 通过付费门禁；Run `354561396886736896`、Session `354561396828016640`，provider 为 `cloud_primary`，模型为 `deepseek-ai/DeepSeek-V4-Flash`，`run.model_usage` 成功事件 `1` 条，未启用 fallback。 |
| 审批与业务写入 | `run.clarification_requested` 正常返回 Approval `354561413936582656`；状态从 `pending` 经 `confirm` 到 `executed`；生成 `meal_plan_id=354561416176340992`，状态 `saved`、`days=1`、revision `3`；购物清单生成 `14` 个条目。 |
| Run/SSE | Run 最终 `completed/result_type=normal`；初始 SSE `14` 条并包含唯一模型用量事件，确认执行后终态 SSE `1` 条；全量持久化 SSE `15` 条、`stream_seq=1..15`、事件 ID 全部唯一，`run.completed=1`，未出现重复终态。R3 餐食计划终态不包含知识库引用字段，RAG 引用以 R1 记录为准。 |
| 统一审计 | 本轮数据库核对到 `agent_run.create=1`、`approval.propose/confirm/execute=3`、`meal_plan.create=1`、`meal_plan.save=1` 和上下文装配审计；审批确认参数摘要可稳定复用，未保存密码、令牌、Prompt、完整回答或 API Key。 |
| 数据清理 | 脚本默认清理成功：餐食计划及购物清单 `is_deleted=true`，会话软删除；审批和 Run 审计事实按保留约定保留。未执行迁移、truncate、备份恢复、性能压测、组件重启、ACK/重复投递故障注入或生产操作。 |
| 结论 | 真实 SiliconFlow Chat -> Python Runtime -> RocketMQ -> Java Proposal -> 管理员确认/执行 -> 餐食计划与购物清单 -> `run.completed`/SSE 的 R3 业务闭环已取得直接证据；本轮修复了真实云调用超过短 SSE 超时时的验收脚本误清理问题。 |

## D129 R4 真实云 SQL Agent 只读查询闭环（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Java、Python Runtime、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均为 healthy；临时管理员凭据仅在当前 PowerShell 进程注入，未写入 `.env`、日志或本记录。 |
| 镜像与启动 | Java Docker 镜像重建成功；`foodmate` 和 `agent-runtime` 重新创建并通过 readiness；RocketMQ Topic/consumer group 初始化成功；未执行迁移、truncate 或数据卷清理。 |
| 真实 Chat 与 SQL Planner | 付费门禁为单场景、累计上限 `5 CNY`、`no_retry=true`、`require_cloud=true`；Planner 和 Composer 均实际使用 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，共记录 `4` 条成功模型用量事件。 |
| Run/SSE | Run `354576587540140032`、Session `354576587418505216`；初始 SSE `18` 条，事件 ID 唯一，唯一终态为 `run.completed`；`Last-Event-ID` 回放返回 `1` 条终态事件，未出现重复终态。 |
| SQL Agent 工具与审计 | ToolCall 实际包含 `time_parser`、`database_query`；PostgreSQL `sql_query_audits` 共 `2` 条，`executed=2`、`failed=0`；工具持久化仅保存输入/语句摘要、结果状态、行数、SQL 审计 ID、错误码和关联标识，不保存原始 SQL、Prompt、完整结果或凭据。 |
| 数据清理 | 验收脚本默认软删除本轮 Session，清理成功；Run、ToolCall 和 SQL 审计事实按保留约定保留用于复核。 |
| 结论 | 真实 SiliconFlow Chat -> SQL Planner -> Java `time_parser`/`database_query` Guard -> PostgreSQL SQL 审计 -> Composer -> `run.completed`/SSE 回放的 R4 业务闭环已取得直接证据；本轮修复并持久化 ToolCall 安全事实。未执行性能压测、组件故障注入、ACK/重复投递专项、备份恢复、生产操作或发布回滚。 |

## D130 R2 真实云饮食记录确认写入闭环（2026-09-05）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Java、Python Runtime、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均为 healthy；临时管理员凭据仅在当前 PowerShell 进程注入，未写入 `.env`、日志或本记录。 |
| 付费门禁与真实 Chat | 固定 `food-log` 单场景，累计上限 `5 CNY`，`no_retry=true`、`require_cloud=true`；真实 Chat 使用 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，初始 SSE 记录 `1` 条成功模型用量事件。 |
| Proposal 与确认边界 | Run `354580490440675328`、Session `354580490373566464`；初始 SSE `10` 条，返回唯一 `run.clarification_requested` 和 Approval `354580499823333376`，在确认前没有终态；Approval 初始状态为 `pending`，操作为 `create/food_log`，随后才提交 confirm/execute。 |
| 业务写入与终态 | Java 执行生成 `food_log_id=354580501375225856`，查询回读 revision `1`、2 条明细、其中 1 条营养匹配、餐次为 `lunch`；执行后的终态 SSE 为唯一 `run.completed`，并校验返回的饮食记录 ID 与 Java 执行结果一致。 |
| 数据清理 | 验收脚本默认清理成功：本轮饮食记录软删除、Session 软删除，未执行迁移、truncate、备份恢复、性能压测、组件重启或 ACK/重复投递故障注入。 |
| 结论 | 真实 SiliconFlow Chat -> `food_log_writer` Proposal -> Java Approval confirm/execute -> PostgreSQL 饮食记录与营养匹配 -> `run.completed`/SSE 的 R2 业务闭环已取得直接证据；拒绝/重复确认等分支继续由既有业务回归覆盖。 |

## D131 M1-5 真实 USDA 营养目录重建（2026-09-06）

| 项目 | 结果 |
|---|---|
| 数据来源 | 使用 USDA FoodData Central SR Legacy CSV 数据集生成 V33；manifest 记录源压缩包 SHA-256、候选数量、筛选数量、分类分布和版本快照，原始压缩包未提交到仓库。 |
| 结构与导入 | 已在本地 Docker PostgreSQL `FoodMate` 执行 V32 结构契约和 V33 seed；活动目录为 `1,000` 条 `approved/official` 食材，活动 USDA `foodPortion` 换算为 `1,518` 条。 |
| 去重与校验 | 活动规范键 `1,000/1,000`、来源食材 ID `1,000/1,000`、食材/单位换算 `1,518/1,518`；非法目录值、重复活动规范键、非法换算值和食材外键不匹配均为 `0`。 |
| 历史数据边界 | 重新筛选后不再入选的旧生成记录只做软删除，食材 `9` 条、换算 `12` 条；V33 rollback 前置检查暂无饮食明细引用，未执行 `TRUNCATE` 或宽泛删除。 |
| 代码与测试 | `script/data/nutrition/build_usda_catalog.py` 支持稳定外部 ID、中文别名、食材形态、foodPortion 去重和 SQL 转义；营养目录生成器契约测试 `4 passed`，PowerShell 清理脚本语法检查和 `git diff --check` 通过。 |
| 运行边界 | 本轮未调用真实 Chat/Embedding、未写入 Milvus、未修改 RAG 发布状态；只清理了本轮可确认的原始压缩包和 Python 缓存，无法确认归属的临时目录保留待人工判断。 |
| 结论 | 本轮完成真实 USDA 营养目录基线，可供后续饮食匹配使用；营养学人工复核、复合菜配方和生产级目录治理不在本轮完成口径内。 |

## D132 M2-1 官方公共营养资料快照（2026-09-06）

| 项目 | 结果 |
|---|---|
| 来源 | 选取 WHO 中文事实表《健康饮食》《减少钠摄入》《肥胖和超重》，页面日期分别为 2026-01-26、2026-05-11、2025-12-08；三个来源 URL 均为独立 HTTPS 页面。 |
| 本地资料 | 新增 `script/data/knowledge/public/` 下 3 份中文 Markdown 资料和 `manifest.json`；每份资料保留来源名称、URL、页面版本、检索日期和 SHA-256，内容标注为官方页面摘要，不冒充 FoodMate 自有医学结论。 |
| 数据校验 | `validate_public_sources.py` 校验通过：资料数量 `3`、来源 URL 唯一、文件 SHA-256 一致、Front Matter 与 manifest 一致、未发现 API Key/Authorization/测试占位内容或重复正文。 |
| 业务测试 | 项目 `.venv` 执行 `agent-runtime/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider agent-runtime/tests/test_public_knowledge_manifest.py`：`2 passed`；未生成 Python 缓存。 |
| Embedding 边界 | manifest 明确记录 `embedding_status=未构建向量`；本轮未上传管理员 API、未调用真实 Embedding、未写入 Redis/Milvus、未发布 RAG 文档，也未改变现有知识库状态。 |
| 结论 | 公共知识库真实资料准备和来源可追溯校验已完成；待后续确认后，才执行批量上传、真实 Embedding、Milvus 索引和显式发布。 |

## D133 真实业务入口兼容性修复与无付费预检（2026-09-06）

| 项目 | 结果 |
|---|---|
| 修复范围 | 修正 `real-food-log-e2e.ps1`、`real-meal-plan-e2e.ps1` 和 `real-sql-agent-e2e.ps1` 的 PowerShell 参数调用方式；修复 R2/R3 错误摘要脱敏正则；触及的英文代码注释改为中文。 |
| 编码兼容 | 三个入口统一保存为 UTF-8 BOM，Windows PowerShell 5.1 和 PowerShell 7 的语法解析均通过。 |
| 契约测试 | `real-food-log-e2e.tests.ps1`、`real-meal-plan-e2e.tests.ps1`、`real-sql-agent-e2e.tests.ps1` 均通过。 |
| 无付费预检 | R2、R3、R4 无参数执行均返回 `status=preflight_passed`；Chat 路由为 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`，R4 的 SQL Planner 为 `local`，价格审计为 `true`；未创建 Run、未登录、未调用付费服务。 |
| 运行环境 | Docker Compose 配置校验通过；Java、Python Runtime、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 当前均为 healthy。 |
| 数据与安全边界 | 未修改数据库、未上传资料、未构建向量；未输出或提交任何 API Key、密码、Prompt、完整模型响应或临时测试数据。 |
| 暂缓范围 | 未执行真实付费业务、性能压测、组件重启、ACK/重复投递故障注入、备份恢复、生产操作或发布回滚。 |
| 结论 | 真实业务入口已具备可执行且跨 PowerShell 版本的预检条件；本轮仅完成工具修复和无付费配置门禁，不将真实云闭环新增标记为完成。 |

## D134 R1 真实云公共知识库 RAG 闭环（2026-09-06）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；Docker `foodmate`、`agent-runtime`、PostgreSQL、Redis、RocketMQ、MinIO 和 Milvus 均恢复为 healthy；管理员凭据仅注入当前 PowerShell 进程，未写入 `.env`、日志或本记录。 |
| 真实配置与费用门禁 | RAG 使用 `local`、OpenAI-compatible `Qwen/Qwen3-Embedding-0.6B` 和独立 Milvus collection；Chat 使用 `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`；固定单场景、累计上限 `5 CNY`、`no_retry=true`、`require_cloud=true`。 |
| 批次与索引 | 批次 `354708496958099456` 上传 `3` 个隔离文档，3 个条目均索引成功，批次最终状态为 `completed`；Java Index Outbox -> RocketMQ -> Python 解析/真实 Embedding -> Milvus -> Java 结果回写闭环成功。 |
| 批次 SSE | 批次 SSE 共 `6` 个事件，包含 `3` 个 indexed 状态事件；使用 `Last-Event-ID` 回放得到 `5` 个后续事件，事件 ID 连续可复核且无重复终态。 |
| 发布与检索 | 显式发布后公共检索返回 `matched`，引用数量 `2`；下线后检索和恢复接口均返回成功，脚本核对了可见性边界。查询摘要仅记录 SHA-256，不保存原文或完整查询。 |
| AgentRun 与引用 | Run `354708662054293504` 的 SSE 共 `8` 个事件，唯一终态为 `run.completed`，包含 `2` 条安全引用和 `1` 个真实 Chat 模型事件；回放得到 `7` 个后续事件，未出现重复终态。 |
| 数据清理 | 脚本默认清理成功：本轮 `3` 个文档软删除、会话软删除，错误数量 `0`；审计、Outbox/Inbox 和 SSE 事实按保留约定保留。 |
| 安全与暂缓范围 | 未输出或记录 API Key、密码、Prompt、完整回答、对象键、对象地址或完整原文；未执行性能压测、组件重启、ACK 丢失/重复投递故障注入、备份恢复、生产操作或发布回滚。 |
| 结论 | 真实 SiliconFlow Embedding/Chat -> 公共知识库索引与发布 -> AgentRun 检索 -> `run.completed`/SSE 引用的 R1 业务闭环已取得直接证据；生产质量、容量和完整故障矩阵仍按范围后置。 |

## D135 阶段 4 浏览器页面状态核对（2026-09-06）

| 项目 | 结果 |
|---|---|
| 真实模式页面 | 在本地 Vite `VITE_AGENT_MODE=real` 下登录开发管理员后，`/admin/knowledge` 成功加载真实管理页面并显示空列表；`/chat` 成功加载真实聊天页面并显示空会话状态。空列表与 D134 脚本清理结果一致。 |
| 隔离页面状态 | 在不连接后端、不调用付费服务的隔离 mock Vite 实例中，实际核对知识库上传成功态、聊天 `completed-with-citations` 引用展示态和 `write-confirmation` 饮食确认态；页面控件、引用标题/片段和确认/取消入口均可见。 |
| 业务边界 | 本轮只核对页面渲染与状态入口，没有通过浏览器重新上传文档、发布文档或发送新的 AgentRun；不把 fixture 页面状态解释为真实模型或真实数据库证据，后端闭环以 D134、D130、D128 和 D129 为准。 |
| 安全与清理 | 浏览器只访问本机 `127.0.0.1`；未保存截图、凭据、Prompt、回答或业务原文到仓库，临时 Vite 进程和浏览器页面在本轮结束时关闭。 |
| 结论 | 真实模式前端壳层与 Java API 的入口一致，R1/R2 关键页面状态具备可演示验证；真实业务数据页面演示不重复消耗付费额度，仍以已有真实 API/SSE 证据作为权威验收。 |

## D136 真实聊天历史 Run 回放与引用去重修复（2026-09-06）

| 项目 | 结果 |
|---|---|
| 问题 | 真实模式重新进入已有会话时，页面只加载持久化消息，没有恢复最近 `agent_run_id`；即使补订阅 SSE，也会把已持久化的助手回答再渲染一次。 |
| 修复 | 会话消息按 `sequence_no` 排序后恢复最近 Run；历史 Run 回放继续接收 `run.completed` 的引用和状态，但检测到已有助手消息时不重复渲染答案文本，新 Run 仍保留流式答案显示。 |
| 业务测试 | `foodmate-ui` 执行 `npm.cmd test -- --run src/pages/ChatPage/ChatPage.real.test.tsx`：`1` 个测试通过；`npm.cmd run typecheck` 和 Prettier 检查均通过。测试使用本地模块桩，不调用 Java API、真实 Chat 或 Embedding。 |
| 证据边界 | 测试验证历史消息 -> Run 恢复 -> SSE `run.completed` -> 引用展示和答案唯一性；真实云闭环证据仍以 D134、D130、D128、D129 为准。 |
| 注释与提交 | 新增实现注释使用中文；未混入用户已有 Java、Admin UI、Figma QA 或资源改动。 |
| 结论 | 前端刷新/重新进入历史会话时可以恢复终态引用，且不会产生重复助手回答；本轮未新增付费请求、数据库写入或临时数据。 |

## D137 RunsTab 定向业务测试复核（2026-09-06）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；使用 `foodmate-ui` 当前项目依赖和 Vitest，不启动后端、Docker 或真实云服务。 |
| 执行命令 | `cd foodmate-ui; npm.cmd test -- --run src/pages/AdminPage/tabs/RunsTab.test.tsx src/pages/AdminPage/tabs/RunsTab.real.test.tsx` |
| 测试结果 | 2 个测试文件通过，4/4 个测试通过，退出码 `0`；验证包含 RunsTab 详情加载路径。 |
| 付费与数据边界 | 未调用 Chat/Embedding，未访问 Java API，未写入 PostgreSQL、Redis、Milvus 或 RocketMQ，未生成测试数据。 |
| 范围说明 | 本轮只复核此前记录的已知定向失败，不重新运行完整 Vitest 套件；README 和测试策略已同步更新，避免把定向结果误写成完整套件结果。 |
| 结论 | `RunsTab` 已知定向测试问题当前不可复现且本次验证通过；完整前端测试套件仍需在后续大功能点按计划集中执行。 |

## D138 Docker 应用容器、管理员登录与数据边界复核（2026-09-06）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate`；使用根目录 `.env` 启动本地 Docker Compose 应用容器。真实密钥、管理员密码和会话令牌未写入本记录。 |
| 镜像构建 | `docker compose --env-file .env -f docker/compose.yml build foodmate` 返回成功；随后执行 `docker compose --env-file .env -f docker/compose.yml up -d --no-deps foodmate`，只重建应用容器，未重建依赖服务、迁移数据库或清理数据卷。 |
| readiness | `foodmate` 容器启动后 Docker health 状态为 `healthy`；`/actuator/health/readiness` 返回 HTTP 200，应用日志显示 Java 控制面正常启动并连接 PostgreSQL。 |
| 管理员登录 | `POST /api/auth/login` 使用 `admin@foodmate.local` 和本地开发密码返回 HTTP 200、`admin` 角色及会话 Cookie；首轮使用驼峰字段得到 `INVALID_ARGUMENT`，按现有 `LoginRequest` 的 `snake_case` 契约改为 `username_or_email` 后通过，未修改业务代码。 |
| 数据边界 | PostgreSQL 只读复核结果：明确的 `codex_*` 探针账号 `0`；管理员账号 `1` 且 `password_hash` 为 BCrypt；营养目录 `1,009` 条；知识库文档 `3` 条；知识导入批次 `1` 条。未发现营养目录或知识库历史事实被误删。 |
| 代码与计划 | 中文代码注释门禁已写入《秋招真实业务闭环执行计划》和《M2剩余功能执行计划》；本轮没有新增 Java/Python 业务代码，因此没有进行无关的全仓库注释翻译。 |
| 暂缓范围 | 未执行性能压测、真实 Agent 流量统计、组件重启矩阵、ACK 丢失/重复投递故障注入、SSE 断线专项、备份恢复、生产操作或发布回滚。 |
| 结论 | 本轮确认 Docker 应用镜像可构建、容器可启动、管理员认证可用且数据库清理范围受控；该结果只补充本地启动和账号复核证据，不将暂缓的 M1-6 故障/性能内容标记为完成。 |

## D139 G0 前端业务质量门禁复核（2026-09-06）

| 项目 | 结果 |
|---|---|
| 执行环境 | Windows 工作区 `D:\\develop\\FoodMate\\foodmate-ui`；使用仓库现有 Node 依赖，不启动 Java、Docker 或真实云服务。 |
| 执行命令 | `npm.cmd run typecheck`；`npm.cmd test -- --run src/pages/ChatPage/ChatPage.test.tsx`；`npm.cmd run build`。 |
| 测试结果 | `ChatPage.test.tsx` 1 个测试文件、32/32 通过；TypeScript 检查通过；Vite 生产构建成功，2,015 个模块完成转换。 |
| 计划对照 | G0 要求的 `renderState` 测试装配当前已存在，未发现该计划项仍有代码阻塞；本轮未重复修改用户已有 Admin UI/Figma 改动。 |
| 数据与费用边界 | 未访问 Java API，未调用 Chat/Embedding，未写入 PostgreSQL、Redis、Milvus 或 RocketMQ，未生成业务测试数据。 |
| 注释门禁 | 本轮没有修改业务代码；涉及的现有测试注释保持中文，未进行无关的全仓库翻译。 |
| 结论 | G0 前端业务构建门禁在当前工作区复核通过，可进入 K1/K2 知识索引契约复核；完整 Vitest 套件不作为本轮必要重复测试。 |

## D140 K1/K3 知识索引契约与双模式业务测试复核（2026-09-06）

| 项目 | 结果 |
|---|---|
| Java 业务测试 | `KnowledgeIndexResultMessageProcessorTest`、`KnowledgeOutboxPublisherTest`、`KnowledgeUploadValidationTest`、`KnowledgeServiceImplTest`、`KnowledgeSearchServiceImplTest`、`FlywayV16V17KnowledgeMigrationScriptTest`、`FlywayV28MigrationScriptTest`、`FlywayV29MigrationScriptTest`、`KnowledgeControllerTest`、`KnowledgeSearchControllerTest` 合计 36/36 通过。 |
| Python 业务测试 | 使用 `agent-runtime\\.venv\\Scripts\\python.exe -B -m pytest -q -p no:cacheprovider tests/test_knowledge_worker.py tests/test_knowledge_rag.py tests/test_runtime_env.py tests/test_docker_compose_contract.py`，79/79 通过，4 个子断言通过；未调用真实云服务。 |
| 只读数据库校验 | V16、V17、V28、V32、V33 validation 均执行成功；知识状态/重试/重复事实均无非法计数，V33 当前活动目录为 1,000 条食材和 1,518 条换算，非法值为 0。 |
| 发现的问题 | 首次执行 V29 validation 时，当前本地库尚未应用 V29，旧脚本直接引用不存在的 `provider_trace_id`，导致 SQL 错误；该次失败已保留为本轮修复依据，未修改数据库。 |
| 修复内容 | V29 validation 和 rollback precheck 先判断列是否存在，再通过 psql `\\gexec` 动态执行对应只读查询；未应用时返回 `provider_trace_migration_status=not_applied`，已应用时继续校验 Trace 长度和记录数。 |
| 修复验证 | V29 validation 和 rollback precheck 在当前数据库均返回 `not_applied`，不再中止；`FlywayV29MigrationScriptTest` 2/2 通过，`git diff --check` 通过。 |
| 数据与费用边界 | 未执行迁移、truncate、删除、备份恢复或真实云调用；未写入 PostgreSQL、Redis、Milvus 或 RocketMQ 业务数据。 |
| 注释门禁 | 新增 SQL 注释使用中文；未翻译与本切片无关的已有注释或用户改动。 |
| 结论 | K1/K3 的知识索引契约、双模式业务测试和当前数据库只读校验已完成；V29 尚未应用的本地状态被明确区分，不误报为数据损坏。 |

## D141 秋招真实业务闭环计划启动复核（2026-09-06）

| 项目 | 结果 |
|---|---|
| 执行范围 | 按《秋招真实业务闭环执行计划》复核 R1 公共知识库、R2 饮食记录、R3 餐食计划和 R4 只读 SQL Agent 的可执行入口；本轮只做配置预检和业务门禁，不重复消耗付费额度。 |
| 无付费预检 | `real-rag-e2e.ps1`、`real-food-log-e2e.ps1`、`real-meal-plan-e2e.ps1`、`real-sql-agent-e2e.ps1` 无参数执行均返回 `status=preflight_passed`；路由确认包含真实 Chat `cloud_primary/deepseek-ai/DeepSeek-V4-Flash`、真实 Embedding `openai-compatible/Qwen/Qwen3-Embedding-0.6B` 和已配置 Milvus collection，未登录、未创建 Run、未上传文档、未调用 Chat/Embedding。 |
| Java 业务门禁 | `mvnw.cmd -pl foodmate-application,foodmate-infra,foodmate-api -am test` 定向执行知识库、Tool Gateway、SQL Guard、饮食记录、餐食计划、审批和 Run/SSE 测试：Application `113/113`、Infrastructure `2/2`、API `9/9`，合计 `124/124`，无失败。 |
| Python 业务门禁 | 使用项目 `.venv` 执行 RAG Worker、知识检索、Runtime 环境、Compose、模型适配、Runtime Server、SQL Planner、Tool Protocol 和 MQ 测试：`198 passed`、`6` 个子断言通过；使用 `-B -p no:cacheprovider`，未生成 Python 缓存，未调用真实云服务。 |
| 前端业务门禁 | 管理端、知识库、聊天、引用和相关服务共 `10` 个测试文件、`71/71` 通过；`npm.cmd run typecheck` 通过。未启动真实业务请求，未写入数据库或消息系统。 |
| 脚本注释门禁 | 付费预检、Embedding profile 切换、Docker Chat smoke 和 Docker Embedding smoke 的自然语言注释已统一为中文；R1/R2/R3/R4 及 Embedding smoke 契约测试 `5/5` 通过，改动已提交为 `de3fec18`。 |
| 命令修正 | 首次 Python 测试命令错误引用不存在的 `test_recovery_protocol.py`，随后按实际测试清单修正；该问题是命令路径错误，不是业务代码失败。 |
| 数据与费用边界 | 未执行迁移、truncate、删除、备份恢复、性能压测、组件重启、ACK/重复投递故障注入或真实付费业务；未输出或记录任何 API Key、密码、Prompt、完整回答、原文或对象存储地址。 |
| 结论 | 当前计划范围内的真实业务实现和业务门禁已有历史直接证据，本轮复核与历史证据一致；下一步不重复付费执行，继续保持性能、故障矩阵、生产部署和备份恢复后置。 |

## D142 全量营养目录真实 Embedding 索引（2026-09-06）

| 项目 | 结果 |
|---|---|
| 代码与容器 | 新增独立营养目录 Milvus/Redis 索引适配器、Runtime `POST /foodmate/internal/v1/nutrition/search` 和 `script/local/index-nutrition-catalog.ps1`；Python 定向测试 `55 passed`，Docker `agent-runtime` 镜像构建成功并恢复 healthy。 |
| 数据读取 | 脚本从当前 PostgreSQL `nutrition_foods` 读取 `approved + official + is_deleted=false` 记录，共 `1,000` 条；未修改营养表、未迁移、未清理业务数据。首次运行因误带不存在的 `tenant_id` 条件在读取阶段失败，未产生外部请求；修正后重新执行成功。 |
| 真实索引 | 使用 `Qwen/Qwen3-Embedding-0.6B`，分 `32` 批写入 Milvus 集合 `foodmate_nutrition_foods`；供应商返回累计 `113,538` tokens；Milvus 复核得到 `1,000` 个实体和 `1,000` 个唯一 `nutrition_food_id`。稳定 `nutr_<sha256>` ID 支持重复 upsert。 |
| 真实检索 | Runtime 对“鸡胸肉”执行一次真实 Embedding + Milvus 查询，返回对应 `nutrition_food_id=171474` 的鸡胸肉候选及其他 raw/cooked 形态候选；查询固定过滤营养目录的公共、已发布、已索引、当前版本和未删除 metadata。 |
| 权威边界 | PostgreSQL 继续保存和提供标准名称、营养数值、来源版本及单位换算；饮食记录写入仍使用 Java 精确 SQL 匹配，向量检索只作为独立候选入口，不直接替代营养事实。公共知识 `knowledge_search` 继续查询普通知识 collection。 |
| 数据与费用边界 | 本轮产生真实 Embedding 供应商请求并写入 Milvus；未调用 Chat，未写入 PostgreSQL/Redis/RocketMQ 业务事实，未输出或记录 API Key、向量正文或完整查询。性能压测、组件重启、ACK/重复投递故障注入、备份恢复和生产操作继续后置。 |
| 结论 | 全量营养目录已完成真实向量构建并取得 Milvus 数量和查询证据；营养精确匹配业务保持不变，后续如需将语义候选用于未知食材自动匹配，仍需单独增加 Java 置信度门槛和人工确认策略。 |
