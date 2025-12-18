import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { WebSocketProtocol } from './websocket-protocol'
import { ASRServiceInterface } from './asr-service.interface'
import { EventEmitter } from 'events'

/**
 * 火山引擎流式语音识别服务
 * 使用 WebSocket 协议实现实时语音识别
 */
export class VolcengineASRStreamingService extends EventEmitter implements ASRServiceInterface {
  private appId: string
  private token: string
  private ws: WebSocket | null = null
  private connectId: string = ''
  private isConnected: boolean = false

  // WebSocket 端点 - 双向流式模式（优化版本）
  private readonly wsUrl = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'
  // 资源 ID - 小时版
  private readonly resourceId = 'volc.bigasr.sauc.duration'

  constructor() {
    super()
    this.appId = process.env.VOLCENGINE_APP_ID || ''
    this.token = process.env.VOLCENGINE_TOKEN || ''

    if (!this.appId || !this.token) {
      console.warn('警告: 火山引擎配置不完整，请检查环境变量 VOLCENGINE_APP_ID 和 VOLCENGINE_TOKEN')
    }
  }

  /**
   * 建立 WebSocket 连接
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectId = uuidv4()

        // 构建 WebSocket 连接，添加认证 Headers
        this.ws = new WebSocket(this.wsUrl, {
          headers: {
            'X-Api-App-Key': this.appId,
            'X-Api-Access-Key': this.token,
            'X-Api-Resource-Id': this.resourceId,
            'X-Api-Connect-Id': this.connectId,
          },
        })

        // 连接打开
        this.ws.on('open', () => {
          console.log('WebSocket 连接已建立, Connect-Id:', this.connectId)
          this.isConnected = true

          // 发送 full client request
          this.sendFullClientRequest()
          resolve()
        })

        // 接收消息
        this.ws.on('message', (data: Buffer) => {
          this.handleServerResponse(data)
        })

        // 连接错误
        this.ws.on('error', (error) => {
          console.error('WebSocket 错误:', error)
          this.isConnected = false
          this.emit('error', error)
          reject(error)
        })

        // 连接关闭
        this.ws.on('close', (code, reason) => {
          console.log('WebSocket 连接已关闭, Code:', code, 'Reason:', reason.toString())
          this.isConnected = false
          this.emit('close', { code, reason: reason.toString() })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 发送 full client request（包含配置参数）
   */
  private sendFullClientRequest(): void {
    const request = {
      user: {
        uid: 'web_client_' + Date.now(),
      },
      audio: {
        format: 'pcm', // 前端使用 AudioContext 处理为 PCM
        codec: 'raw',
        rate: 16000,
        bits: 16,
        channel: 1,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true, // 文本规范化
        enable_punc: true, // 启用标点
        enable_ddc: false, // 语义顺滑
        show_utterances: true, // 输出分句信息
        result_type: 'single', // 增量返回（只返回新增的分句）
        vad_segment_duration: 1500, // 语义切句的最大静音阈值 1.5秒
      },
    }

    const message = WebSocketProtocol.buildFullClientRequest(request)
    this.ws?.send(message)
    console.log('已发送 full client request')
  }

  /**
   * 发送音频数据
   */
  sendAudioData(audioData: Buffer, isLast: boolean = false): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket 未连接，无法发送音频数据')
      return
    }

    const message = WebSocketProtocol.buildAudioOnlyRequest(audioData, isLast)
    this.ws.send(message)

    if (isLast) {
      console.log('已发送最后一包音频数据（负包）')
    }
  }

  /**
   * 处理服务器响应
   */
  private handleServerResponse(data: Buffer): void {
    try {
      console.log('收到火山引擎响应, 大小:', data.length, 'bytes')
      console.log('前16字节:', data.subarray(0, Math.min(16, data.length)).toString('hex'))

      const response = WebSocketProtocol.parseServerResponse(data)

      // 错误响应
      if (response.error) {
        console.error('服务器返回错误:', response.error)
        this.emit('error', response.error)
        return
      }

      // 识别结果
      if (response.payload && response.payload.result) {
        const result = response.payload.result
        console.log('识别结果:', result.text)

        // 打印 utterances 详情
        if (result.utterances) {
          console.log('分句数量:', result.utterances.length)
          result.utterances.forEach((u: any, i: number) => {
            console.log(`  [${i}] definite: ${u.definite}, text: "${u.text}"`)
          })
        }

        // 发送识别结果事件
        this.emit('result', {
          text: result.text,
          utterances: result.utterances || [],
          isFinal:
            response.messageFlags === WebSocketProtocol.MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE ||
            response.messageFlags === WebSocketProtocol.MESSAGE_FLAGS.LAST_PACKET_NO_SEQUENCE,
        })
      }

      // 记录 logid
      if (response.payload && response.payload.logid) {
        console.log('Server Logid:', response.payload.logid)
      }
    } catch (error) {
      console.error('解析服务器响应失败:', error)
      this.emit('error', error)
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  /**
   * 获取服务提供商名称
   */
  getProviderName(): string {
    return 'Volcengine'
  }

  /**
   * 检查是否已连接
   */
  isReady(): boolean {
    return this.isConnected
  }
}
