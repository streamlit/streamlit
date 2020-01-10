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

  async initialize(): Promise<any> {
    // @ts-ignore
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

  start(): boolean {
    try {
      this.mediaRecorder && this.mediaRecorder.start()
    } catch (e) {
      return false
    }

    return true
  }

  stop(): Promise<any> | undefined {
    if (!this.mediaRecorder) {
      return undefined
    }

    let resolver: any

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
