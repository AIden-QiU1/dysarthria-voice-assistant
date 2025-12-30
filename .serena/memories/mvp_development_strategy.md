# MVP开发策略 - 围绕生产级TEN Agent

## 1. 核心定位重新理解

### 用户澄清
**错误理解**: 助手是"操作手机的AI"（语音拨号、控制智能家居）
**正确理解**: 助手是"沟通场景中的实时翻译/主持人"

### MVP场景优先级
```
V0.1 (最高优先级): 实时翻译助手
  场景: 患者和家人面对面聊天
  流程: 患者说话(构音障碍) → AI识别 → 清晰语音播放 → 家人听到
  
V0.2: 电话翻译助手  
  场景: 患者打电话/接电话
  流程: 双向通话 + 单向语音增强(患者端清晰化)
  
V0.3: 会议主持助手
  场景: 多人会议/聚会
  功能: 说话人识别 + 实时字幕 + AI总结
```

## 2. 技术架构分析

### 2.1 TEN Agent Pipeline (核心)
```
Agora RTC (输入) 
  → Silero VAD (语音活动检测)
  → FunASR ASR (本地语音识别)
  → GLM-4 LLM (意图理解 + Tool Calling)
  → CosyVoice TTS (语音合成)
  → Agora RTC (输出)
  
Backend Webhook Extension (旁路)
  → agent-sdk Backend API (业务层)
    - 用户配置
    - 会话记录
    - 工具执行
```

### 2.2 TEN Extension开发模式 (Python Async)

**Extension基类方法** (来自官方文档):
```python
class AsyncExtension:
    async def on_init(ten_env: AsyncTenEnv) -> None:
        """初始化Extension, 读取配置"""
        
    async def on_cmd(ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令 (来自其他Extension)"""
        
    async def on_data(ten_env: AsyncTenEnv, data: Data) -> None:
        """处理数据流 (音频/文本等)"""
        
    async def on_start(ten_env: AsyncTenEnv) -> None:
        """Extension启动"""
        
    async def on_stop(ten_env: AsyncTenEnv) -> None:
        """Extension停止, 清理资源"""
```

**ASR Extension模式** (from Context7 TEN docs):
```python
class AsyncASRBaseExtension:
    # 生命周期
    async def on_init()
    async def start_connection()
    async def send_audio(audio_frame: bytes)
    async def finalize()
    async def stop_connection()
    
    # 事件回调
    async def on_asr_start()
    async def on_asr_sentence_start()
    async def on_asr_sentence_change(result: dict)
    async def on_asr_sentence_end(result: dict)
    async def on_asr_complete()
    async def on_asr_fail()
    async def on_asr_error(error_code, error_message)
```

### 2.3 现有Extension分析 (通过Serena)

**Backend Webhook Extension**:
- 文件: `ten_agent/ten_packages/extension/backend_webhook_python/extension.py`
- 类: `BackendWebhookExtension(AsyncExtension)`
- 功能: 记录会话日志, 获取用户配置, 转发工具执行
- 集成点: POST请求到 `http://localhost:3001/api/agent/*`

**GLM LLM Extension**:
- 文件: `ten_agent/ten_packages/extension/glm_llm_python/extension.py`
- 类: `GLMLLMExtension(AsyncExtension)`
- 功能: 接收ASR文本 → 调用GLM-4 API → 支持Tool Calling
- 内置工具: make_phone_call, control_smart_device, send_emergency_alert, set_reminder
- 系统提示: 专为构音障碍用户优化

**CosyVoice TTS Extension**:
- 文件: `ten_agent/ten_packages/extension/cosyvoice_tts_python/extension.py`
- 功能: LLM文本 → CosyVoice API → PCM音频流

**FunASR Extension**:
- 文件: `ten_agent/ten_packages/extension/funasr_asr_python/extension.py`
- 功能: VAD分段音频 → FunASR识别 → 文本输出 + 热词增强

## 3. MVP V0.1开发计划 (2周)

### Week 1: TEN Agent核心Pipeline

**Task 1.1**: 启动并测试TEN Agent
- [ ] 配置 `ten_agent/property.json` (Agora APP_ID, GLM API Key)
- [ ] 配置 `ten_agent/.env`
- [ ] 运行 `python -m ten.framework` 或 `ten_agent start`
- [ ] 验证Extensions加载无错误

**Task 1.2**: 测试端到端音频Pipeline
- [ ] Agora RTC接收音频 (测试输入)
- [ ] VAD检测语音活动
- [ ] FunASR识别输出文本
- [ ] 验证Backend Webhook记录日志

**Task 1.3**: TTS输出集成
- [ ] GLM生成文本 → CosyVoice合成
- [ ] PCM音频流 → Agora RTC播放
- [ ] 测试延迟 (目标: <1.5s端到端)

### Week 2: Frontend集成与优化

**Task 2.1**: Frontend Agora RTC集成
- [ ] 安装 `agora-rtc-sdk-ng`
- [ ] 麦克风音频采集 → Agora推流
- [ ] Agora拉流 → 扬声器播放
- [ ] 替换现有WebSocket ASR (迁移到TEN Agent)

**Task 2.2**: UI改造 - 对话界面
- [ ] 实时字幕展示 (ASR结果)
- [ ] 清晰语音播放提示 (TTS播放中)
- [ ] 大字体、高对比度 (无障碍友好)

**Task 2.3**: 真实用户测试
- [ ] 招募构音障碍患者测试
- [ ] 收集反馈 (延迟、准确率、易用性)
- [ ] 优化热词和系统提示

## 4. 技术决策

### 4.1 不使用Backend WebSocket ASR (废弃)
- 原因: TEN Agent提供更完整的Pipeline (VAD + ASR + LLM + TTS)
- Backend ASR仅用于数据贡献功能 (可选)

### 4.2 Agora RTC vs WebSocket
- V0.1单设备: 使用Agora本地模式 (loopback)
- V0.2电话场景: 使用Agora跨设备通信

### 4.3 agent-sdk定位
- 不是"AI Workers框架" (已废弃)
- 是"业务层API" (用户配置、会话记录、工具执行)
- TEN Agent通过Backend Webhook Extension调用

## 5. 开发工具使用指南

### 5.1 使用Serena理解现有代码
```
# 列出Extension目录
mcp_serena_list_dir(relative_path="ten_agent/ten_packages/extension", recursive=true)

# 获取Extension概览
mcp_serena_get_symbols_overview(
  relative_path="ten_agent/ten_packages/extension/glm_llm_python/extension.py",
  depth=1
)

# 查找Symbol
mcp_serena_find_symbol(
  name_path_pattern="GLMLLMExtension",
  relative_path="ten_agent/ten_packages/extension/glm_llm_python",
  include_body=true,
  depth=1
)

# 查找引用
mcp_serena_find_referencing_symbols(
  name_path="on_cmd",
  relative_path="ten_agent/ten_packages/extension/glm_llm_python/extension.py"
)
```

### 5.2 使用Context7理解官方文档
```
# 搜索TEN Framework
mcp_context7_resolve-library-id(libraryName="TEN Framework")
→ /ten-framework/ten-framework

# 获取Extension开发文档
mcp_context7_get-library-docs(
  context7CompatibleLibraryID="/ten-framework/ten-framework",
  mode="code",
  topic="extension development Python async on_init on_cmd"
)

# 获取Agora RTC文档
mcp_context7_resolve-library-id(libraryName="Agora RTC")
→ /agoraio/agora-rtc-web

mcp_context7_get-library-docs(
  context7CompatibleLibraryID="/agoraio/agora-rtc-web",
  mode="code",
  topic="real-time audio streaming voice call"
)
```

### 5.3 使用MCP AI Forever交互
```
# 每完成一个任务后汇报
mcp_mcp-ai-foreve_interactive_feedback(
  project_directory="/root/VoxFlame-Agent",
  summary="✅ Task 1.1完成: TEN Agent启动成功, 6个Extensions加载无错误",
  timeout=6000
)
```

### 5.4 使用Sequential Thinking深度分析
```
mcp_sequential-th_sequentialthinking(
  thought="分析TEN Agent Pipeline数据流...",
  thoughtNumber=1,
  totalThoughts=5,
  nextThoughtNeeded=true
)
```

## 6. 性能目标

| 指标 | 目标 | 当前 |
|------|------|------|
| VAD延迟 | < 50ms | 待测 |
| ASR延迟 | < 300ms | 待测 |
| LLM首Token | < 500ms | 待测 |
| TTS延迟 | < 200ms | 待测 |
| **端到端延迟** | **< 1.5s** | **待测** |

## 7. 成功标准

### MVP V0.1
- [ ] TEN Agent Pipeline完整运行
- [ ] 前端Agora RTC集成完成
- [ ] 端到端延迟 < 2s (允许误差)
- [ ] 至少1位真实用户测试通过

### 用户体验
- [ ] 患者说"我想喝水" → 清晰语音播放 "我想喝水"
- [ ] 家人能听懂 (不需要猜测或重复)
- [ ] 界面简洁, 大字体清晰可见

## 8. 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| TEN Agent启动失败 | 阻断开发 | 先用Docker快速测试 |
| Agora配置复杂 | 延迟集成 | 先用loopback模式本地测试 |
| 延迟超过2s | 用户体验差 | 优化VAD触发阈值, 使用流式TTS |
| FunASR识别准确率低 | 核心功能受损 | 添加热词, 切换SenseVoice模型 |

## 9. 下一步行动

1. ✅ 写入此记忆 (`mvp_development_strategy`)
2. ⏳ 配置并启动TEN Agent
3. ⏳ 测试Extensions是否正常加载
4. ⏳ 使用Serena分析GLM Extension的Tool Calling实现
5. ⏳ 使用Context7获取Agora RTC集成示例代码
6. ⏳ 更新README.md (MVP计划)

---

**最后更新**: 2025-12-29
**编写工具**: Serena + Context7 + Sequential Thinking + MCP AI Forever
