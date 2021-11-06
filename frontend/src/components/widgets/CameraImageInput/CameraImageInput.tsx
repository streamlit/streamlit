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
import axios from "axios"
import { CameraImageInput as CameraImageInputProto } from "src/autogen/proto"
import _ from "lodash"
import { FileSize, getSizeDisplay, sizeConverter } from "src/lib/FileHelper"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import { UploadFileInfo, UploadedStatus } from "../FileUploader/UploadFileInfo"
import "image-capture"

export interface Props {
  element: CameraImageInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
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
  /**
   * List of files dropped on the FileUploader by the user. This list includes
   * rejected files that will not be updated.
   */
  files: UploadFileInfo[]

  /**
   * The most recent file ID we've received from the server. This gets sent
   * back to the server during widget update so that it clean up
   * orphaned files. File IDs start at 1 and only ever increase, so a
   * file with a higher ID is guaranteed to be newer than one with a lower ID.
   */
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

  /**
   * Delete the file with the given ID:
   * - Cancel the file upload if it's in progress
   * - Remove the fileID from our local state
   * We don't actually tell the server to delete the file. It will garbage
   * collect it.
   */
  public deleteFile = (fileId: number): void => {
    const file = this.getFile(fileId)
    if (file == null) {
      return
    }

    if (file.status.type === "uploading") {
      // The file hasn't been uploaded. Let's cancel the request.
      // However, it may have been received by the server so we'll still
      // send out a request to delete.
      file.status.cancelToken.cancel()
    }

    this.removeFile(fileId)
  }

  /** Append the given file to `state.files`. */
  private addFile = (file: UploadFileInfo): void => {
    this.setState(state => ({ files: [...state.files, file] }))
  }

  /** Append the given files to `state.files`. */
  private addFiles = (files: UploadFileInfo[]): void => {
    this.setState(state => ({ files: [...state.files, ...files] }))
  }

  /** Remove the file with the given ID from `state.files`. */
  private removeFile = (idToRemove: number): void => {
    this.setState(state => ({
      files: state.files.filter(file => file.id !== idToRemove),
    }))
  }

  /**
   * Return the file with the given ID, if one exists.
   */
  private getFile = (fileId: number): UploadFileInfo | undefined => {
    return this.state.files.find(file => file.id === fileId)
  }

  /** Replace the file with the given id in `state.files`. */
  private updateFile = (curFileId: number, newFile: UploadFileInfo): void => {
    this.setState(curState => {
      return {
        files: curState.files.map(file =>
          file.id === curFileId ? newFile : file
        ),
      }
    })
  }

  /**
   * Called when an upload has completed. Updates the file's status, and
   * assigns it the new file ID returned from the server.
   */
  private onUploadComplete = (
    localFileId: number,
    serverFileId: number
  ): void => {
    // "state.newestServerFileId" must always hold the max fileID
    // returned from the server.
    this.setState(state => ({
      newestServerFileId: Math.max(state.newestServerFileId, serverFileId),
    }))

    const curFile = this.getFile(localFileId)
    if (curFile == null || curFile.status.type !== "uploading") {
      // The file may have been canceled right before the upload
      // completed. In this case, we just bail.
      return
    }

    this.updateFile(
      curFile.id,
      curFile.setStatus({ type: "uploaded", serverFileId })
    )
  }

  /**
   * Callback for file upload progress. Updates a single file's local `progress`
   * state.
   */
  private onUploadProgress = (event: ProgressEvent, fileId: number): void => {
    const file = this.getFile(fileId)
    if (file == null || file.status.type !== "uploading") {
      return
    }

    const newProgress = Math.round((event.loaded * 100) / event.total)
    if (file.status.progress === newProgress) {
      return
    }

    // Update file.progress
    this.updateFile(
      fileId,
      file.setStatus({
        type: "uploading",
        cancelToken: file.status.cancelToken,
        progress: newProgress,
      })
    )
  }

  public uploadFile = (file: File): void => {
    // Create an UploadFileInfo for this file and add it to our state.
    const cancelToken = axios.CancelToken.source()
    const uploadingFileInfo = new UploadFileInfo(
      file.name,
      file.size,
      this.nextLocalFileId(),
      {
        type: "uploading",
        cancelToken,
        progress: 1,
      }
    )
    this.addFile(uploadingFileInfo)

    this.props.uploadClient
      .uploadFile(
        this.props.element,
        file,
        e => this.onUploadProgress(e, uploadingFileInfo.id),
        cancelToken.token
      )
      .then(newFileId =>
        this.onUploadComplete(uploadingFileInfo.id, newFileId)
      )
      .catch(err => {
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          this.updateFile(
            uploadingFileInfo.id,
            uploadingFileInfo.setStatus({
              type: "error",
              errorMessage: err ? err.toString() : "Unknown error",
            })
          )
        }
      })
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
