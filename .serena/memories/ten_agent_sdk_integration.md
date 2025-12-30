# TEN Agent + agent-sdk 协作架构

## 1. 最终架构理解

### 分工明确
```
agent-sdk (基础设施层)
  ├─ Redis Stream 消息队列
  ├─ Worker Manager 进程/线程管理
  ├─ Task Dispatcher 任务分发
  └─ Load Balancer 负载均衡
  
TEN Agent (Agent逻辑层)  
  ├─ FunASR Extension (ASR逻辑)
  ├─ GLM-4 Extension (LLM逻辑)
  ├─ CosyVoice Extension (TTS逻辑)
  └─ Backend Webhook Extension (业务集成)
```

### 协作模式
```
多用户并发请求
  │
  ▼
Backend Express (WebSocket/HTTP)
  │
  ├─→ agent-sdk Redis Stream
  │     │
  │     ├─→ TEN Agent Worker 1 (处理User1)
  │     ├─→ TEN Agent Worker 2 (处理User2)
  │     └─→ TEN Agent Worker N (处理UserN)
  │
  └─→ Backend Webhook ←─ TEN Agent (会话记录/工具执行)
```

## 2. agent-sdk的角色

### 2.1 作为Worker框架
- **进程管理**: 启动/停止/重启Worker进程
- **线程池**: 每个Worker内部异步处理
- **数据管理**: Redis Stream作为任务队列
- **负载均衡**: 自动分发任务到空闲Worker
- **容错机制**: Worker崩溃自动重启

### 2.2 不负责Agent逻辑
- ❌ 不实现ASR算法
- ❌ 不实现LLM推理
- ❌ 不实现TTS合成
- ✅ 只负责"把任务交给谁"

## 3. TEN Agent的角色

### 3.1 作为Worker实例
- 每个TEN Agent进程是一个Worker
- 从Redis Stream消费任务
- 处理完成后返回结果

### 3.2 实现Agent逻辑
```python
# TEN Agent as Worker
from agent_sdk import BaseWorker

class TENAgentWorker(BaseWorker):
    worker_type = "ten_agent"
    
    async def process(self, task: dict) -> dict:
        # 初始化TEN Framework
        ten_env = TEN.create_env()
        
        # 加载Extensions
        ten_env.load_extension("funasr_asr")
        ten_env.load_extension("glm_llm")
        ten_env.load_extension("cosyvoice_tts")
        
        # 处理任务
        audio_data = task["audio"]
        result = await ten_env.process(audio_data)
        
        return {
            "text": result.text,
            "audio": result.audio,
            "status": "success"
        }
```

## 4. 数据流

### 单次请求完整流程
```
1. 用户说话 (Frontend采集音频)
   ↓
2. WebSocket发送到Backend
   ↓
3. Backend发布任务到Redis Stream
   {
     "task_id": "uuid",
     "user_id": "user_123",
     "audio": base64_encoded_audio,
     "timestamp": 1234567890
   }
   ↓
4. agent-sdk Worker Manager分配到TEN Agent Worker 3
   ↓
5. TEN Agent Worker 3处理:
   - FunASR ASR Extension: 音频→文本
   - GLM-4 LLM Extension: 文本→意图理解
   - CosyVoice TTS Extension: 文本→清晰语音
   ↓
6. 结果返回到Redis Stream
   {
     "task_id": "uuid",
     "result": {
       "asr_text": "我想喝水",
       "llm_intent": "request_water",
       "tts_audio": base64_encoded_audio
     }
   }
   ↓
7. Backend从Redis读取结果
   ↓
8. WebSocket发送给Frontend
   ↓
9. 扬声器播放清晰语音
```

## 5. 高并发处理

### 场景: 10个用户同时说话

```
User1, User2, ... User10
  │
  ▼
Backend (单个Express进程)
  │
  ├─→ Redis Stream (消息队列)
  │     ├─ Task1 (User1)
  │     ├─ Task2 (User2)
  │     └─ ...
  │
  └─→ agent-sdk Worker Manager
        │
        ├─→ TEN Agent Worker 1 → 处理Task1 (User1)
        ├─→ TEN Agent Worker 2 → 处理Task2 (User2)
        ├─→ TEN Agent Worker 3 → 处理Task3 (User3)
        └─→ TEN Agent Worker 4 → 空闲, 等待Task4
```

**优势**:
- Worker池自动伸缩 (按需启动4-10个Worker)
- Redis保证任务不丢失
- 单个Worker崩溃不影响其他用户

## 6. 配置文件

### 6.1 agent-sdk配置 (agent-sdk/agent_sdk/config.py)
```python
class SDKConfig:
    redis_host: str = "localhost"
    redis_port: int = 6379
    
    # Worker池配置
    min_workers: int = 2  # 最少保持2个Worker
    max_workers: int = 10  # 最多10个Worker
    worker_timeout: int = 30  # Worker超时30秒
    
    # 任务队列
    task_stream: str = "tasks:ten_agent"
    result_stream: str = "results:ten_agent"
```

### 6.2 TEN Agent配置 (ten_agent/property.json)
```json
{
  "worker_mode": true,
  "redis_config": {
    "host": "localhost",
    "port": 6379,
    "stream_name": "tasks:ten_agent"
  },
  "extensions": [
    {
      "name": "funasr_asr",
      "properties": {
        "model": "damo/speech_paraformer..."
      }
    },
    {
      "name": "glm_llm",
      "properties": {
        "api_key": "${GLM_API_KEY}",
        "model": "glm-4-plus"
      }
    },
    {
      "name": "cosyvoice_tts",
      "properties": {
        "server_url": "http://localhost:8000"
      }
    }
  ]
}
```

## 7. 启动顺序

### 7.1 开发环境
```bash
# 1. 启动Redis
redis-server

# 2. 启动Backend (Express + agent-sdk)
cd backend
npm run dev  # 端口3001

# 3. 启动TEN Agent Workers (agent-sdk自动管理)
cd agent-sdk
python -m agent_sdk.worker_manager \
  --worker-type ten_agent \
  --min-workers 2 \
  --max-workers 5

# 4. 启动Frontend
cd frontend
npm run dev  # 端口3000
```

### 7.2 生产环境 (Docker Compose)
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - redis
  
  ten-agent-worker:
    build: ./ten_agent
    deploy:
      replicas: 3  # 启动3个Worker实例
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
      - GLM_API_KEY=${GLM_API_KEY}
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

## 8. MVP开发计划 (修订)

### Week 1: agent-sdk + TEN Agent集成

**Task 1.1**: agent-sdk Worker Manager实现
- [ ] 阅读 `agent-sdk/agent_sdk/worker_base.py`
- [ ] 理解BaseWorker接口
- [ ] 实现TENAgentWorker类

**Task 1.2**: TEN Agent Worker模式适配
- [ ] TEN Framework支持Worker模式 (检查文档)
- [ ] 修改 `ten_agent/property.json` 添加`worker_mode`
- [ ] 从Redis Stream读取任务

**Task 1.3**: Backend集成Redis Stream
- [ ] Backend发布任务到Redis
- [ ] Backend订阅结果Stream
- [ ] WebSocket返回结果给Frontend

### Week 2: Frontend + 测试优化

**Task 2.1**: Frontend音频流处理
- [ ] MediaRecorder采集音频
- [ ] WebSocket发送音频chunk
- [ ] 接收TTS音频并播放

**Task 2.2**: 性能测试
- [ ] 单用户延迟测试 (< 2s)
- [ ] 10并发用户测试
- [ ] Worker池伸缩测试

**Task 2.3**: 真实用户测试
- [ ] 1位患者测试MVP
- [ ] 收集反馈优化

## 9. 关键代码位置

### agent-sdk框架
- `agent-sdk/agent_sdk/worker_base.py` - Worker基类
- `agent-sdk/agent_sdk/stream/stream_manager.py` - Redis Stream管理
- `agent-sdk/agent_sdk/pool/worker_manager.py` - Worker池管理

### TEN Agent Extensions
- `ten_agent/ten_packages/extension/funasr_asr_python/extension.py`
- `ten_agent/ten_packages/extension/glm_llm_python/extension.py`
- `ten_agent/ten_packages/extension/cosyvoice_tts_python/extension.py`

### Backend集成
- `backend/src/services/redis-stream.service.ts` (待创建)
- `backend/src/controllers/asr.controller.ts` (修改WebSocket)

## 10. 下一步行动

1. ✅ 写入此记忆 (`ten_agent_sdk_integration`)
2. ⏳ 安装Redis (Ubuntu: `apt install redis-server`)
3. ⏳ 使用Serena分析 `agent-sdk/agent_sdk/worker_base.py`
4. ⏳ 使用Context7查找TEN Framework Worker模式文档
5. ⏳ 实现TENAgentWorker类
6. ⏳ Backend集成Redis Stream

---

**最后更新**: 2025-12-29
**架构确认**: TEN Agent + agent-sdk 协作模式
