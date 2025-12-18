import { RecognitionResult, WebSocketMessage } from '../types'
import { config } from '../config'

export class ASRClient {
  private ws: WebSocket | null = null
  private url: string

  constructor(url: string = config.api.wsUrl) {
    this.url = url
  }

  connect(
    onOpen: () => void,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Event) => void,
    onClose: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          onOpen()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            onMessage(message)
          } catch (error) {
            console.error('解析消息失败:', error)
          }
        }

        this.ws.onerror = (error) => {
          onError(error)
          reject(error)
        }

        this.ws.onclose = () => {
          onClose()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        this.ws.send(data)
      } else {
        this.ws.send(data)
      }
    }
  }

  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
