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

export type RecordingState = "idle" | "recording"

export interface WaveformControllerEvents {
  onPermissionDenied?: () => void
  onError?: (error: Error) => void
  onRecordStart?: () => void
  onRecordReady?: (blob: Blob) => void
  onApprove?: (wav: Blob) => void
  onCancel?: () => void
  onProgressMs?: (ms: number) => void
}

export interface WaveformController {
  readonly state: RecordingState

  start(): Promise<void>

  stop(): Promise<void>

  approve(): Promise<void>

  cancel(): void

  playback: {
    isPlaying(): boolean
    play(): Promise<void>
    pause(): void
    getCurrentTimeMs(): number
    getDurationMs(): number
  }

  setEventHandlers(events: WaveformControllerEvents): void
}
