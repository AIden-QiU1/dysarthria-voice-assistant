# 🔥 燃言 VoxFlame Agent

<p align="center">
  <img src="docs/assets/voxflame-logo.svg" alt="VoxFlame Logo" width="200">
</p>

<h3 align="center">🎤 点燃你的声音 · Ignite Your Voice</h3>

<p align="center">
  <strong>为2000万构音障碍患者打造的AI实时会话支持人</strong><br>
  <em>让每一个声音都被听见、被理解、被实现</em>
</p>

<p align="center">
  <a href="#愿景">愿景</a> •
  <a href="#核心功能">核心功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#架构设计">架构设计</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#开发计划">开发计划</a>
</p>

---

## 🔥️ 品牌释义

| 中文 | 英文 | 含义 |
|------|------|------|
| **燃言** | **VoxFlame** | Vox(拉丁语:声音) + Flame(火焰) = 点燃声音 |

> **品牌故事**  
> 每一个构音障碍患者心中，都有想说却说不出的话。  
> 燃言，点燃你的声音，让世界听见你。

**中文口号**: 点燃你的声音  
**英文口号**: Ignite Your Voice

---

## 🌟 愿景

**市场规模**: 中国有 **2000万** 构音障碍患者（包括1200-1500万构音障碍+老年人群体）

**核心问题**:
- 62% 患者有抑郁倾向，68% 因沟通困难减少外出
- 普通ASR对构音障碍语音识别准确率 < 30%（WER > 70%）
- 紧急场景（呼救/医疗）无法表达，危及生命安全
- 日常沟通需要家人"翻译"，每天额外2-3小时负担

**VoxFlame的使命**:

> 不是"纠正"用户的发音，而是**理解**用户的意图。  
> **帮助残疾人迈出主动沟通的第一步** - 在实际沟通场景中的AI会话支持人/主持人。

---

## ✨ 核心功能（MVP V0.1）

### 🎯 实时会话支持人

#### 🎤 **高精度构音障碍ASR**
- **自定义FunASR模型**: 基于SenseVoice-small，针对构音障碍训练
- **Hotwords支持**: 动态学习用户常用表达（"燃言"、"帮我"、"喝水"）
- **VAD集成**: Silero VAD精准检测语音活动

#### 🧠 **个性化LLM理解**
- **GLM-4 Flash**: 理解用户意图，简短清晰回复
- **Memory管理**: PowerMem + OceanBase，记住用户习惯
- **Turn Detection**: AI理解话轮完成（非简单VAD），适配患者说话节奏

#### 🔊 **自然TTS输出**
- **CosyVoice**: 高质量中文TTS，可调语速
- **后期可微调**: 针对用户学习标准发音

#### 📊 **数据贡献模块**
- **用户数据收集**: 构音障碍语音样本（匿名化）
- **Supabase存储**: 用于模型持续训练

---

## 🏗️ 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14 PWA)                │
│  • WebSocket Client • Agora RTC (future) • PWA Offline     │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket (base64 PCM 16kHz)
                     │ HTTP REST API
┌────────────────────┴────────────────────────────────────────┐
│                Backend (Express + TypeScript)                │
│  • TEN Agent HTTP Client (start/stop session)              │
│  • Memory Management API (Supabase)                         │
│  • Hotwords Extraction & Update                             │
│  • Session Logging                                          │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             │                        │ Supabase Client
             │                        ▼
             │              ┌──────────────────────┐
             │              │  Supabase PostgreSQL │
             │              │  • User Profiles     │
             │              │  • Session Logs      │
             │              │  • Memory Sync       │
             │              └──────────────────────┘
             │
             │ HTTP API (start/stop)
             ▼
┌─────────────────────────────────────────────────────────────┐
│              TEN Agent Framework (Python)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  websocket_server (port 8765)                        │  │
│  │    ↓ PCM audio                                       │  │
│  │  Silero VAD                                          │  │
│  │    ↓ voice segments                                  │  │
│  │  FunASR (custom model + hotwords)                    │  │
│  │    ↓ text_data                                       │  │
│  │  main_python (PowerMem + Turn Detection)             │  │
│  │    ↓ user query + memory context                     │  │
│  │  GLM-4 LLM (with Tools)                              │  │
│  │    ↓ assistant response                              │  │
│  │  CosyVoice TTS                                       │  │
│  │    ↓ PCM audio → websocket_server                    │  │
│  │                                                       │  │
│  │  text_webhook → Backend API                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PowerMem Memory Management                          │  │
│  │    ↓ stores to                                       │  │
│  │  OceanBase SeekDB (Docker)                           │  │
│  │    ↑ Backend reads for analytics                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 数据流程

**会话开始**:
```
Frontend → Backend POST /api/session/start
Backend → TEN Agent HTTP API (generate WebSocket port)
TEN Agent → PowerMem load user memories
TEN Agent → Return {ws_port: 8765}
Frontend → Connect WebSocket ws://localhost:8765
```

**实时对话**:
```
User speaks → Frontend captures audio → WebSocket → TEN Agent
TEN Agent: PCM → VAD → FunASR (+ hotwords) → ASR text
main_python: Search PowerMem for relevant memories
main_python: Inject memory context into prompt
GLM-4: Generate response (with Tool Calling)
CosyVoice: Text → PCM audio
TEN Agent → WebSocket → Frontend → Play audio
text_webhook: Send ASR+LLM results → Backend API
Backend: Store to Supabase + analyze hotwords
```

**会话结束**:
```
Frontend → Backend POST /api/session/stop
Backend → TEN Agent HTTP API (stop session)
TEN Agent → PowerMem save new memories → OceanBase
Backend → Sync memories from OceanBase to Supabase
Backend → Extract hotwords from session logs
Backend → Update TEN Agent hotwords config (for next session)
```

---

## 🛠️ 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **Frontend** | Next.js 14 | PWA，支持离线 |
| | TypeScript | 类型安全 |
| | Tailwind CSS | 样式框架 |
| | WebSocket Client | 实时音频传输 |
| | MediaRecorder API | 浏览器录音 |
| **Backend** | Express | Node.js服务器 |
| | TypeScript | 类型安全 |
| | Supabase Client | PostgreSQL数据库 |
| | Mem0 (optional) | Memory管理框架 |
| **TEN Agent** | TEN Framework | 实时AI Agent框架 |
| | Python 3.10+ | Extension开发语言 |
| | **FunASR** | 自定义ASR（SenseVoice-small + hotwords） |
| | **GLM-4 Flash** | 智谱AI大模型 |
| | **CosyVoice** | 阿里通义实验室TTS |
| | **PowerMem** | OceanBase长短期记忆管理 |
| | Silero VAD | 语音活动检测 |
| | websocket_server | WebSocket transport |
| | text_webhook | 数据回传Backend |
| **Memory** | OceanBase SeekDB | TEN Agent本地记忆存储 |
| | Supabase PostgreSQL | Backend中心化数据管理 |
| **Infrastructure** | Docker Compose | 容器编排 |
| | Redis | Session缓存 |
| | Nginx (future) | 负载均衡 |

---

## 🚀 快速开始

### 环境要求
```bash
Node.js 18+
Python 3.10+
Docker & Docker Compose
CUDA 11.8+ (for FunASR GPU acceleration)
```

### 安装步骤

#### 1. 克隆仓库
```bash
git clone https://github.com/yourusername/VoxFlame-Agent.git
cd VoxFlame-Agent
```

#### 2. 配置环境变量
```bash
# Backend (.env)
cp backend/.env.example backend/.env

# TEN Agent (.env)
cp ten_agent/.env.example ten_agent/.env

# Frontend (.env.local)
cp frontend/.env.example frontend/.env.local
```

**Backend .env**:
```env
PORT=3001
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TEN_AGENT_API_URL=http://localhost:8080
```

**TEN Agent .env**:
```env
GLM_API_KEY=your_glm_api_key
COSY_TTS_API_KEY=your_dashscope_api_key
BACKEND_WEBHOOK_URL=http://localhost:3001/api/webhook/ten-agent
OCEANBAS_HOST=localhost
OCEANBASE_PORT=2881
OCEANBASE_USER=root
OCEANBASE_PASSWORD=root
OCEANBASE_DATABASE=voxflame
```

**Frontend .env.local**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### 3. 启动服务

**方式A: Docker Compose（推荐）**
```bash
docker-compose up -d
```

**方式B: 手动启动**
```bash
# 1. 启动OceanBase
docker run -d --name oceanbase-seekdb \
  -p 2881:2881 -p 2886:2886 \
  -e ROOT_PASSWORD=root \
  -e SEEKDB_DATABASE=voxflame \
  oceanbase/seekdb:latest

# 2. 启动Backend
cd backend
npm install
npm run dev  # Port 3001

# 3. 启动TEN Agent
cd ten_agent
pip install -r requirements.txt
python main.py  # Port 8080

# 4. 启动Frontend
cd frontend
npm install
npm run dev  # Port 3000
```

#### 4. 访问应用
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- TEN Agent API: http://localhost:8080

---

## 📋 开发计划

### MVP V0.1（当前阶段）
- [x] ✅ TEN Agent property.json配置（WebSocket架构）
- [x] ✅ 自定义FunASR extension (hotwords支持)
- [x] ✅ GLM-4 LLM extension
- [x] ✅ CosyVoice TTS extension
- [x] ✅ Supabase数据库schema
- [x] ✅ Backend Supabase客户端
- [x] ✅ Backend Memory管理API (7个端点)
- [ ] 🔄 PowerMem + OceanBase集成


- [ ] 🔄 Frontend WebSocket client
- [ ] 🔄 Docker Compose部署
- [ ] 🔄 端到端测试

### MVP V0.2（规划中）
- [ ] Turn Detection集成（Cerebrium or GLM-4判断）
- [ ] Hotwords动态更新（Backend分析→TEN Agent reload）
- [ ] Frontend记忆展示页面
- [ ] ASR模型针对构音障碍fine-tuning
- [ ] 多TEN Agent实例部署（Nginx负载均衡）

### 未来功能
- [ ] Agora RTC视频通话（看嘴型辅助）
- [ ] 电话实时助手（Twilio集成）
- [ ] AAC图片交流增强
- [ ] 多语言支持（英文、粤语）

---

## 📚 技术文档

- [API文档](docs/API_SPECIFICATION.md)
- [用户研究](docs/USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md)
- [TEN Framework集成](docs/TEN_FRAMEWORK_INTEGRATION.md)

---

## 🤝 贡献指南

欢迎贡献！请阅读[贡献指南](CONTRIBUTING.md)了解详情。

---

## 📄 许可证

[MIT License](LICENSE)

---

<p align="center">
  <strong>🔥 燃言 · 点燃每一个声音 🔥</strong>
</p>
