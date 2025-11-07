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

import type WaveSurfer from "wavesurfer.js"
import type RecordPlugin from "wavesurfer.js/dist/plugins/record"

/**
 * Check if an error is a permission denied error from getUserMedia.
 * WaveSurfer may wrap the native error, so check both the error name and message.
 */
function isPermissionDeniedError(error: Error): boolean {
  return (
    error.name === "NotAllowedError" ||
    error.name === "PermissionDeniedError" ||
    error.message?.toLowerCase().includes("permission denied")
  )
}

export interface RecordBackendOptions {
  sampleRate?: number | null
}

export interface RecordBackendEvents {
  onRecordStart?: () => void
  onRecordEnd?: (blob: Blob) => void
  onRecordProgress?: (ms: number) => void
  onPermissionDenied?: () => void
  onError?: (error: Error) => void
}

/**
 * WaveSurferRecordBackend handles recording via WaveSurfer's Record plugin.
 * Manages mic permissions, recording state, and cleanup.
 */
export class WaveSurferRecordBackend {
  private wavesurfer: WaveSurfer | null = null
  private recordPlugin: RecordPlugin | null = null
  private isRecording = false
  private recordEndResolve: ((blob: Blob) => void) | null = null
  private recordEndReject: ((error: Error) => void) | null = null
  private events: RecordBackendEvents = {}
  private options: RecordBackendOptions

  constructor(options: RecordBackendOptions = {}) {
    this.options = options
  }

  initialize(
    wavesurfer: WaveSurfer,
    RecordPluginClass: typeof RecordPlugin
  ): void {
    this.wavesurfer = wavesurfer

    try {
      const recordOptions: Record<string, unknown> = {
        renderRecordedAudio: false,
        mimeType: "audio/webm",
      }

      this.recordPlugin = wavesurfer.registerPlugin(
        RecordPluginClass.create(recordOptions)
      )

      this.setupEventListeners()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (isPermissionDeniedError(err)) {
        this.events.onPermissionDenied?.()
        throw new Error("Microphone permission denied")
      }
      this.events.onError?.(err)
      throw err
    }
  }

  private setupEventListeners(): void {
    if (!this.recordPlugin) return

    this.recordPlugin.on("record-start", () => {
      this.isRecording = true
      this.events.onRecordStart?.()
    })

    this.recordPlugin.on("record-end", (blob: Blob) => {
      this.isRecording = false
      this.events.onRecordEnd?.(blob)

      if (this.recordEndResolve && blob && blob.size > 0) {
        this.recordEndResolve(blob)
        this.recordEndResolve = null
        this.recordEndReject = null
      } else if (this.recordEndReject) {
        this.recordEndReject(new Error("Invalid or empty recording"))
        this.recordEndResolve = null
        this.recordEndReject = null
      } else {
        // Defensive: avoid memory leak if both resolve/reject are null
        this.recordEndResolve = null
        this.recordEndReject = null
      }
    })

    this.recordPlugin.on("record-progress", (time: number) => {
      this.events.onRecordProgress?.(time)
    })
  }

  setEventHandlers(events: RecordBackendEvents): void {
    this.events = events
  }

  async startRecording(): Promise<void> {
    if (!this.recordPlugin) {
      throw new Error("Record plugin not initialized")
    }

    if (this.isRecording) {
      return
    }

    const requestedSampleRate =
      typeof this.options.sampleRate === "number"
        ? this.options.sampleRate
        : undefined

    const initialConstraints: MediaTrackConstraints = {}
    if (requestedSampleRate !== undefined) {
      initialConstraints.sampleRate = { ideal: requestedSampleRate }
    }

    await this.startRecordingWithConstraints(
      initialConstraints,
      requestedSampleRate !== undefined
    )
  }

  private async startRecordingWithConstraints(
    constraints: MediaTrackConstraints,
    allowRetryWithoutConstraints: boolean
  ): Promise<void> {
    if (!this.recordPlugin) {
      throw new Error("Record plugin not initialized")
    }

    try {
      const constraintValue = Object.keys(constraints).length
        ? constraints
        : undefined
      await this.recordPlugin.startRecording(constraintValue)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      if (isPermissionDeniedError(err)) {
        this.events.onPermissionDenied?.()
        throw new Error("Microphone permission denied")
      }

      const isConstraintError =
        allowRetryWithoutConstraints &&
        (err.name === "OverconstrainedError" ||
          err.name === "NotReadableError")

      if (isConstraintError) {
        // Retry once using browser defaults so recording can proceed.
        this.options.sampleRate = undefined
        await this.startRecordingWithConstraints({}, false)
        return
      }

      this.events.onError?.(err)
      throw err
    }
  }

  async stopRecording(): Promise<Blob> {
    if (!this.recordPlugin || !this.isRecording) {
      throw new Error("Not currently recording")
    }

    try {
      return new Promise<Blob>((resolve, reject) => {
        this.recordEndResolve = resolve
        this.recordEndReject = reject
        this.recordPlugin?.stopRecording()
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.events.onError?.(err)
      throw err
    }
  }

  cancelRecording(): void {
    if (this.recordPlugin && this.isRecording) {
      this.recordPlugin.stopRecording()
      this.isRecording = false
      this.recordEndResolve = null
      this.recordEndReject = null
    }
  }

  destroy(): void {
    this.cancelRecording()

    if (this.recordPlugin) {
      this.recordPlugin.destroy()
      this.recordPlugin = null
    }

    this.wavesurfer = null
    this.events = {}
  }
}
