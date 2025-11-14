/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { RefObject } from "react"

export type RecordingState = "idle" | "recording"

export interface WaveformControllerEvents {
  onPermissionDenied: () => void
  onError: (error: Error) => void
  onRecordStart?: () => void
  onRecordReady?: (blob: Blob) => void
  onApprove?: (wav: Blob) => Promise<void>
  onCancel?: () => void
  onProgressMs?: (ms: number) => void
  onPlaybackPlay?: () => void
  onPlaybackPause?: () => void
  onPlaybackFinish?: () => void
}

export interface AudioMeta {
  durationMs: number
  sampleRate: number | null
  mimeType: string
  size: number
}

export interface StopResult {
  blob: Blob
  meta: AudioMeta
}

export interface WaveformController {
  readonly state: RecordingState
  readonly isPlaybackPlaying: boolean
  readonly mountRef: RefObject<HTMLDivElement>

  start(): Promise<void>

  stop(): Promise<StopResult>

  approve(blob?: Blob): Promise<void>

  cancel(): void

  destroy(): void

  playback: {
    isPlaying(): boolean
    play(): Promise<void>
    pause(): void
    load(source: Blob | ArrayBuffer | string): Promise<void>
    getCurrentTimeMs(): number
    getDurationMs(): number
  }

  setEventHandlers(events: WaveformControllerEvents): void
}
