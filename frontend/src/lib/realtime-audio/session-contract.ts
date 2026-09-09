export type RtcSessionMode = 'communication' | 'training' | 'quick_talk'
export type RtcExecutionBackend = 'livekit'

export type RtcSurface =
  | 'home_main'
  | 'communication_workspace'
  | 'training_workspace'
  | 'memory_workspace'
  | 'mobile_workbench'
  | 'desktop_companion'

export type RtcSessionStrategy = 'heavy_realtime' | 'light_voice'

export type RtcCapabilityId =
  | 'transport_send_control'
  | 'voice_profile_update'
  | 'workspace_snapshot_read'
  | 'upload_artifact_persist'

export type RtcScene =
  | 'medical'
  | 'family'
  | 'stranger'
  | 'emergency'
  | 'work'
  | 'interview'
  | 'outing'
  | 'home'

export type RtcMicrophoneStatus = 'unknown' | 'available' | 'unavailable'

export interface RtcDeviceContext {
  secureContext?: boolean
  mediaDevicesSupported?: boolean
  microphoneStatus?: RtcMicrophoneStatus
  networkOnline?: boolean
}

export interface RtcSessionIntent {
  surface: RtcSurface
  mode: RtcSessionMode
  sessionStrategy: RtcSessionStrategy
  requestedCapabilities: RtcCapabilityId[]
  scene?: RtcScene
  deviceContext?: RtcDeviceContext
}

export interface RtcResolvedSessionIntent extends RtcSessionIntent {
  grantedCapabilities: RtcCapabilityId[]
}

export interface RtcSessionReadiness {
  canStart: boolean
  requestedStrategy: RtcSessionStrategy
  resolvedStrategy: RtcSessionStrategy
  recommendedStrategy: RtcSessionStrategy
  microphoneRequired: boolean
  blockers: string[]
  warnings: string[]
  summary: RtcSessionReadinessSummary
}

export interface RtcSessionReadinessSummary {
  status: 'needs_attention' | 'can_start' | 'ready'
  label: string
  detail: string
  nextAction: string
  blockerSummary: string | null
  warningSummary: string | null
}

export function defaultCapabilitiesForMode(
  mode: RtcSessionMode,
): RtcCapabilityId[] {
  if (mode === 'training') {
    return [
      'transport_send_control',
      'workspace_snapshot_read',
      'voice_profile_update',
      'upload_artifact_persist',
    ]
  }

  if (mode === 'quick_talk') {
    return ['transport_send_control']
  }

  return [
    'transport_send_control',
    'workspace_snapshot_read',
  ]
}

export function defaultStrategyForMode(
  mode: RtcSessionMode,
): RtcSessionStrategy {
  return mode === 'quick_talk' ? 'light_voice' : 'heavy_realtime'
}

export function buildClientDeviceContext(
  mode: RtcSessionMode,
): RtcDeviceContext {
  if (typeof window === 'undefined') {
    return {}
  }

  const secureContext = window.isSecureContext
  const mediaDevicesSupported = Boolean(navigator.mediaDevices?.getUserMedia)
  const microphoneStatus =
    mode === 'training' && (!secureContext || !mediaDevicesSupported)
      ? 'unavailable'
      : 'unknown'

  return {
    secureContext,
    mediaDevicesSupported,
    microphoneStatus,
    networkOnline: navigator.onLine,
  }
}
