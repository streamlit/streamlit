/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { logWarning } from "src/lib/log"

const BLOB_TYPE = "video/webm"

interface ScreenCastRecorderOptions {
  recordAudio: boolean
  onErrorOrStop: () => void
}

class ScreenCastRecorder {
  private readonly recordAudio: boolean

  private inputStream: MediaStream | null

  private recordedChunks: Blob[]

  private mediaRecorder: MediaRecorder | null

  private onErrorOrStopCallback: () => void

  /** True if the current browser likely supports screencasts. */
  public static isSupportedBrowser(): boolean {
    return (
      navigator.mediaDevices != null &&
      navigator.mediaDevices.getUserMedia != null &&
      navigator.mediaDevices.getDisplayMedia != null &&
      MediaRecorder.isTypeSupported(BLOB_TYPE)
    )
  }

  constructor({ recordAudio, onErrorOrStop }: ScreenCastRecorderOptions) {
    this.recordAudio = recordAudio
    this.onErrorOrStopCallback = onErrorOrStop

    this.inputStream = null
    this.recordedChunks = []

    this.mediaRecorder = null
  }

  /**
   * This asynchronous method will initialize the screen recording object asking
   * for permissions to the user which are needed to start recording.
   */
  public async initialize(): Promise<void> {
    const desktopStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    })

    let tracks = desktopStream.getTracks()

    if (this.recordAudio) {
      const voiceStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      })
      tracks = tracks.concat(voiceStream.getAudioTracks())
    }

    this.recordedChunks = []

    this.inputStream = new MediaStream(tracks)

    this.mediaRecorder = new MediaRecorder(this.inputStream, {
      mimeType: BLOB_TYPE,
    })

    this.mediaRecorder.ondataavailable = e => this.recordedChunks.push(e.data)
  }

  public getState(): string {
    if (this.mediaRecorder) {
      return this.mediaRecorder.state
    }

    return "inactive"
  }

  /**
   * This method will start the screen recording if the user has granted permissions
   * and the mediaRecorder has been initialized
   *
   * @returns {boolean}
   */
  public start(): boolean {
    if (!this.mediaRecorder) {
      logWarning(`ScreenCastRecorder.start: mediaRecorder is null`)
      return false
    }

    const logRecorderError = (e: any): void => {
      logWarning(`mediaRecorder.start threw an error: ${e}`)
    }

    this.mediaRecorder.onerror = (e: any): void => {
      logRecorderError(e)
      this.onErrorOrStopCallback()
    }

    this.mediaRecorder.onstop = (): void => this.onErrorOrStopCallback()

    try {
      this.mediaRecorder.start()
    } catch (e) {
      logRecorderError(e)
      return false
    }

    return true
  }

  /**
   * This method will stop recording and then return the generated Blob
   *
   * @returns {(Promise|undefined)}
   *  A Promise which will return the generated Blob
   *  Undefined if the MediaRecorder could not initialize
   */
  public stop(): Promise<Blob> | undefined {
    if (!this.mediaRecorder) {
      return undefined
    }

    let resolver: (value?: unknown) => void

    const promise = new Promise(r => {
      resolver = r
    })

    this.mediaRecorder.onstop = () => resolver()
    this.mediaRecorder.stop()

    if (this.inputStream) {
      this.inputStream.getTracks().forEach(s => s.stop())
      this.inputStream = null
    }

    return promise.then(() => this.buildOutputBlob())
  }

  private buildOutputBlob(): Blob {
    return new Blob(this.recordedChunks, { type: BLOB_TYPE })
  }
}

export default ScreenCastRecorder
