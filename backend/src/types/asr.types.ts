/**
 * ASR 相关类型定义
 */

// WebSocket 消息类型
export interface WebSocketMessage {
  type: 'connected' | 'result' | 'error' | 'end'
  message?: string
  data?: any
  error?: string
}

// ASR 识别结果
export interface ASRResult {
  text: string
  utterances?: Array<{
    text: string
    start_time: number
    end_time: number
    definite: boolean
  }>
  isFinal: boolean
}

// 客户端发送的控制消息
export interface ClientMessage {
  type: 'end'
}
