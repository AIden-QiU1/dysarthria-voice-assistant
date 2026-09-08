# 当前任务状态

> 最后更新：2026-09-08。只记录仍需执行或验收的事项；完成历史由 Git 和 `research/` 专项事实源保存。

## P0：采集四项需求

唯一执行入口：[采集、扩容与运行时控制面](../research/product-engineering/VOICE_COLLECTION_SCALING_CONTROL_PLANE_2026-09-04.md)。

- [ ] 完成方言双录状态机：普通话确认后可录方言或跳过，支持配对重录、撤回、刷新恢复和 Web/App 一致 contract。
- [ ] [方言多项资料优化](../research/product-engineering/DIALECT_PROFILE_IMPLEMENTATION_2026-09-07.md)：2026-09-07 14:52 确认 Web/Backend 已部署，公网表单可用；生产缺新列、after-change 触发器未更新。待隔离验证、核对迁移历史并确认后定向应用 `20260907010000`，再验收 Auth→workspace 与真实录音；质检审计表迁移 `20260904010000` 另行确认。
- [ ] 部署录音服务端准入与训练导出 hard gate；先做历史数据 backfill dry-run，再用当前授权账号完成 Web/Mobile 上传 smoke。
- [ ] 为后台质检补持久状态机和人工审核接口；自动判断只分层或建议重录，不删除原始录音，不直接批准训练导入。
- [ ] 完成第二品牌接线与全量验证；等待用户提供域名、中文站名、Logo 和主色，且页面、metadata、邮件和下载入口不得出现“燃言”。

## P0：实时并发与扩容

- [x] 单 Agent Worker 8 路完整 RTC 链路通过；生产保护值已收口为 8 active jobs、4 个性化 ASR、4 realtime fallback、8 LLM、3 TTS。
- [x] LiveKit Agents `1.7.1`、Server `1.13.6` 已完成代码升级与生产验证；每周版本检查只创建提醒，不自动升级。
- [x] 8001 多账户链路和注册用户模型映射已核验；旧 8000/18000 已退出。
- [ ] 16 路：增加第二个 8 路 Agent Worker，优化 GPU ASR P95，申请 TTS/LLM 配额，并实现跨 Worker 集中配额与过载指标。
- [ ] Backend 多实例前实现持久事件队列、幂等和分布式账号互斥，禁止继续依赖进程内状态。
- [ ] 1,000 路：完成分层容量模型、容量预警、单节点 LiveKit 阶段验收，再按证据建设 Redis 支撑的 LiveKit 多节点与独立 TURN。
- [ ] 用户确认并购买云资源、Provider 配额；正式 DNS/流量切换和旧资源释放需单独审批。

## P0：真实设备与生产验收

- [x] Web 数据录入停止流程已改为即时释放：最终 ASR 与上传后台执行，结果按 capture id 隔离，RTC 停止消息和浏览器音频关闭不会永久挂住；前端 139 项测试、类型检查和生产构建已通过。
- [ ] Web 数据录入修复已最小影响部署；用真实账号连续录制至少 10 句，验收停止后立即切题、后台补转写、不串句、不需换浏览器。
- [ ] Web 真实账号：个人短语、麦克风、LiveKit、confirmed output、本机朗读和故障降级。
- [ ] 20 词筛查：完成整组录音、评分、报告和同人同设备复测。
- [ ] Android/iPhone：登录、RTC、原生录音、上传/重试/撤回、TTS/复制、档案编辑和断网恢复；iOS 先完成签名与设备授权。
- [ ] 真实短信注册、再次登录与 Android smoke；注册强化必须同时兼容 Web、Mobile token 和管理权限。
- [ ] Android 应用市场提交前，用真机验收注册/登录单一授权勾选、四份法律文件外链和授权版本写回；由中国大陆隐私合规律师复核合并授权是否满足敏感个人信息与商业训练用途要求。
- [ ] 核验 Supabase 账号认证和数据库的实际部署区域、合同与个人信息出境安排；补齐产品内账号注销闭环后再提交正式审核。

## P1：数据与运行时治理

- [ ] 修复 Supabase migration history 漂移；在还原并核对 `20260228000002`—`20260228000006` 前，不执行广域 `migration repair` 或 `db push --include-all`。
- [ ] 完成上传时音频头解析、内容 SHA-256、重复检测和逐题 provenance 回填。
- [ ] 继续收口 session-local memory、workspace durable owner、会后压缩和训练报告边界，避免平行事实源。
- [ ] 冻结硬件 P0 真实任务 A/B 协议，通过 Gate 后再向至少两家供应商发同口径 RFI/RFQ。

## P1：子公司布局与政策核验

- [ ] [RO-017](../research/product-engineering/RO-017-compute-policy-briefing-2026-09-07.md)：取得余杭2026修订细则、最终伙伴名录及新设子公司资格书面口径；2026-09-11或取得新证据时复核。8页合伙人商务报告PDF已生成并完成版式、全文及引用验证；企业资格及政策采用仍待确认。

- [ ] [RO-018](../research/product-engineering/RO-018-aliyun-budget-and-compute-2026-09-07.md)：合伙人复核充值申请，取得阿里云拆项报价、奇绩剩余支持条款、GPU可交付SKU和试机；先确认主体与政策合格费用，再审批充值/长期资源。

## 本次归档边界（2026-09-08）

- `.playwright-mcp/` 全目录忽略并取消旧快照的 Git 跟踪，本地文件保留；需要长期留存的验收证据另行归档到 `research/`。
- 已复跑前端测试/类型检查/生产构建、Backend、Mobile、文档/研究与 Compose 静态验证；Git 上传不代表生产验收完成。数据库迁移、真实账号录音及真机任务保持未完成；原始研究证据保持字节与哈希不变。

## 验证入口

- 文档与研究：`bash scripts/check_ai_docs.sh`
- Research Harness：`bash scripts/check_research_system.sh && python3 scripts/research/validate-research-loop.py`
- Web：`cd frontend && npm test && npx tsc --noEmit && npm run build`
- Backend：`cd backend && npm run build`
- LiveKit Agent：`cd livekit_agent && python3 -m unittest discover tests -v`
- Mobile：`cd apps/mobile-workbench && npm run check && npm run typecheck`
- Docker：优先 `bash scripts/docker-rebuild-core-fast.sh` 的最小影响模式；磁盘维护先 `bash scripts/docker_disk_maintenance.sh status`，再用 `prune-safe`。
