# 正确架构 - TEN Agent直接作为Redis Worker

## 核心理解

**TEN Agent本身就是Worker，不需要额外wrapper**

```
Backend (Express + WebSocket)
  ↓
Redis Stream "tasks:ten_agent"
  ↓ (Consumer Group)
TEN Agent Process 1 (直接消费Redis)
TEN Agent Process 2
TEN Agent Process N
  ↓
Redis Stream "results:ten_agent"
  ↓
Backend (读取结果 → WebSocket → Frontend)
```

## TEN Agent启动方式

```bash
# 单个TEN Agent Worker
python -m ten_agent.main --redis-mode --worker-id worker-1

# 多个Worker (高并发)
python -m ten_agent.main --redis-mode --worker-id worker-1 &
python -m ten_agent.main --redis-mode --worker-id worker-2 &
python -m ten_agent.main --redis-mode --worker-id worker-3 &
```

## Backend集成

```typescript
// backend/src/services/redis-client.service.ts
class RedisClientService {
  async publishTask(userId: string, audioData: Buffer) {
    await redis.xadd('tasks:ten_agent', '*', {
      'user_id': userId,
      'audio': audioData.toString('base64'),
      'timestamp': Date.now()
    })
  }
  
  async consumeResults(callback) {
    // XREADGROUP consumer group
  }
}
```

## 无AI Workers
- agent-sdk BaseWorker仅为框架预留
- 当前项目无需实现Worker子类
- TEN Agent = 完整Worker实现
