/**
 * ASR 服务工厂
 * 根据配置创建不同的 ASR 服务提供商实例
 */
import { ASRServiceInterface } from './asr-service.interface'
import { VolcengineASRStreamingService } from './volcengine-asr-streaming.service'
import { AlibabaASRStreamingService } from './alibaba-asr-streaming.service'

export type ASRProvider = 'volcengine' | 'alibaba'

export class ASRServiceFactory {
  /**
   * 创建 ASR 服务实例
   * @param provider 服务提供商名称，默认从环境变量读取
   */
  static create(provider?: ASRProvider): ASRServiceInterface {
    const selectedProvider = provider || (process.env.ASR_PROVIDER as ASRProvider) || 'volcengine'

    console.log(`创建 ASR 服务: ${selectedProvider}`)

    switch (selectedProvider) {
      case 'volcengine':
        return new VolcengineASRStreamingService()

      case 'alibaba':
        return new AlibabaASRStreamingService()

      default:
        throw new Error(`不支持的 ASR 服务提供商: ${selectedProvider}`)
    }
  }

  /**
   * 获取支持的服务提供商列表
   */
  static getSupportedProviders(): ASRProvider[] {
    return ['volcengine', 'alibaba']
  }
}
