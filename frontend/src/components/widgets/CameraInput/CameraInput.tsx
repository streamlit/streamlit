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
import _ from "lodash"

import {
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
  CameraInput as CameraInputProto,
} from "src/autogen/proto"

import { FormClearHelper } from "src/components/widgets/Form"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { logError } from "src/lib/log"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"

import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"
import {
  UploadFileInfo,
  UploadedStatus,
  UploadingStatus,
} from "../FileUploader/UploadFileInfo"

import CameraInputButton from "./CameraInputButton"
import WebcamComponent from "./WebcamComponent"

import { StyledBox, StyledCameraInput } from "./styled-components"

export interface Props {
  element: CameraInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  disabled: boolean
  width: number
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

interface State {
  /**
   * Base64-encoded image data of the current frame from the camera.
   */
  imgSrc: string | null

  shutter: boolean

  minShutterEffectPassed: boolean
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

class CameraInput extends React.PureComponent<Props, State> {
  private localFileIdCounter = 1

  private readonly formClearHelper = new FormClearHelper()

  public constructor(props: Props) {
    super(props)
    this.state = this.initialValue
  }

  private getProgress = (): number | null | undefined => {
    if (
      this.state.files.length > 0 &&
      this.state.files[this.state.files.length - 1].status.type === "uploading"
    ) {
      const status = this.state.files[this.state.files.length - 1]
        .status as UploadingStatus
      return status.progress
    }
    return undefined
  }

  private handleCapture = (imageSrc: string | null): Promise<void> => {
    if (imageSrc === null) {
      return Promise.resolve()
    }

    this.setState({
      imgSrc: imageSrc,
      shutter: true,
      minShutterEffectPassed: false,
    })

    const promise = urltoFile(
      imageSrc,
      `camera-input-${new Date().toISOString()}.jpg`
    )
      .then(file => this.uploadFile(file))
      .then(() => {
        setTimeout(() => {
          this.setState({
            imgSrc: imageSrc,
            shutter: this.state.shutter,
            minShutterEffectPassed: true,
          })
        }, 150)
      })
      .catch(err => {
        // Add more meaningful error handling
        logError(err)
      })

    return promise
  }

  private removeCapture = (): void => {
    if (this.state.files.length === 0) {
      return
    }

    this.state.files.forEach(file => this.deleteFile(file.id))

    this.setState({
      imgSrc: null,
    })
  }

  get initialValue(): State {
    const emptyState = {
      files: [],
      newestServerFileId: 0,
      imgSrc: null,
      // Represents whether file uploading is done
      shutter: false,
      // Represents whether minimum shutter time has passed
      minShutterEffectPassed: true,
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

    // return {
    //   imgSrc: null,
    //   files: uploadedFileInfo.map(f => {
    //     const name = f.name as string
    //     const size = f.size as number
    //     const serverFileId = f.id as number

    //     return new UploadFileInfo(name, size, this.nextLocalFileId(), {
    //       type: "uploaded",
    //       serverFileId,
    //     })
    //   }),
    //   newestServerFileId: Number(maxFileId),
    // }
    return emptyState
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
    const { element, widgetMgr, disabled, width } = this.props

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    if (!this.state.imgSrc) {
      return (
        <StyledCameraInput width={width} className="row-widget stCameraInput">
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
          <WebcamComponent
            handleCapture={this.handleCapture}
            width={width}
            disabled={disabled}
          />
        </StyledCameraInput>
      )
    }

    return (
      <StyledCameraInput width={width} className="row-widget stCameraInput">
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
        <StyledBox width={width}>
          <img
            src={this.state.imgSrc}
            alt="Screenshot"
            style={{
              objectFit: "contain",
              opacity:
                this.state.shutter || !this.state.minShutterEffectPassed
                  ? "50%"
                  : "100%",
              // this may need to use theme but getting invalid hook usage
              borderRadius: `.25rem .25rem 0 0`,
            }}
            width={width}
            height={(width * 9) / 16}
          />
        </StyledBox>
        <CameraInputButton
          onClick={this.removeCapture}
          progress={this.getProgress()}
          disabled={!!this.getProgress()}
        >
          {this.getProgress() ? "Uploading..." : "Clear Photo"}
        </CameraInputButton>
      </StyledCameraInput>
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
      shutter: false,
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
    this.setState({ files: [], imgSrc: null })
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

export default CameraInput
