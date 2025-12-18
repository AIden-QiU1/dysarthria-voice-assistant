import { config } from '../config'

export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private stream: MediaStream | null = null

  // 将 Float32Array 转换为 PCM 16bit
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return output
  }

  // 重采样到 16000Hz
  private resample(
    audioBuffer: Float32Array,
    originalSampleRate: number,
    targetSampleRate: number = config.audio.sampleRate
  ): Float32Array {
    if (originalSampleRate === targetSampleRate) {
      return audioBuffer
    }

    const ratio = originalSampleRate / targetSampleRate
    const newLength = Math.round(audioBuffer.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio
      const index = Math.floor(sourceIndex)
      const fraction = sourceIndex - index

      if (index + 1 < audioBuffer.length) {
        result[i] = audioBuffer[index] * (1 - fraction) + audioBuffer[index + 1] * fraction
      } else {
        result[i] = audioBuffer[index]
      }
    }

    return result
  }

  async start(onAudioProcess: (data: ArrayBufferLike) => void): Promise<AnalyserNode> {
    // 获取麦克风权限
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: config.audio.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    // 创建 AudioContext
    this.audioContext = new AudioContext({ sampleRate: config.audio.sampleRate })

    this.source = this.audioContext.createMediaStreamSource(this.stream)

    // 创建分析器用于可视化
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.source.connect(this.analyser)

    // 创建 ScriptProcessorNode 处理音频
    const bufferSize = config.audio.bufferSize
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      if (this.audioContext) {
        const resampledData = this.resample(inputData, this.audioContext.sampleRate, config.audio.sampleRate)
        const pcmData = this.floatTo16BitPCM(resampledData)
        onAudioProcess(pcmData.buffer)
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    return this.analyser
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
  }
}
