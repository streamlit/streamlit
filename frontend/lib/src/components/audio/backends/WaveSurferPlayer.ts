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
  private handleTimeUpdate?: (currentTime: number) => void
  private handlePause?: () => void
  private handlePlay?: () => void
  private handleFinish?: () => void
  private handleReady?: () => void
  private handleError?: (msg: unknown) => void

  initialize(wavesurfer: WaveSurfer): void {
    this.wavesurfer = wavesurfer
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (!this.wavesurfer) return

    this.teardownEventListeners()

    this.handleTimeUpdate = (currentTime: number) => {
      this.events.onTimeUpdate?.(currentTime * 1000)
    }
    this.handlePause = () => {
      this.isPlaying = false
      this.events.onPause?.()
    }
    this.handlePlay = () => {
      this.isPlaying = true
      this.events.onPlay?.()
    }
    this.handleFinish = () => {
      this.isPlaying = false
      this.events.onFinish?.()
    }
    this.handleReady = () => {
      this.events.onReady?.()
    }
    this.handleError = (msg: unknown) => {
      const err = msg instanceof Error ? msg : new Error(String(msg))
      this.events.onError?.(err)
    }

    this.wavesurfer.on("timeupdate", this.handleTimeUpdate)
    this.wavesurfer.on("pause", this.handlePause)
    this.wavesurfer.on("play", this.handlePlay)
    this.wavesurfer.on("finish", this.handleFinish)
    this.wavesurfer.on("ready", this.handleReady)
    this.wavesurfer.on("error", this.handleError)
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
    let newBlobUrl: string | null = null

    try {
      if (source instanceof Blob) {
        newBlobUrl = URL.createObjectURL(source)
        url = newBlobUrl
      } else if (source instanceof ArrayBuffer) {
        const blob = new Blob([source])
        newBlobUrl = URL.createObjectURL(blob)
        url = newBlobUrl
      } else {
        url = source
      }

      this.currentBlobUrl = newBlobUrl
      await this.wavesurfer.load(url)
    } catch (error) {
      this.cleanupPreviousUrl() // This will revoke the URL we just set
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

  seekToStart(): void {
    if (!this.wavesurfer) return
    this.wavesurfer.seekTo(0)
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
      this.teardownEventListeners()
      this.wavesurfer.empty()
      this.wavesurfer = null
    }

    this.events = {}
    this.isPlaying = false
    this.handleTimeUpdate = undefined
    this.handlePause = undefined
    this.handlePlay = undefined
    this.handleFinish = undefined
    this.handleReady = undefined
    this.handleError = undefined
  }

  private teardownEventListeners(): void {
    if (!this.wavesurfer) return

    if (this.handleTimeUpdate) {
      this.wavesurfer.un("timeupdate", this.handleTimeUpdate)
      this.handleTimeUpdate = undefined
    }
    if (this.handlePause) {
      this.wavesurfer.un("pause", this.handlePause)
      this.handlePause = undefined
    }
    if (this.handlePlay) {
      this.wavesurfer.un("play", this.handlePlay)
      this.handlePlay = undefined
    }
    if (this.handleFinish) {
      this.wavesurfer.un("finish", this.handleFinish)
      this.handleFinish = undefined
    }
    if (this.handleReady) {
      this.wavesurfer.un("ready", this.handleReady)
      this.handleReady = undefined
    }
    if (this.handleError) {
      this.wavesurfer.un("error", this.handleError)
      this.handleError = undefined
    }
  }
}
