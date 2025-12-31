import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { ASRController } from './controllers/asr.controller'
import { agentRouter } from './controllers/agent.controller'
import sessionRouter from './controllers/session.controller'
import { memoryController } from './controllers/memory.controller'
import { errorHandler } from './middlewares/error.middleware'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors())
app.use(express.json())

// 创建 HTTP 服务器
const server = createServer(app)

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server, path: '/ws/asr' })

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '语音识别服务运行正常' })
})

// Agent API 路由 (TEN Webhook)
app.use('/api/agent', agentRouter)

// Session API 路由 (NEW)
app.use('/api/session', sessionRouter)

// Memory API 路由 (NEW)
const memoryRouter = express.Router()
memoryRouter.post('/add', memoryController.addMemory.bind(memoryController))
memoryRouter.get('/search', memoryController.searchMemories.bind(memoryController))
memoryRouter.get('/user/:userId', memoryController.getUserMemories.bind(memoryController))
memoryRouter.put('/:memoryId', memoryController.updateMemory.bind(memoryController))
memoryRouter.delete('/:memoryId', memoryController.deleteMemory.bind(memoryController))
memoryRouter.get('/hotwords/:userId', memoryController.getHotwords.bind(memoryController))
memoryRouter.get('/stats/:userId', memoryController.getUserStats.bind(memoryController))
app.use('/api/memory', memoryRouter)

// WebSocket 连接处理 - 使用控制器
wss.on('connection', ASRController.handleConnection)

// 错误处理中间件
app.use(errorHandler)

// 启动服务器
server.listen(PORT, () => {
  console.log(`\n🚀 VoxFlame Backend 已启动`)
  console.log(`📡 HTTP 服务地址: http://localhost:${PORT}`)
  console.log(`🔌 WebSocket 地址: ws://localhost:${PORT}/ws/asr`)
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`)
  
  console.log(`\n🤖 Agent API 端点:`)
  console.log(`   - GET  /api/agent/profile/:userId`)
  console.log(`   - PUT  /api/agent/profile/:userId`)
  console.log(`   - POST /api/agent/session/log`)
  console.log(`   - GET  /api/agent/session/:userId/:sessionId`)
  console.log(`   - POST /api/agent/tool/execute`)
  console.log(`   - GET  /api/agent/hotwords/:userId`)
  
  console.log(`\n💾 Memory API 端点:`)
  console.log(`   - POST /api/memory/add`)
  console.log(`   - GET  /api/memory/search?user_id=xxx&query=...`)
  console.log(`   - GET  /api/memory/user/:userId`)
  console.log(`   - PUT  /api/memory/:memoryId`)
  console.log(`   - DELETE /api/memory/:memoryId`)
  console.log(`   - GET  /api/memory/hotwords/:userId`)
  console.log(`   - GET  /api/memory/stats/:userId`)
  
  const provider = process.env.ASR_PROVIDER === 'alibaba' ? '阿里云 (Alibaba Cloud)' : '火山引擎 (Volcengine)'
  console.log(`\n🎙️  当前使用的语音引擎: ${provider}\n`)
})

export default app
