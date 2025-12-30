# VoxFlame Agent 系统 API 配置分析

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      PWA Frontend (Next.js)                      │
│                 WebSocket: ws://localhost:3001/ws/asr            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Express + WebSocket)                   │
│                  📍 Port: 3001 (可配置 PORT)                      │
├─────────────────────────────────────────────────────────────────┤
│ ✅ ASR 服务:                                                      │
│   - 火山引擎 (Volcengine) [默认]                                  │
│   - 阿里云 (Alibaba Cloud) [可切换]                               │
│                                                                 │
│ ✅ Agent API:                                                    │
│   - 用户配置 (Profile API)                                        │
│   - 会话日志 (Session Log API)                                    │
│   - 工具执行 (Tool Execute API)                                   │
│   - 热词管理 (Hotwords API)                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TEN Agent Framework                            │
│         GraphQL 配置 + 多个 Extensions (Python)                  │
├─────────────────────────────────────────────────────────────────┤
│ Extensions:                                                      │
│ 1. FunASR ASR Extension - 本地语音识别                           │
│ 2. GLM-4 LLM Extension - 智谱 AI 大模型                          │
│ 3. CosyVoice TTS Extension - 语音合成                            │
│ 4. Backend Webhook Extension - 与 Backend 交互                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI Worker SDK (Python)                              │
│       - Redis Stream 消息队列                                     │
│       - Worker Manager & Task Dispatcher                        │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 需要配置的 API 和密钥

### 2.1 Backend 后端 (Express)

#### 环境变量 (.env 或 docker-compose.yml)
```
# 服务端口
PORT=3001

# ASR 提供商选择 (默认: volcengine)
ASR_PROVIDER=volcengine  # 或 'alibaba'

# ==================== 火山引擎 ASR ====================
# 获取地址: https://console.volcengine.com/
# 文档: https://www.volcengine.com/docs/6349
VOLCENGINE_APP_ID=your_app_id_here
VOLCENGINE_TOKEN=your_token_here

# ==================== 阿里云 ASR ====================
# 获取地址: https://console.aliyun.com/
# 文档: https://help.aliyun.com/zh/nlp/user-guide
ALIBABA_APP_KEY=your_app_key_here
ALIBABA_ACCESS_KEY_ID=your_access_key_id_here
ALIBABA_ACCESS_KEY_SECRET=your_access_key_secret_here
ALIBABA_REGION=cn-shanghai  # 默认华东 2

# 开发环境
NODE_ENV=development
```

**ASR 服务对比:**
| 属性 | 火山引擎 | 阿里云 |
|------|---------|-------|
| 获取方式 | 字符串 Token | Access Key + Secret |
| Token 有效期 | 长期有效 | 1小时自动刷新 |
| 支持格式 | PCM 16k 16bit | PCM 16k 16bit |
| 实时延迟 | 较低 | 中等 |
| 成本 | 按分钟计费 | 按路数计费 |

### 2.2 TEN Agent 框架 (Python)

#### 环境变量 (ten_agent/.env 或 property.json)

```
# ==================== GLM-4 LLM API ====================
# 获取地址: https://open.bigmodel.cn/
# 文档: https://open.bigmodel.cn/dev/howuse
GLM_API_KEY=your_glm_api_key_here

# GLM 配置选项 (可选)
GLM_MODEL=glm-4-plus  # 默认型号
GLM_MAX_TOKENS=500
GLM_TEMPERATURE=0.95

# ==================== Redis 配置 ====================
# Agent SDK 队列服务
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=  # 如无密码留空

# ==================== 本地模型 ====================
# FunASR 模型路径 (已内置)
FUNASR_MODEL_PATH=damo/speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch

# CosyVoice TTS (本地服务)
COSYVOICE_SERVER=http://localhost:8000  # CosyVoice 服务地址

# 后端 Webhook
BACKEND_WEBHOOK_URL=http://localhost:3001/api/agent
```

### 2.3 Agent SDK 配置 (Python)

#### 位置: agent-sdk/agent_sdk/config.py

主要配置文件（如需要）:
```python
# Redis 连接
redis_host: str = "localhost"
redis_port: int = 6379
redis_db: int = 0
redis_password: Optional[str] = None

# Task Streams
asr_stream: str = "tasks:asr"
agent_stream: str = "tasks:agent"
results_stream: str = "results"
```

### 2.4 TEN Extension 配置

#### GLM LLM Extension (ten_agent/ten_packages/extension/glm_llm_python/)

**Property 配置 (manifest.json 中定义):**
```json
{
  "api_key": "string - GLM API Key (从 property.json 或环境变量读取)",
  "model": "string - 模型名称 (默认: glm-4-plus)",
  "max_tokens": "int - 最大生成 Token 数",
  "temperature": "float - 温度参数 (0-1)",
  "enable_tools": "bool - 是否启用 Tool Calling (默认: true)"
}
```

**API 端点:**
- Base URL: `https://open.bigmodel.cn/api/paas/v4/`
- 使用 OpenAI 兼容的客户端库

#### FunASR ASR Extension (本地，无需 API)
- 使用开源 FunASR 模型
- 无需密钥配置
- 离线运行

#### CosyVoice TTS Extension (本地，无需 API)
- 使用开源 CosyVoice 模型
- 可本地运行或使用远程服务
- 配置 `COSYVOICE_SERVER` 环境变量

## 3. 配置步骤

### Step 1: 准备 Backend 环境变量

创建 `backend/.env`:
```bash
PORT=3001
NODE_ENV=development
ASR_PROVIDER=volcengine

# 选择其中一个配置
# 火山引擎
VOLCENGINE_APP_ID=your_app_id
VOLCENGINE_TOKEN=your_token

# 或阿里云
# ALIBABA_APP_KEY=your_key
# ALIBABA_ACCESS_KEY_ID=your_id
# ALIBABA_ACCESS_KEY_SECRET=your_secret
# ALIBABA_REGION=cn-shanghai
```

### Step 2: 准备 TEN Agent 环境变量

创建 `ten_agent/.env`:
```bash
GLM_API_KEY=your_glm_api_key
REDIS_HOST=localhost
REDIS_PORT=6379
BACKEND_WEBHOOK_URL=http://localhost:3001/api/agent
```

### Step 3: 配置 property.json (TEN Framework)

```json
{
  "glm_llm_python": {
    "api_key": "${GLM_API_KEY}",
    "model": "glm-4-plus",
    "max_tokens": 500,
    "temperature": 0.95,
    "enable_tools": true
  },
  "cosyvoice_tts_python": {
    "server_url": "${COSYVOICE_SERVER:http://localhost:8000}"
  },
  "funasr_asr_python": {
    "model": "damo/speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
  }
}
```

### Step 4: 启动服务

```bash
# 启动 Backend
cd backend
npm install
npm start

# 启动 Redis
redis-server

# 启动 TEN Agent
cd ten_agent
python -m ten.framework

# 启动 Frontend
cd frontend
npm install
npm run dev
```

## 4. API 获取指南

### 4.1 火山引擎 (Volcengine)

1. 访问 https://console.volcengine.com/
2. 创建应用 → 语音识别
3. 获取 `AppID` 和 `Token`
4. 文档: https://www.volcengine.com/docs/6349/81454

### 4.2 阿里云 (Alibaba Cloud)

1. 访问 https://console.aliyun.com/
2. 开通 NLS 语音识别服务
3. 创建 RAM 用户获取 `Access Key`
4. 获取 `AppKey`
5. 文档: https://help.aliyun.com/zh/nlp

### 4.3 智谱 GLM API

1. 访问 https://open.bigmodel.cn/
2. 注册账户并认证
3. 创建 API Key
4. 文档: https://open.bigmodel.cn/dev/howuse
5. 模型列表: glm-4, glm-4-plus, glm-4-air 等

## 5. Docker Compose 方式

```yaml
version: '3.8'

services:
  backend:
    image: node:18
    working_dir: /app/backend
    environment:
      - PORT=3001
      - ASR_PROVIDER=volcengine
      - VOLCENGINE_APP_ID=${VOLCENGINE_APP_ID}
      - VOLCENGINE_TOKEN=${VOLCENGINE_TOKEN}
    ports:
      - "3001:3001"
    command: npm start

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  ten_agent:
    image: python:3.10
    working_dir: /app/ten_agent
    environment:
      - GLM_API_KEY=${GLM_API_KEY}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - BACKEND_WEBHOOK_URL=http://backend:3001/api/agent
    depends_on:
      - redis
      - backend
    command: python -m ten.framework

  frontend:
    image: node:18
    working_dir: /app/frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
    command: npm run dev
```

## 6. 验证检查表

- [ ] Backend `.env` 已配置 (ASR_PROVIDER + 相关密钥)
- [ ] Redis 已启动运行
- [ ] GLM API Key 已配置在 ten_agent/.env
- [ ] Backend 可访问 http://localhost:3001/health
- [ ] WebSocket 可连接 ws://localhost:3001/ws/asr
- [ ] TEN Agent 可启动 (检查 log 无错误)
- [ ] Frontend 可访问 http://localhost:3000
