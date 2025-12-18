/**
 * ASR WebSocket 控制器
 */
import { WebSocket } from 'ws'
import { ASRServiceInterface } from '../services/asr-service.interface'
import { ASRServiceFactory } from '../services/asr-service.factory'
import { WebSocketMessage, ClientMessage, ASRResult } from '../types/asr.types'

export class ASRController {
  /**
   * 处理 WebSocket 连接
   */
  static handleConnection(clientWs: WebSocket): void {
    console.log('客户端已连接')

    // 使用工厂创建 ASR 服务实例（根据环境变量选择提供商）
    const asrService = ASRServiceFactory.create()
    console.log(`使用 ASR 服务提供商: ${asrService.getProviderName()}`)

    // 建立到 ASR 服务的连接
    ASRController.connectToASRService(clientWs, asrService)

    // 监听 ASR 识别结果
    ASRController.listenToASRResults(clientWs, asrService)

    // 监听 ASR 错误
    ASRController.listenToASRErrors(clientWs, asrService)

    // 监听 ASR 连接关闭
    ASRController.listenToASRClose(asrService)

    // 处理客户端消息
    ASRController.handleClientMessages(clientWs, asrService)

    // 客户端断开连接
    ASRController.handleClientDisconnect(clientWs, asrService)

    // 客户端连接错误
    ASRController.handleClientError(clientWs, asrService)
  }

  /**
   * 连接到 ASR 服务
   */
  private static connectToASRService(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    asrService
      .connect()
      .then(() => {
        console.log(`已连接到 ${asrService.getProviderName()} ASR 服务`)

        const message: WebSocketMessage = {
          type: 'connected',
          message: '已连接到语音识别服务',
        }

        clientWs.send(JSON.stringify(message))
      })
      .catch((error) => {
        console.error(`连接 ${asrService.getProviderName()} 失败:`, error)

        const message: WebSocketMessage = {
          type: 'error',
          error: '连接语音识别服务失败: ' + error.message,
        }

        clientWs.send(JSON.stringify(message))
        clientWs.close()
      })
  }

  /**
   * 监听 ASR 识别结果
   */
  private static listenToASRResults(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    asrService.on('result', (result: ASRResult) => {
      console.log('收到识别结果:', result.text)

      const message: WebSocketMessage = {
        type: 'result',
        data: result,
      }

      clientWs.send(JSON.stringify(message))
    })
  }

  /**
   * 监听 ASR 错误
   */
  private static listenToASRErrors(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    asrService.on('error', (error: any) => {
      console.error(`${asrService.getProviderName()} 错误:`, error)

      const message: WebSocketMessage = {
        type: 'error',
        error: typeof error === 'string' ? error : error.message || '识别错误',
      }

      clientWs.send(JSON.stringify(message))
    })
  }

  /**
   * 监听 ASR 连接关闭
   */
  private static listenToASRClose(asrService: ASRServiceInterface): void {
    asrService.on('close', (info: any) => {
      console.log(`${asrService.getProviderName()} 连接已关闭:`, info)
    })
  }

  /**
   * 处理客户端消息
   */
  private static handleClientMessages(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    clientWs.on('message', (data: Buffer) => {
      try {
        // 尝试解析为 JSON（控制消息）
        // 只有当数据是文本且以 { 开头时才尝试 JSON 解析
        if (data.length > 0 && data[0] === 0x7b) {
          // 0x7b = '{'
          try {
            const text = data.toString('utf-8')
            const message: ClientMessage = JSON.parse(text)

            if (message.type === 'end') {
              // 客户端标记录音结束，发送最后一包
              console.log('客户端标记录音结束')
              asrService.sendAudioData(Buffer.alloc(0), true)
              return
            }
          } catch (jsonError) {
            // JSON 解析失败，可能是音频数据恰好以 { 开头，继续当作音频数据处理
          }
        }

        // 否则视为音频数据
        // 前端发送的是 PCM 16bit 16000Hz mono 音频数据
        asrService.sendAudioData(data, false)
      } catch (error: any) {
        console.error('处理客户端消息失败:', error)

        const message: WebSocketMessage = {
          type: 'error',
          error: '处理消息失败: ' + error.message,
        }

        clientWs.send(JSON.stringify(message))
      }
    })
  }

  /**
   * 处理客户端断开连接
   */
  private static handleClientDisconnect(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    clientWs.on('close', () => {
      console.log('客户端已断开连接')
      asrService.close()
    })
  }

  /**
   * 处理客户端错误
   */
  private static handleClientError(
    clientWs: WebSocket,
    asrService: ASRServiceInterface
  ): void {
    clientWs.on('error', (error: Error) => {
      console.error('客户端 WebSocket 错误:', error)
      asrService.close()
    })
  }
}
