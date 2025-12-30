/**
 * TEN Agent Service
 * 
 * Backend与TEN Agent的HTTP通信服务
 */

import axios, { AxiosInstance } from 'axios';

export interface TENAgentRequest {
  audio: string;  // base64编码的音频
  userId: string;
  sessionId: string;
  sampleRate?: number;
  channels?: number;
}

export interface TENAgentResponse {
  asrText: string;
  llmResponse: string;
  ttsAudio: string;  // base64编码的音频
  sessionId: string;
}

export class TENAgentService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.TEN_AGENT_URL || 'http://localhost:8080';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,  // 30秒超时
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 发送音频到TEN Agent处理
   */
  async processAudio(request: TENAgentRequest): Promise<TENAgentResponse> {
    try {
      const response = await this.client.post('/process', {
        audio: request.audio,
        user_id: request.userId,
        session_id: request.sessionId,
        sample_rate: request.sampleRate || 16000,
        channels: request.channels || 1,
      });

      return {
        asrText: response.data.asr_text,
        llmResponse: response.data.llm_response,
        ttsAudio: response.data.tts_audio,
        sessionId: response.data.session_id,
      };
    } catch (error) {
      console.error('TEN Agent request failed:', error);
      throw new Error(`TEN Agent处理失败: ${error.message}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('TEN Agent health check failed:', error);
      return false;
    }
  }
}

export default new TENAgentService();
