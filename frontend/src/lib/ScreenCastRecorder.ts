/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const BLOB_TYPE = "video/webm"

interface ScreenCastRecorderOptions {
  recordAudio: boolean
}

class ScreenCastRecorder {
  recordAudio: boolean
  inputStream: MediaStream | null
  recordedChunks: Blob[]
  mediaRecorder: MediaRecorder | null

  constructor({ recordAudio }: ScreenCastRecorderOptions) {
    this.recordAudio = recordAudio

    this.inputStream = null
    this.recordedChunks = []

    this.mediaRecorder = null
  }

  /**
   * This asynchronous method will initialize the screen recording object asking
   * for permissions to the user which are needed to start recording.
   */
  async initialize(): Promise<void> {
    // @ts-ignore reason: https://github.com/microsoft/TypeScript/issues/33232
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

  getState(): string {
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
  start(): boolean {
    if (!this.mediaRecorder) {
      return false
    }

    try {
      this.mediaRecorder.start()
    } catch (e) {
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
  stop(): Promise<Blob> | undefined {
    if (!this.mediaRecorder) {
      return undefined
    }

    let resolver: () => void

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

  buildOutputBlob(): Blob {
    return new Blob(this.recordedChunks, { type: BLOB_TYPE })
  }
}

export default ScreenCastRecorder
