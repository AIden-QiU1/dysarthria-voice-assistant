import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { ASRServiceInterface } from './asr-service.interface'
import { EventEmitter } from 'events'
import RPCClient from '@alicloud/pop-core'

/**
 * 阿里云实时语音识别服务
 * 使用 WebSocket 协议实现实时语音识别
 */
export class AlibabaASRStreamingService extends EventEmitter implements ASRServiceInterface {
  private appKey: string
  private accessKeyId: string
  private accessKeySecret: string
  private ws: WebSocket | null = null
  private taskId: string = ''
  private isConnected: boolean = false
  private region: string
  private metaEndpoint: string
  private apiVersion: string = '2019-02-28'
  private cachedToken: { id: string; expireTime: number } | null = null

  private wsUrl: string

  constructor() {
    super()
    this.appKey = process.env.ALIBABA_APP_KEY || ''
    this.accessKeyId = process.env.ALIBABA_ACCESS_KEY_ID || ''
    this.accessKeySecret = process.env.ALIBABA_ACCESS_KEY_SECRET || ''
    this.region = process.env.ALIBABA_REGION || 'cn-shanghai'
    this.metaEndpoint = `https://nls-meta.${this.region}.aliyuncs.com`
    this.wsUrl = `wss://nls-gateway.${this.region}.aliyuncs.com/ws/v1`

    if (!this.appKey || !this.accessKeyId || !this.accessKeySecret) {
      console.warn(
        '警告: 阿里云配置不完整，请检查环境变量 ALIBABA_APP_KEY, ALIBABA_ACCESS_KEY_ID, ALIBABA_ACCESS_KEY_SECRET'
      )
    }
  }

  /**
   * 获取访问 Token（使用阿里云 POP-Core）
   * 缓存有效期内的 Token，减少请求次数
   */
  private async fetchAccessToken(): Promise<string> {
    // 使用缓存的 token
    const now = Math.floor(Date.now() / 1000)
    if (this.cachedToken && this.cachedToken.expireTime - now > 60) {
      return this.cachedToken.id
    }

    const client = new RPCClient({
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      endpoint: this.metaEndpoint,
      apiVersion: this.apiVersion,
    })

    const res = (await client.request('CreateToken', {}, { method: 'POST' })) as any

    const token = res?.Token?.Id || res?.Token?.id || res?.Token
    const expire = res?.Token?.ExpireTime || res?.Token?.expireTime || 0

    if (!token) {
      throw new Error('获取阿里云访问 Token 失败')
    }

    // 记录缓存
    const expireTimeSec =
      typeof expire === 'number'
        ? expire
        : Math.floor(Date.now() / 1000) + 3500 // 若返回不含过期时间，默认 1h 有效

    this.cachedToken = { id: token, expireTime: expireTimeSec }
    return token
  }

  /**
   * 生成32位UUID (不带横杠)
   */
  private generateUuid(): string {
    return uuidv4().replace(/-/g, '')
  }

  /**
   * 建立 WebSocket 连接
   */
  async connect(): Promise<void> {
    try {
      this.taskId = this.generateUuid()
      const token = await this.fetchAccessToken()

      return new Promise((resolve, reject) => {
        try {
          // 构建 WebSocket URL
          const url = `${this.wsUrl}?appkey=${this.appKey}&token=${encodeURIComponent(token)}`

          this.ws = new WebSocket(url)

          // 连接打开
          this.ws.on('open', () => {
            console.log('阿里云 WebSocket 连接已建立, Task-Id:', this.taskId)
            this.isConnected = true

            // 发送开始识别命令
            this.sendStartCommand()
            resolve()
          })

          // 接收消息
          this.ws.on('message', (data: Buffer) => {
            this.handleServerResponse(data)
          })

          // 连接错误
          this.ws.on('error', (error) => {
            console.error('阿里云 WebSocket 错误:', error)
            this.isConnected = false
            this.emit('error', error)
            reject(error)
          })

          // 连接关闭
          this.ws.on('close', (code, reason) => {
            console.log('阿里云 WebSocket 连接已关闭, Code:', code, 'Reason:', reason.toString())
            this.isConnected = false
            this.emit('close', { code, reason: reason.toString() })
          })
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      console.error('连接阿里云失败:', error)
      throw error
    }
  }

  /**
   * 发送开始识别命令
   */
  private sendStartCommand(): void {
    const startCommand = {
      header: {
        message_id: this.generateUuid(),
        task_id: this.taskId,
        namespace: 'SpeechTranscriber',
        name: 'StartTranscription',
        appkey: this.appKey,
      },
      payload: {
        format: 'pcm',
        sample_rate: 16000,
        enable_intermediate_result: true, // 启用中间结果
        enable_punctuation_prediction: true, // 启用标点预测
        enable_inverse_text_normalization: true, // 启用数字转换
      },
    }

    this.ws?.send(JSON.stringify(startCommand))
    console.log('已发送阿里云开始识别命令')
  }

  /**
   * 发送音频数据
   */
  sendAudioData(audioData: Buffer, isLast: boolean = false): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket 未连接，无法发送音频数据')
      return
    }

    if (isLast) {
      // 发送停止识别命令
      const stopCommand = {
        header: {
          message_id: this.generateUuid(),
          task_id: this.taskId,
          namespace: 'SpeechTranscriber',
          name: 'StopTranscription',
          appkey: this.appKey,
        },
      }
      this.ws.send(JSON.stringify(stopCommand))
      console.log('已发送阿里云停止识别命令')
    } else if (audioData.length > 0) {
      // 发送音频数据（二进制）
      this.ws.send(audioData)
    }
  }

  /**
   * 处理服务器响应
   */
  private handleServerResponse(data: Buffer): void {
    try {
      // 尝试解析为 JSON
      const text = data.toString('utf-8')

      // 跳过非 JSON 响应（如心跳包）
      if (!text.startsWith('{')) {
        return
      }

      const response = JSON.parse(text)

      // 错误响应
      if (response.header && response.header.status !== 20000000) {
        const error = `阿里云错误: ${response.header.status_text || '未知错误'}`
        console.error(error)
        this.emit('error', error)
        return
      }

      // 识别结果
      if (response.header && response.header.name === 'TranscriptionResultChanged') {
        const payload = response.payload
        if (payload && payload.result) {
          console.log('阿里云识别结果:', payload.result)

          // 发送识别结果事件（转换为统一格式）
          this.emit('result', {
            text: payload.result,
            utterances: [],
            isFinal: false,
          })
        }
      }

      // 识别完成
      if (response.header && response.header.name === 'TranscriptionCompleted') {
        const payload = response.payload
        if (payload && payload.result) {
          console.log('阿里云最终识别结果:', payload.result)

          // 发送最终识别结果
          this.emit('result', {
            text: payload.result,
            utterances: [],
            isFinal: true,
          })
        }
      }
    } catch (error) {
      console.error('解析阿里云服务器响应失败:', error)
      // 可能是二进制音频数据，忽略
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
    return 'Alibaba Cloud'
  }

  /**
   * 检查是否已连接
   */
  isReady(): boolean {
    return this.isConnected
  }
}
