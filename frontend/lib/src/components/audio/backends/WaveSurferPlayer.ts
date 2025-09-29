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

export interface PlayerEvents {
  onTimeUpdate?: (currentTime: number) => void
  onPause?: () => void
  onPlay?: () => void
  onFinish?: () => void
  onReady?: () => void
  onError?: (error: Error) => void
}

/**
 * WaveSurferPlayer manages audio playback using WaveSurfer.
 * Handles loading audio, playback controls, and proper URL cleanup.
 */
export class WaveSurferPlayer {
  private wavesurfer: WaveSurfer | null = null
  private currentBlobUrl: string | null = null
  private events: PlayerEvents = {}
  private isPlaying = false

  initialize(wavesurfer: WaveSurfer): void {
    this.wavesurfer = wavesurfer
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (!this.wavesurfer) return

    this.wavesurfer.on("timeupdate", (currentTime: number) => {
      this.events.onTimeUpdate?.(currentTime * 1000)
    })

    this.wavesurfer.on("pause", () => {
      this.isPlaying = false
      this.events.onPause?.()
    })

    this.wavesurfer.on("play", () => {
      this.isPlaying = true
      this.events.onPlay?.()
    })

    this.wavesurfer.on("finish", () => {
      this.isPlaying = false
      this.events.onFinish?.()
    })

    this.wavesurfer.on("ready", () => {
      this.events.onReady?.()
    })

    this.wavesurfer.on("error", (msg: unknown) => {
      const err = msg instanceof Error ? msg : new Error(String(msg))
      this.events.onError?.(err)
    })
  }

  setEventHandlers(events: PlayerEvents): void {
    this.events = events
  }

  async load(source: Blob | ArrayBuffer | string): Promise<void> {
    if (!this.wavesurfer) {
      throw new Error("WaveSurfer not initialized")
    }

    this.cleanupPreviousUrl()

    let url: string
    if (source instanceof Blob) {
      url = URL.createObjectURL(source)
      this.currentBlobUrl = url
    } else if (source instanceof ArrayBuffer) {
      const blob = new Blob([source])
      url = URL.createObjectURL(blob)
      this.currentBlobUrl = url
    } else {
      url = source
    }

    try {
      await this.wavesurfer.load(url)
    } catch (error) {
      this.cleanupPreviousUrl()
      throw error
    }
  }

  async play(): Promise<void> {
    if (!this.wavesurfer) {
      throw new Error("WaveSurfer not initialized")
    }
    await this.wavesurfer.play()
  }

  pause(): void {
    if (!this.wavesurfer) return
    this.wavesurfer.pause()
  }

  getDuration(): number {
    if (!this.wavesurfer) return 0
    return this.wavesurfer.getDuration() * 1000
  }

  getCurrentTime(): number {
    if (!this.wavesurfer) return 0
    return this.wavesurfer.getCurrentTime() * 1000
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  private cleanupPreviousUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl)
      this.currentBlobUrl = null
    }
  }

  destroy(): void {
    this.pause()
    this.cleanupPreviousUrl()

    if (this.wavesurfer) {
      this.wavesurfer.empty()
      this.wavesurfer = null
    }

    this.events = {}
    this.isPlaying = false
  }
}
