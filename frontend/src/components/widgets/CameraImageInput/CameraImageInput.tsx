/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React from "react"
import { CameraImageInput as CameraImageInputProto } from "src/autogen/proto"
import _ from "lodash"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import { UploadFileInfo, UploadedStatus } from "../FileUploader/UploadFileInfo"
import "image-capture"

export interface Props {
  element: CameraImageInputProto
  widgetMgr: WidgetStateManager
  disabled: boolean
}
interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  mediaStream?: MediaStream
  mediaStreamErr?: any
  imageCapture?: any
  imageBitmap?: ImageBitmap
  photoData: any
  files: any
  newestServerFileId: number
}

enum WebcamRequestState {
  PENDING = "pending",
  SUCCESS = "success",
  FAILURE = "failure",
}

class CameraImageInput extends React.PureComponent<Props, State> {
  private localFileIdCounter = 1

  public constructor(props: Props) {
    super(props)
    this.state = this.initialValue
  }

  get initialValue(): State {
    const emptyState = {
      files: [],
      newestServerFileId: 0,
      photoData: undefined,
    }
    const { widgetMgr, element } = this.props

    const widgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (widgetValue == null) {
      return emptyState
    }

    const { maxFileId, uploadedFileInfo } = widgetValue
    if (maxFileId == null || maxFileId === 0 || uploadedFileInfo == null) {
      return emptyState
    }

    return {
      photoData: undefined,
      files: uploadedFileInfo.map(f => {
        const name = f.name as string
        const size = f.size as number
        const serverFileId = f.id as number

        return new UploadFileInfo(name, size, this.nextLocalFileId(), {
          type: "uploaded",
          serverFileId,
        })
      }),
      newestServerFileId: Number(maxFileId),
    }
  }

  public componentDidMount(): void {
    // We won't have access to mediaDevices when running in http (except on localhost).
    if (navigator.mediaDevices == null) {
      this.setState({
        mediaStreamErr: "Can't access MediaDevices. Are you running in https?",
      })
      return
    }

    const audio = false
    const video = true

    // If this browser supports querying the 'featurePolicy', check that
    // we support the requested features.
    try {
      if (video) {
        this.requireFeature("camera")
      }
      if (audio) {
        this.requireFeature("microphone")
      }
    } catch (err) {
      this.setState({ mediaStreamErr: err })
      return
    }

    // Request a media stream that fulfills our constraints.
    const constraints: MediaStreamConstraints = { audio, video }
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(this.onGotMediaStream)
      .catch(err => this.setState({ mediaStreamErr: err }))
  }

  private onGotMediaStream = (mediaStream: MediaStream): void => {
    // Extract the video track.
    let imageCapture = null
    if (mediaStream.getVideoTracks().length > 0) {
      const videoDevice = mediaStream.getVideoTracks()[0]
      const imgCaptureClass = (window as any)["ImageCapture"]
      imageCapture = new imgCaptureClass(videoDevice)
    }
    this.setState({ mediaStream, imageCapture })
  }

  /**
   * Throw an error if the feature with the given name is not in our document's
   * featurePolicy.
   */
  private requireFeature = (name: string): void => {
    // We may not be able to access `featurePolicy` - Safari doesn't support
    // accessing it, for example. In this case, the function is a no-op.
    const featurePolicy = (document as any)["featurePolicy"]
    if (featurePolicy == null) {
      return
    }

    if (!featurePolicy.allowsFeature(name)) {
      throw new Error(`'${name}' is not in our featurePolicy`)
    }
  }

  private get webcamRequestState(): WebcamRequestState {
    if (this.state.mediaStreamErr != null) {
      return WebcamRequestState.FAILURE
    }
    if (this.state.mediaStream != null) {
      return WebcamRequestState.SUCCESS
    }
    return WebcamRequestState.PENDING
  }

  /** Assign our mediaStream to a Video element. */
  private assignMediaStream = (video: HTMLVideoElement): void => {
    if (video != null && this.state.mediaStream != null) {
      video.srcObject = this.state.mediaStream
      video
        .play()
        .catch(err => console.warn(`'video.play' error: ${err.toString()}`))
    }
  }

  private captureFrame = (): void => {
    if (this.state.imageCapture == null) {
      console.warn("Can't captureFrame: no imageCapture object!")
      return
    }

    this.state.imageCapture
      .grabFrame()
      .then(renderBitmap)
      .then(
        (imageData: {
          width: any
          height: any
          data: Iterable<unknown> | ArrayLike<unknown>
        }) => {
          const data = {
            width: imageData.width,
            height: imageData.height,
            data: Array.from(imageData.data),
          }
          // Streamlit.setComponentValue(data)
          console.log(typeof data.data)
          console.log(data.data)
          console.log("COMMIT DATA!!")
          this.setState({ photoData: data.data })
        }
      )
      .catch((err: { toString: () => any }) => {
        console.error(`CaptureFrame error: ${err.toString()}`)
      })
  }

  public render = (): React.ReactNode => {
    const { element } = this.props

    const requestState = this.webcamRequestState
    const stringg = `data:image/jpg;base64,${this.state.photoData}`
    if (requestState === WebcamRequestState.SUCCESS) {
      return (
        <div>
          <video ref={this.assignMediaStream} height={500} />
          <button
            onClick={this.captureFrame}
            disabled={this.props.disabled || this.state.imageCapture == null}
          >
            Capture Frame
          </button>

          {this.state.photoData ? (
            <div>
              BABABA
              {typeof this.state.photoData}
            </div>
          ) : (
            <div> ANOTHER IMAGE {typeof this.state.photoData} </div>
          )}
        </div>
      )
    }

    if (requestState === WebcamRequestState.FAILURE) {
      return <div>Webcam error: {this.state.mediaStreamErr.toString()}</div>
    }

    return <div>Requesting webcam...</div>
  }

  private nextLocalFileId(): number {
    return this.localFileIdCounter++
  }
}

/** Render an ImageBitmap to a canvas to retrieve its ImageData. */
function renderBitmap(bitmap: ImageBitmap): ImageData {
  // Create a temporary canvas element to render into. We remove it at the end
  // of the function.
  const canvas = document.body.appendChild(document.createElement("canvas"))
  try {
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    let context = canvas.getContext("2d")
    if (context == null) {
      throw new Error("Couldn't get 2D context from <canvas>")
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    document.body.removeChild(canvas)
  }
}

export default CameraImageInput
