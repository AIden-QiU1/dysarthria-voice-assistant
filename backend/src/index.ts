import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { ASRController } from './controllers/asr.controller'
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

// WebSocket 连接处理 - 使用控制器
wss.on('connection', ASRController.handleConnection)

// 错误处理中间件
app.use(errorHandler)

// 启动服务器
server.listen(PORT, () => {
  console.log(`\n🚀 语音服务已启动`)
  console.log(`📡 HTTP 服务地址: http://localhost:${PORT}`)
  console.log(`🔌 WebSocket 地址: ws://localhost:${PORT}/ws/asr`)
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`)
  
  const provider = process.env.ASR_PROVIDER === 'alibaba' ? '阿里云 (Alibaba Cloud)' : '火山引擎 (Volcengine)'
  console.log(`\n🎙️  当前使用的语音引擎: ${provider}\n`)
})

export default app
