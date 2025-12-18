# Backend 架构说明

## 目录结构

```
src/
├── controllers/          # 控制器层
│   └── asr.controller.ts    # ASR WebSocket 控制器
├── services/            # 服务层
│   ├── asr-service.interface.ts            # ASR 服务统一接口
│   ├── asr-service.factory.ts              # ASR 服务工厂
│   ├── volcengine-asr-streaming.service.ts  # 火山引擎流式ASR服务
│   ├── alibaba-asr-streaming.service.ts     # 阿里云流式ASR服务
│   ├── volcengine-asr.service.ts             # 火山引擎ASR基础服务
│   └── websocket-protocol.ts                 # WebSocket协议处理
├── middlewares/         # 中间件层
│   └── error.middleware.ts  # 错误处理中间件
├── types/              # 类型定义
│   └── asr.types.ts       # ASR相关类型定义
└── index.ts            # 应用入口文件
```

## 架构说明

### 1. 控制器层 (Controllers)
负责处理 WebSocket 连接和消息路由，不包含业务逻辑。

**文件：** `controllers/asr.controller.ts`
- 处理客户端 WebSocket 连接
- 使用工厂模式创建 ASR 服务实例
- 转发识别结果到客户端
- 管理连接生命周期

### 2. 服务层 (Services)
包含核心业务逻辑和外部服务集成。

**统一接口：** `services/asr-service.interface.ts`
- 定义所有 ASR 服务提供商必须实现的接口
- 使用 EventEmitter 实现事件驱动架构
- 提供标准方法：connect(), sendAudioData(), close(), getProviderName()

**服务工厂：** `services/asr-service.factory.ts`
- 根据环境变量创建不同的 ASR 服务提供商实例
- 支持的提供商：火山引擎 (volcengine)、阿里云 (alibaba)
- 统一的服务创建接口

**具体实现：**
- `services/volcengine-asr-streaming.service.ts` - 火山引擎流式语音识别服务
- `services/alibaba-asr-streaming.service.ts` - 阿里云流式语音识别服务
- `services/volcengine-asr.service.ts` - 火山引擎 ASR 基础服务
- `services/websocket-protocol.ts` - WebSocket 协议处理

### 3. 中间件层 (Middlewares)
处理跨切面关注点，如错误处理、日志等。

**文件：**
- `middlewares/error.middleware.ts` - 统一错误处理

### 4. 类型定义 (Types)
TypeScript 类型定义，提高代码类型安全。

**文件：**
- `types/asr.types.ts` - ASR 相关接口和类型定义

## 数据流

```
客户端 WebSocket
    ↓
ASR Controller (处理连接)
    ↓
ASR Service Factory (创建服务实例)
    ↓
具体 ASR 服务 (火山引擎/阿里云)
    ↓
ASR Controller (转发结果)
    ↓
客户端 WebSocket
```

## 切换 ASR 服务提供商

在 `.env` 文件中设置 `ASR_PROVIDER` 环境变量：

```env
# 使用火山引擎（默认）
ASR_PROVIDER=volcengine

# 或使用阿里云
ASR_PROVIDER=alibaba
```

每个提供商需要配置相应的 API 凭证：

**火山引擎：**
- VOLCENGINE_APP_ID
- VOLCENGINE_TOKEN

**阿里云：**
- ALIBABA_APP_KEY
- ALIBABA_ACCESS_KEY_ID
- ALIBABA_ACCESS_KEY_SECRET

## 添加新的 ASR 服务提供商

1. 创建新的服务类，实现 `ASRServiceInterface` 接口
2. 在 `asr-service.factory.ts` 中添加新的提供商选项
3. 在 `.env.example` 中添加相应的环境变量说明

## 优势

1. **关注点分离** - 控制器、服务、中间件各司其职
2. **易于测试** - 每个模块可独立测试
3. **可维护性** - 清晰的架构便于代码维护
4. **可扩展性** - 易于添加新的服务提供商或中间件
5. **类型安全** - TypeScript 类型定义提供编译时检查
6. **统一接口** - 所有 ASR 服务提供商使用相同的接口，便于切换
7. **工厂模式** - 集中管理服务实例创建，简化配置
