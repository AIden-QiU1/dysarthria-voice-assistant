/**
 * 应用配置
 */
export const config = {
  // API 端点配置
  api: {
    // WebSocket 服务地址
    // 优先使用环境变量，否则回退到默认的 localhost:3001
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws/asr',
    
    // HTTP API 基础地址 (如果将来需要)
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  
  // 音频配置
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
  }
}
