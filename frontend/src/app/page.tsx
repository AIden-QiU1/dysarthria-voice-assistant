'use client'

import { useState, useRef, useEffect } from 'react'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import { ASRClient } from '@/lib/websocket/asr-client'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { RecognitionResult, WebSocketMessage } from '@/lib/types'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [status, setStatus] = useState('')

  const asrClientRef = useRef<ASRClient | null>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // 初始化 AudioProcessor
  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor()
    return () => {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stop()
      }
      if (asrClientRef.current) {
        asrClientRef.current.close()
      }
    }
  }, [])

  // 开始录音
  const startRecording = async () => {
    try {
      setStatus('正在连接...')
      setTranscript('')

      // 1. 建立 WebSocket 连接
      const asrClient = new ASRClient()
      asrClientRef.current = asrClient

      await asrClient.connect(
        () => {
          console.log('WebSocket 连接已建立')
          setStatus('你说，我静静地听着呢！')
        },
        (message: WebSocketMessage) => {
          if (message.type === 'connected') {
            console.log('服务器消息:', message.message)
          } else if (message.type === 'result') {
            const result: RecognitionResult = message.data
            console.log('收到识别结果:', result.text, 'utterances:', result.utterances?.length)

            // 处理识别结果
            if (result.utterances && result.utterances.length > 0) {
              result.utterances.forEach((utterance) => {
                if (utterance.definite) {
                  // 已完成的句子 - 暂时不处理，只显示当前正在说的
                } else {
                  // 未完成的句子 → 只显示最后一个不完整的句子
                  const text = utterance.text

                  // 防御性检查
                  if (!text || text === 'undefined') {
                    return
                  }

                  const lastPunctuation = Math.max(
                    text.lastIndexOf('。'),
                    text.lastIndexOf('？'),
                    text.lastIndexOf('！')
                  )

                  if (lastPunctuation >= 0) {
                    const currentSentence = text.substring(lastPunctuation + 1).trim()
                    setTranscript(currentSentence)
                  } else {
                    setTranscript(text)
                  }
                }
              })
            } else if (result.text && result.text !== 'undefined') {
              const text = result.text
              const lastPunctuation = Math.max(
                text.lastIndexOf('。'),
                text.lastIndexOf('？'),
                text.lastIndexOf('！')
              )

              if (lastPunctuation >= 0) {
                const currentSentence = text.substring(lastPunctuation + 1).trim()
                setTranscript(currentSentence)
              } else {
                setTranscript(text)
              }
            }
          } else if (message.type === 'error') {
            console.error('服务器错误:', message.error)
            setStatus('错误: ' + message.error)
          }
        },
        (error) => {
          console.error('WebSocket 错误:', error)
          setStatus('连接错误')
        },
        () => {
          console.log('WebSocket 连接已关闭')
        }
      )

      // 2. 启动音频处理
      if (audioProcessorRef.current) {
        const analyser = await audioProcessorRef.current.start((data) => {
          if (asrClientRef.current && asrClientRef.current.isOpen()) {
            asrClientRef.current.send(data)
          }
        })
        analyserRef.current = analyser
      }

      setIsRecording(true)
      setStatus('你说，我静静地听着呢！')
    } catch (error) {
      console.error('启动录音失败:', error)
      setStatus('启动录音失败: ' + (error as Error).message)
    }
  }

  // 停止录音
  const stopRecording = () => {
    try {
      // 发送结束标记
      if (asrClientRef.current && asrClientRef.current.isOpen()) {
        asrClientRef.current.send(JSON.stringify({ type: 'end' }))
        asrClientRef.current.close()
        asrClientRef.current = null
      }

      // 停止音频处理
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stop()
      }

      setIsRecording(false)
      setTranscript('') // 清空识别结果
      setStatus('') // 清空状态
    } catch (error) {
      console.error('停止录音失败:', error)
      setStatus('停止录音失败')
    }
  }


  // 处理屏幕点击
  const handleScreenClick = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  return (
    <div
      className="min-h-screen bg-white relative overflow-hidden"
      onClick={handleScreenClick}
    >
      {/* 背景装饰 - 淡淡的光晕 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-100/20 rounded-full blur-3xl"></div>
      </div>

      {/* 左上角产品名称 - 始终显示 */}
      <div className="fixed top-8 left-8 z-30 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Ranyan Agent</h1>
        <span className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded-full">
          beta
        </span>
      </div>

      {/* 右上角图标 */}
      <div className="fixed top-8 right-8 z-30 flex items-center gap-4">
        {/* GitHub 图标 */}
        <a
          href="https://github.com/AIden-QiU1/dysarthria-voice-assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="GitHub"
        >
          <svg
            className="w-6 h-6 text-gray-900"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
        </a>

      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
        {/* 识别结果 - 屏幕中央 */}
        <div className="max-w-6xl w-full text-center">
          {transcript ? (
            <div className="animate-fadeIn">
              <p className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight tracking-wide drop-shadow-lg">
                {transcript}
              </p>
            </div>
          ) : isRecording ? (
            <div className="text-gray-500 text-2xl">
              {status}
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-gray-900 leading-tight whitespace-nowrap">
                让AI听懂你的声音
              </h2>
              <p className="text-2xl md:text-3xl lg:text-4xl text-gray-600">
                全球第一个面向非标准语音的开源项目
              </p>

              {/* 开始录音按钮 - 标题下方 */}
              <div className="pt-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startRecording()
                  }}
                  className="px-12 py-6 rounded-full font-bold text-xl transition-all duration-300 transform hover:scale-105 bg-black hover:bg-gray-900 text-white shadow-2xl shadow-black/50"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                    <span>开始录音</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 波形可视化组件 */}
      <WaveformVisualizer analyser={analyserRef.current} isRecording={isRecording} />

      {/* 提示文字 - 顶部居中显示 */}
      {isRecording && (
        <div className="fixed top-8 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-gray-900/80 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm animate-fadeIn">
            点击屏幕任意位置停止录音
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
