'use client'

import { useEffect, useRef } from 'react'

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null
  isRecording: boolean
}

export default function WaveformVisualizer({ analyser, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const currentVolRef = useRef<number>(0)
  const timeRef = useRef<number>(0)

  const CONFIG = {
    // Colors - 黑色灰色主题
    colorBase: [0, 0, 0], // Black - for tall bars
    colorSecondary: [107, 114, 128], // Gray-500 - for short bars
    layers: 3,
    speedIdle: 0.06, // Gentle movement when no voice
    speedActive: 0.18, // Fast, dramatic movement when speaking

    // Bar Geometry - 竖向条形
    barCount: 100, // Number of bars - 增加数量以铺满屏幕
    barWidth: 8, // Fixed bar width - 8px
    barGap: 4, // Gap between bars in pixels - 4px
    barMinHeight: 16, // Minimum bar height (idle state) - 2倍
    barMaxHeight: 300, // Maximum bar height (active state) - 300px
    idleAmplitude: 0.15, // Idle height multiplier
    heightThreshold: 0.5, // 高于这个值用黑色，低于用灰色

    // Curve
    curveAmplitude: 40, // Curve wave amplitude
    curveLineWidth: 2, // Curve line thickness

    // Physics
    smoothing: 0.3, // Faster response
    activeThreshold: 0.02, // Volume level to be considered "active"
    volumeScale: 12, // 音量放大系数
  }

  useEffect(() => {
    // Cleanup animation
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const parent = canvas.parentElement

    const resizeCanvas = () => {
      if (parent) {
        canvas.width = parent.clientWidth * dpr
        canvas.height = parent.clientHeight * dpr
        ctx.scale(dpr, dpr)
        canvas.style.width = `${parent.clientWidth}px`
        canvas.style.height = `${parent.clientHeight}px`
      }
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    const draw = () => {
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      const bottomY = height // 底部Y坐标

      ctx.clearRect(0, 0, width, height)

      // 1. Audio Processing
      let targetVolume = 0
      if (analyser && isRecording) {
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyser.getByteTimeDomainData(dataArray)

        // Calculate RMS (Root Mean Square) for accurate volume
        let sum = 0
        for (let i = 0; i < bufferLength; i += 8) {
          const x = (dataArray[i] - 128) / 128.0
          sum += x * x
        }
        targetVolume = Math.sqrt(sum / (bufferLength / 8))
      }

      // Smooth Volume Transition
      const inputVol = isRecording ? targetVolume : 0
      currentVolRef.current += (inputVol - currentVolRef.current) * CONFIG.smoothing

      // Determine if we're in active speaking state
      const isActive = currentVolRef.current > CONFIG.activeThreshold

      // Use different speed based on active state
      const currentSpeed = isActive ? CONFIG.speedActive : CONFIG.speedIdle

      // Calculate amplitude factor (0 to 1) - 增加音量放大
      const amplitudeFactor = Math.min(1, currentVolRef.current * CONFIG.volumeScale)

      // 2. Draw vertical bars across the full width
      const barSpacing = CONFIG.barWidth + CONFIG.barGap
      const actualBarCount = Math.floor(width / barSpacing) // 根据屏幕宽度计算实际条数

      for (let barIndex = 0; barIndex < actualBarCount; barIndex++) {
        const barX = barIndex * barSpacing
        const normalizedX = barIndex / actualBarCount

        // Envelope: middle bars taller, side bars shorter (曲线包络)
        const envelope = Math.pow(Math.sin(normalizedX * Math.PI), 2)

        // Wave oscillation for this bar
        const phaseOffset = timeRef.current * currentSpeed
        const waveOscillation = Math.sin(normalizedX * Math.PI * 5 + phaseOffset)

        // Calculate bar height (expands vertically based on volume)
        const idleHeight = CONFIG.barMinHeight
        const activeHeight = CONFIG.barMinHeight + (CONFIG.barMaxHeight - CONFIG.barMinHeight) * amplitudeFactor
        const calculatedHeight = idleHeight + (activeHeight - idleHeight) * envelope * (1 + waveOscillation * 0.5)

        // Ensure bar height doesn't exceed container height
        const barHeight = Math.min(calculatedHeight, height)

        // Color based on envelope (tall bars are black, short bars are gray)
        const [r, g, b] = envelope > CONFIG.heightThreshold ? CONFIG.colorBase : CONFIG.colorSecondary

        // Opacity based on envelope
        const alpha = 0.8 + envelope * 0.2

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`

        // Draw bar from bottom upward
        ctx.fillRect(
          barX,
          bottomY - barHeight,
          CONFIG.barWidth,
          barHeight
        )
      }

      timeRef.current += 0.1
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isRecording, analyser])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 h-screen z-20 pointer-events-none flex items-end justify-center transition-opacity duration-500 ${
        isRecording ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="w-full h-[400px] relative">
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gray-300/10 blur-3xl rounded-full pointer-events-none transform scale-y-75" />
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  )
}
