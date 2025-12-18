import zlib from 'zlib'

/**
 * WebSocket 二进制协议工具类
 * 根据火山引擎 ASR API 协议实现
 */
export class WebSocketProtocol {
  // 协议版本
  private static readonly PROTOCOL_VERSION = 0b0001
  private static readonly HEADER_SIZE = 0b0001 // 4 bytes

  // 消息类型
  static readonly MESSAGE_TYPE = {
    FULL_CLIENT_REQUEST: 0b0001,
    AUDIO_ONLY_REQUEST: 0b0010,
    FULL_SERVER_RESPONSE: 0b1001,
    ERROR_RESPONSE: 0b1111,
  }

  // 消息标志
  static readonly MESSAGE_FLAGS = {
    NO_SEQUENCE: 0b0000,
    POSITIVE_SEQUENCE: 0b0001,
    LAST_PACKET_NO_SEQUENCE: 0b0010,
    LAST_PACKET_WITH_SEQUENCE: 0b0011,
  }

  // 序列化方法
  static readonly SERIALIZATION = {
    NONE: 0b0000,
    JSON: 0b0001,
  }

  // 压缩方法
  static readonly COMPRESSION = {
    NONE: 0b0000,
    GZIP: 0b0001,
  }

  /**
   * 构建消息头（4字节）
   */
  private static buildHeader(
    messageType: number,
    messageFlags: number,
    serialization: number,
    compression: number
  ): Buffer {
    const header = Buffer.alloc(4)

    // Byte 0: Protocol version (4 bits) + Header size (4 bits)
    header[0] = (this.PROTOCOL_VERSION << 4) | this.HEADER_SIZE

    // Byte 1: Message type (4 bits) + Message flags (4 bits)
    header[1] = (messageType << 4) | messageFlags

    // Byte 2: Serialization (4 bits) + Compression (4 bits)
    header[2] = (serialization << 4) | compression

    // Byte 3: Reserved
    header[3] = 0x00

    return header
  }

  /**
   * 构建 Full Client Request
   */
  static buildFullClientRequest(payload: object): Buffer {
    // 序列化为 JSON
    const jsonString = JSON.stringify(payload)
    const jsonBuffer = Buffer.from(jsonString, 'utf-8')

    // Gzip 压缩
    const compressedPayload = zlib.gzipSync(jsonBuffer)

    // 构建 Header
    const header = this.buildHeader(
      this.MESSAGE_TYPE.FULL_CLIENT_REQUEST,
      this.MESSAGE_FLAGS.NO_SEQUENCE,
      this.SERIALIZATION.JSON,
      this.COMPRESSION.GZIP
    )

    // Payload size (4 bytes, big-endian)
    const payloadSize = Buffer.alloc(4)
    payloadSize.writeUInt32BE(compressedPayload.length, 0)

    // 组合完整消息
    return Buffer.concat([header, payloadSize, compressedPayload])
  }

  /**
   * 构建 Audio Only Request
   */
  static buildAudioOnlyRequest(audioData: Buffer, isLast: boolean = false): Buffer {
    // Gzip 压缩音频数据
    const compressedAudio = zlib.gzipSync(audioData)

    // 构建 Header
    const messageFlags = isLast
      ? this.MESSAGE_FLAGS.LAST_PACKET_NO_SEQUENCE
      : this.MESSAGE_FLAGS.NO_SEQUENCE

    const header = this.buildHeader(
      this.MESSAGE_TYPE.AUDIO_ONLY_REQUEST,
      messageFlags,
      this.SERIALIZATION.NONE,
      this.COMPRESSION.GZIP
    )

    // Payload size (4 bytes, big-endian)
    const payloadSize = Buffer.alloc(4)
    payloadSize.writeUInt32BE(compressedAudio.length, 0)

    // 组合完整消息
    return Buffer.concat([header, payloadSize, compressedAudio])
  }

  /**
   * 解析服务器响应
   */
  static parseServerResponse(data: Buffer): {
    messageType: number
    messageFlags: number
    sequence?: number
    payload: any
    error?: { code: number; message: string }
  } {
    if (data.length < 4) {
      throw new Error('Invalid message: too short')
    }

    // 解析 Header (4 bytes)
    const byte0 = data[0]
    const byte1 = data[1]
    const byte2 = data[2]

    const protocolVersion = (byte0 >> 4) & 0x0f
    const headerSize = byte0 & 0x0f
    const messageType = (byte1 >> 4) & 0x0f
    const messageFlags = byte1 & 0x0f
    const serialization = (byte2 >> 4) & 0x0f
    const compression = byte2 & 0x0f

    let offset = 4

    // 如果是 Full Server Response 并且有 sequence 标志，读取 sequence (4 bytes)
    let sequence: number | undefined
    if (messageType === this.MESSAGE_TYPE.FULL_SERVER_RESPONSE) {
      // 检查 message flags 是否指示有 sequence
      const hasSequence =
        messageFlags === this.MESSAGE_FLAGS.POSITIVE_SEQUENCE ||
        messageFlags === this.MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE

      if (hasSequence) {
        if (data.length < 8) {
          throw new Error('Invalid full server response: missing sequence')
        }
        sequence = data.readUInt32BE(offset)
        offset += 4
      }
    }

    // 如果是 Error Response，读取 error code (4 bytes)
    if (messageType === this.MESSAGE_TYPE.ERROR_RESPONSE) {
      if (data.length < 8) {
        throw new Error('Invalid error response: missing error code')
      }
      const errorCode = data.readUInt32BE(offset)
      offset += 4

      // 读取 payload size
      if (data.length < offset + 4) {
        throw new Error('Invalid error response: missing payload size')
      }
      const payloadSize = data.readUInt32BE(offset)
      offset += 4

      // 读取 error message
      const errorMessageBuffer = data.subarray(offset, offset + payloadSize)
      const errorMessage = errorMessageBuffer.toString('utf-8')

      return {
        messageType,
        messageFlags,
        payload: null,
        error: { code: errorCode, message: errorMessage },
      }
    }

    // 读取 Payload size (4 bytes)
    if (data.length < offset + 4) {
      throw new Error('Invalid message: missing payload size')
    }
    const payloadSize = data.readUInt32BE(offset)
    offset += 4

    // 读取 Payload
    if (data.length < offset + payloadSize) {
      throw new Error(`Invalid message: payload size mismatch (expected ${payloadSize}, got ${data.length - offset})`)
    }
    let payloadBuffer = data.subarray(offset, offset + payloadSize)

    // 解压
    if (compression === this.COMPRESSION.GZIP) {
      try {
        payloadBuffer = zlib.gunzipSync(payloadBuffer)
      } catch (error) {
        console.error('Gzip 解压失败:', error)
        throw new Error('Failed to decompress gzip payload')
      }
    }

    // 反序列化
    let payload: any = payloadBuffer
    if (serialization === this.SERIALIZATION.JSON) {
      const jsonString = payloadBuffer.toString('utf-8')
      try {
        payload = JSON.parse(jsonString)
      } catch (error) {
        console.error('JSON 解析失败, 原始数据:', jsonString.substring(0, 100))
        throw error
      }
    }

    return {
      messageType,
      messageFlags,
      sequence,
      payload,
    }
  }
}
