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
import _, { fill } from "lodash"

import { AspectRatioBox, AspectRatioBoxBody } from "baseui/aspect-ratio-box"

import {
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
  CameraImageInput as CameraImageInputProto,
} from "src/autogen/proto"

import ProgressBar, { Size } from "src/components/shared/ProgressBar"
import Webcam from "react-webcam"

import { FormClearHelper } from "src/components/widgets/Form"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import UIButton, { Kind } from "src/components/shared/Button"
import {
  UploadFileInfo,
  UploadedStatus,
  UploadingStatus,
} from "../FileUploader/UploadFileInfo"
import {
  StyledCameraImageInput,
  StyledCameraImageInputButton,
} from "./styled-components"

export interface Props {
  element: CameraImageInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  disabled: boolean
  width: number
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

interface State {
  imgSrc: string | null
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

  webcamRequestState: string
}

class CameraImageInput extends React.PureComponent<Props, State> {
  private localFileIdCounter = 1

  private readonly formClearHelper = new FormClearHelper()

  private webcamRef: React.RefObject<any>

  public constructor(props: Props) {
    super(props)
    this.webcamRef = React.createRef()
    this.state = this.initialValue
    this.capture = this.capture.bind(this)
    this.removeCapture = this.removeCapture.bind(this)
    this.onMediaError = this.onMediaError.bind(this)
    this.onUserMedia = this.onUserMedia.bind(this)
  }

  private capture(): void {
    const imageSrc = this.webcamRef.current.getScreenshot()
    this.setState({
      imgSrc: imageSrc,
    })

    urltoFile(imageSrc, `camera-input-${new Date().toISOString()}.jpg`)
      .then(file => this.uploadFile(file))
      .catch(err => {
        // console.log(err)
      })
  }

  private removeCapture(): void {
    if (this.state.files.length === 0) {
      return
    }

    this.state.files.forEach(file => this.deleteFile(file.id))

    this.setState({
      imgSrc: null,
    })
  }

  private onMediaError(): void {
    this.setState({
      webcamRequestState: "error",
    })
    console.log("Caught this on media error")
  }

  private onUserMedia(): void {
    this.setState({
      webcamRequestState: "success",
    })
  }

  get initialValue(): State {
    const emptyState = {
      files: [],
      newestServerFileId: 0,
      imgSrc: null,
      webcamRequestState: "pending",
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
      imgSrc: null,
      webcamRequestState: "pending",
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

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  /**
   * Return the FileUploader's current status, which is derived from
   * its state.
   */
  public get status(): FileUploaderStatus {
    const isFileUpdating = (file: UploadFileInfo): boolean =>
      file.status.type === "uploading"

    // If any of our files is Uploading or Deleting, then we're currently
    // updating.
    if (this.state.files.some(isFileUpdating)) {
      return "updating"
    }

    return "ready"
  }

  public componentDidUpdate = (prevProps: Props): void => {
    const { element, widgetMgr } = this.props

    // Widgets are disabled if the app is not connected anymore.
    // If the app disconnects from the server, a new session is created and users
    // will lose access to the files they uploaded in their previous session.
    // If we are reconnecting, reset the file uploader so that the widget is
    // in sync with the new session.
    if (prevProps.disabled !== this.props.disabled && this.props.disabled) {
      this.reset()
      widgetMgr.setFileUploaderStateValue(
        element,
        new FileUploaderStateProto(),
        { fromUi: false }
      )
      return
    }

    // Maybe send a widgetValue update to the widgetStateManager.

    // If our status is not "ready", then we have uploads in progress.
    // We won't submit a new widgetValue until all uploads have resolved.
    if (this.status !== "ready") {
      return
    }

    // If we have had no completed uploads, our widgetValue will be
    // undefined, and we can early-out of the state update.
    const newWidgetValue = this.createWidgetValue()
    if (newWidgetValue === undefined) {
      return
    }

    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (!_.isEqual(newWidgetValue, prevWidgetValue)) {
      widgetMgr.setFileUploaderStateValue(element, newWidgetValue, {
        fromUi: true,
      })
    }
  }

  /**
   * When the server receives the widget value, it deletes "orphaned" uploaded
   * files. An orphaned file is any file, associated with this uploader,
   * whose file ID is not in the file ID list, and whose
   * ID is <= `newestServerFileId`. This logic ensures that a FileUploader
   * within a form doesn't have any of its "unsubmitted" uploads prematurely
   * deleted when the script is re-run.
   */
  private createWidgetValue(): FileUploaderStateProto | undefined {
    if (this.state.newestServerFileId === 0) {
      // If newestServerFileId is 0, we've had no transaction with the server,
      // and therefore no widget value.
      return undefined
    }

    const uploadedFileInfo: UploadedFileInfoProto[] = this.state.files
      .filter(f => f.status.type === "uploaded")
      .map(f => {
        const { name, size, status } = f
        return new UploadedFileInfoProto({
          id: (status as UploadedStatus).serverFileId,
          name,
          size,
        })
      })

    return new FileUploaderStateProto({
      maxFileId: this.state.newestServerFileId,
      uploadedFileInfo,
    })
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState({ files: [] }, () => {
      const newWidgetValue = this.createWidgetValue()
      if (newWidgetValue == null) {
        return
      }

      this.setState({
        imgSrc: null,
      })

      this.props.widgetMgr.setFileUploaderStateValue(
        this.props.element,
        newWidgetValue,
        { fromUi: true }
      )
    })
  }

  public render = (): React.ReactNode => {
    const { element, widgetMgr, width } = this.props
    console.log(width)
    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    // temporary disable. Will need to determine the return type for this function.
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const webcam = () => (
      <Webcam
        audio={false}
        ref={this.webcamRef}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
        onUserMediaError={this.onMediaError}
        onUserMedia={this.onUserMedia}
        videoConstraints={{
          // Make sure that we don't go over the width on wide mode
          width: Math.min(1080, width),
        }}
      />
    )
    const smallWebcam = () => (
      <Webcam
        audio={false}
        ref={this.webcamRef}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
        onUserMediaError={this.onMediaError}
        onUserMedia={this.onUserMedia}
        videoConstraints={{
          // Make sure that we don't go over the width on wide mode
          width: 1,
          height: 1,
        }}
      />
    )

    const webcamSuccess = () => (
      <StyledCameraImageInput
        width={width}
        className="row-widget stCameraInput"
      >
        <AspectRatioBox
          aspectRatio={16 / 9}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <AspectRatioBoxBody as={webcam}></AspectRatioBoxBody>
        </AspectRatioBox>
        <StyledCameraImageInputButton>
          <UIButton kind={Kind.PRIMARY} onClick={this.capture}>
            Take photo
          </UIButton>
        </StyledCameraImageInputButton>
        {this.state.files.length > 0 &&
          this.state.files[this.state.files.length - 1].status.type ===
            "uploading" && (
            <ProgressBar
              value={
                (this.state.files[this.state.files.length - 1]
                  .status as UploadingStatus).progress
              }
              overrides={{
                Bar: {
                  style: {
                    marginLeft: 0,
                    marginTop: "4px",
                  },
                },
              }}
            />
          )}
      </StyledCameraImageInput>
    )

    if (!this.state.imgSrc) {
      return (
        <div>
          <WidgetLabel label={element.label}>
            {element.help && (
              <StyledWidgetLabelHelp>
                <TooltipIcon
                  content={element.help}
                  placement={Placement.TOP_RIGHT}
                />
              </StyledWidgetLabelHelp>
            )}
          </WidgetLabel>
          {this.state.webcamRequestState === "error" && (
            <div>
              <AspectRatioBox aspectRatio={16 / 9}>
                <AspectRatioBoxBody
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                  backgroundColor="#f0f2f6"
                  overrides={{
                    Block: {
                      style: {
                        borderLeftStyle: "solid",
                        borderRightStyle: "solid",
                        borderTopStyle: "solid",
                        borderBottomStyle: "solid",
                        borderLeftWidth: "2px",
                        borderTopWidth: "2px",
                        borderRightWidth: "2px",
                        borderBottomWidth: "2px",
                        borderLeftColor: `grey`,
                        borderTopColor: `grey`,
                        borderRightColor: `grey`,
                        borderBottomColor: `grey`,
                        borderRadius: `30px`,
                      },
                    },
                  }}
                >
                  {
                    // this image will need to be updated
                  }
                  <img
                    src="https://www.clipartmax.com/png/middle/58-586156_video-camera-icons-clipart-font-awesome-video-camera.png"
                    alt="camera_input"
                    width={width / 8}
                    height="35px"
                  ></img>
                  This App would like to use your Camera.
                  <br />
                  <a href="https://www.streamlit.io">
                    Learn how to allow access.
                  </a>
                </AspectRatioBoxBody>
              </AspectRatioBox>
              <StyledCameraImageInputButton>
                <UIButton kind={Kind.PRIMARY} onClick={this.capture}>
                  Take photo
                </UIButton>
              </StyledCameraImageInputButton>
            </div>
          )}
          {this.state.webcamRequestState === "pending" && (
            <div>
              <AspectRatioBox aspectRatio={16 / 9} backgroundColor="#f0f2f6">
                <AspectRatioBoxBody
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                  backgroundColor="#f0f2f6"
                  overrides={{
                    Block: {
                      style: {
                        borderLeftStyle: "solid",
                        borderRightStyle: "solid",
                        borderTopStyle: "solid",
                        borderBottomStyle: "solid",
                        borderLeftWidth: "2px",
                        borderTopWidth: "2px",
                        borderRightWidth: "2px",
                        borderBottomWidth: "2px",
                        borderLeftColor: `grey`,
                        borderTopColor: `grey`,
                        borderRightColor: `grey`,
                        borderBottomColor: `grey`,
                        borderRadius: `30px`,
                      },
                    },
                  }}
                >
                  This App would like to use your Camera.
                  <br />
                  <a href="https://www.streamlit.io">
                    Learn how to allow access.
                  </a>
                </AspectRatioBoxBody>
              </AspectRatioBox>
              <AspectRatioBox aspectRatio={16 / 9}>
                <AspectRatioBoxBody
                  as={smallWebcam}
                  width="1"
                  height="1"
                ></AspectRatioBoxBody>
              </AspectRatioBox>
              <StyledCameraImageInputButton>
                <UIButton kind={Kind.PRIMARY} onClick={this.capture}>
                  Take photo
                </UIButton>
              </StyledCameraImageInputButton>
            </div>
          )}
          {this.state.webcamRequestState === "success" && (
            <AspectRatioBox
              aspectRatio={16 / 9}
              display="flex"
              alignItems="center"
              justifyContent="center"
              backgroundColor="gray"
              overrides={{
                Block: {
                  style: {
                    borderRadius: `30px`,
                    width,
                  },
                },
              }}
            >
              <AspectRatioBoxBody
                as={webcamSuccess}
                overrides={{
                  Block: {
                    style: {
                      borderRadius: `30px`,
                      width,
                    },
                  },
                }}
              ></AspectRatioBoxBody>
            </AspectRatioBox>
          )}
        </div>
      )
    }

    return (
      <div>
        <div>
          <WidgetLabel label={element.label}>
            {element.help && (
              <StyledWidgetLabelHelp>
                <TooltipIcon
                  content={element.help}
                  placement={Placement.TOP_RIGHT}
                />
              </StyledWidgetLabelHelp>
            )}
          </WidgetLabel>
          <AspectRatioBox
            aspectRatio={16 / 9}
            display="flex"
            alignItems="center"
            justifyContent="center"
            backgroundColor="gray"
            overrides={{
              Block: {
                style: {
                  objectFit: "contain",
                  borderRadius: `30px`,
                },
              },
            }}
          >
            <AspectRatioBoxBody
              as="img"
              src={this.state.imgSrc}
              backgroundColor="gray"
              overrides={{
                Block: {
                  style: {
                    display: "flex",
                    justifyContent: "center",
                    alignContent: "center",
                    backgroundColor: "gray",
                    objectFit: "contain",
                    borderRadius: `30px`,
                    width,
                  },
                },
              }}
            ></AspectRatioBoxBody>
          </AspectRatioBox>
          <StyledCameraImageInputButton>
            <UIButton kind={Kind.PRIMARY} onClick={this.removeCapture}>
              Clear photo
            </UIButton>
          </StyledCameraImageInputButton>
        </div>
      </div>
    )
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

  /**
   * Clear files and errors, and reset the widget to its READY state.
   */
  private reset = (): void => {
    this.setState({ files: [] })
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

function urltoFile(url: string, filename: string): Promise<File> {
  return fetch(url)
    .then(res => res.arrayBuffer())
    .then(buf => new File([buf], filename, { type: "image/jpeg" }))
}

export default CameraImageInput
