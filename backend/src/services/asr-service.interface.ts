/**
 * ASR 服务抽象接口
 * 所有ASR服务提供商都需要实现这个接口
 */
import { EventEmitter } from 'events'

export interface ASRServiceInterface extends EventEmitter {
  /**
   * 连接到 ASR 服务
   */
  connect(): Promise<void>

  /**
   * 发送音频数据
   * @param audioData 音频数据 Buffer
   * @param isLast 是否是最后一包数据
   */
  sendAudioData(audioData: Buffer, isLast: boolean): void

  /**
   * 关闭连接
   */
  close(): void

  /**
   * 获取服务提供商名称
   */
  getProviderName(): string
}

/**
 * ASR 事件类型
 */
export interface ASREvents {
  // 识别结果事件
  result: (result: any) => void
  // 错误事件
  error: (error: Error | string) => void
  // 连接关闭事件
  close: (info: any) => void
}
