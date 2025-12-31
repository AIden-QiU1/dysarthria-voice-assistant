import axios from 'axios';

export interface StartSessionRequest {
  user_id: string;
  session_id: string;
  metadata?: any;
}

export interface StartSessionResponse {
  success: boolean;
  session_id: string;
  websocket_port: number;
  message?: string;
}

export interface StopSessionRequest {
  session_id: string;
}

export interface StopSessionResponse {
  success: boolean;
  message?: string;
}

export class TenAgentClientService {
  private client: any;
  private static instance: TenAgentClientService;

  private constructor() {
    const baseURL = process.env.TEN_AGENT_API_URL || 'http://localhost:8080';
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(): TenAgentClientService {
    if (!TenAgentClientService.instance) {
      TenAgentClientService.instance = new TenAgentClientService();
    }
    return TenAgentClientService.instance;
  }

  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    try {
      const response = await this.client.post('/api/session/start', request);
      return response.data;
    } catch (error: any) {
      console.error('Error starting TEN Agent session:', error?.message || error);
      throw new Error(`Failed to start TEN Agent session: ${error?.message || String(error)}`);
    }
  }

  async stopSession(request: StopSessionRequest): Promise<StopSessionResponse> {
    try {
      const response = await this.client.post('/api/session/stop', request);
      return response.data;
    } catch (error: any) {
      console.error('Error stopping TEN Agent session:', error?.message || error);
      throw new Error(`Failed to stop TEN Agent session: ${error?.message || String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('TEN Agent health check failed:', error);
      return false;
    }
  }

  async ping(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.client.get('/ping');
      return response.data;
    } catch (error: any) {
      console.error('TEN Agent ping failed:', error?.message || error);
      throw new Error(`Failed to ping TEN Agent: ${error?.message || String(error)}`);
    }
  }
}

export default TenAgentClientService.getInstance();
