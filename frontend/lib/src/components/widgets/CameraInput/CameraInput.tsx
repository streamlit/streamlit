/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import { X } from "@emotion-icons/open-iconic"
import axios from "axios"
import isEqual from "lodash/isEqual"

import {
  CameraInput as CameraInputProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/lib/src/proto"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { logError } from "@streamlit/lib/src/util/log"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"
import {
  UploadedStatus,
  UploadFileInfo,
  UploadingStatus,
} from "@streamlit/lib/src/components/widgets/FileUploader/UploadFileInfo"

import CameraInputButton from "./CameraInputButton"
import { FacingMode } from "./SwitchFacingModeButton"
import {
  StyledBox,
  StyledCameraInput,
  StyledImg,
  StyledSpan,
} from "./styled-components"
import WebcamComponent, { WebcamPermission } from "./WebcamComponent"

export interface Props {
  element: CameraInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  disabled: boolean
  width: number
  fragmentId?: string
  // Allow for unit testing
  testOverride?: WebcamPermission
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

export interface State {
  /**
   * Base64-encoded image data of the current frame from the camera.
   */
  imgSrc: string | null

  shutter: boolean

  minShutterEffectPassed: boolean
  /**
   * List of files (snapshots) captured by the user.
   * Should contain exact one element if the user has taken a snapshot.
   */
  files: UploadFileInfo[]

  /**
   * Represents whether the component is in clear photo mode,
   * when snapshot removed and new Webcam component is not shown yet.
   * Time interval between `Clear Photo` button clicked and access to Webcam received again
   */
  clearPhotoInProgress: boolean

  /**
   * User facing mode for mobile devices. If `user`, the camera will be facing the user (front camera).
   * If `environment`, the camera will be facing the environment (back camera).
   */
  facingMode: FacingMode
}

const MIN_SHUTTER_EFFECT_TIME_MS = 150

class CameraInput extends React.PureComponent<Props, State> {
  private localFileIdCounter = 1

  private RESTORED_FROM_WIDGET_STRING = "RESTORED_FROM_WIDGET"

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

  private setClearPhotoInProgress = (clearPhotoInProgress: boolean): void => {
    this.setState({ clearPhotoInProgress })
  }

  private setFacingMode = (): void => {
    this.setState(prevState => ({
      facingMode:
        prevState.facingMode === FacingMode.USER
          ? FacingMode.ENVIRONMENT
          : FacingMode.USER,
    }))
  }

  private handleCapture = (imgSrc: string | null): Promise<void> => {
    if (imgSrc === null) {
      return Promise.resolve()
    }

    this.setState({
      imgSrc,
      shutter: true,
      minShutterEffectPassed: false,
    })

    const delay = (t: number): Promise<ReturnType<typeof setTimeout>> =>
      new Promise(resolve => setTimeout(resolve, t))

    return urltoFile(
      imgSrc,
      `camera-input-${new Date().toISOString().replace(/:/g, "_")}.jpg`
    )
      .then(file =>
        this.props.uploadClient
          .fetchFileURLs([file])
          .then(fileURLsArray => ({ file: file, fileUrls: fileURLsArray[0] }))
      )
      .then(({ file, fileUrls }) => this.uploadFile(fileUrls, file))
      .then(() => delay(MIN_SHUTTER_EFFECT_TIME_MS))
      .then(() => {
        this.setState((prevState, _) => {
          return {
            imgSrc,
            shutter: prevState.shutter,
            minShutterEffectPassed: true,
          }
        })
      })
      .catch(err => {
        logError(err)
      })
  }

  private removeCapture = (): void => {
    if (this.state.files.length === 0) {
      return
    }

    this.state.files.forEach(file => this.deleteFile(file.id))

    this.setState({
      imgSrc: null,
      clearPhotoInProgress: true,
    })
  }

  get initialValue(): State {
    const emptyState = {
      files: [],
      imgSrc: null,
      shutter: false,
      minShutterEffectPassed: true,
      clearPhotoInProgress: false,
      facingMode: FacingMode.USER,
    }
    const { widgetMgr, element } = this.props

    const widgetValue = widgetMgr.getFileUploaderStateValue(element)

    if (isNullOrUndefined(widgetValue)) {
      return emptyState
    }

    const { uploadedFileInfo } = widgetValue
    if (isNullOrUndefined(uploadedFileInfo) || uploadedFileInfo.length === 0) {
      return emptyState
    }

    return {
      files: uploadedFileInfo.map(f => {
        const name = f.name as string
        const size = f.size as number

        const fileId = f.fileId as string
        const fileUrls = f.fileUrls as FileURLsProto

        return new UploadFileInfo(name, size, this.nextLocalFileId(), {
          type: "uploaded",
          fileId,
          fileUrls,
        })
      }),
      imgSrc:
        uploadedFileInfo.length === 0 ? "" : this.RESTORED_FROM_WIDGET_STRING,
      shutter: false,
      minShutterEffectPassed: false,
      clearPhotoInProgress: false,
      facingMode: FacingMode.USER,
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

  public componentDidUpdate = (): void => {
    // If our status is not "ready", then we have uploads in progress.
    // We won't submit a new widgetValue until all uploads have resolved.
    if (this.status !== "ready") {
      return
    }

    // If we have had no completed uploads, our widgetValue will be
    // undefined, and we can early-out of the state update.
    const newWidgetValue = this.createWidgetValue()

    const { element, widgetMgr, fragmentId } = this.props

    // Maybe send a widgetValue update to the widgetStateManager.
    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (!isEqual(newWidgetValue, prevWidgetValue)) {
      widgetMgr.setFileUploaderStateValue(
        element,
        newWidgetValue,
        {
          fromUi: true,
        },
        fragmentId
      )
    }
  }

  public componentDidMount(): void {
    const newWidgetValue = this.createWidgetValue()
    const { element, widgetMgr, fragmentId } = this.props

    // Set the state value on mount, to avoid triggering an extra rerun after
    // the first rerun.
    // We use same primitives as in file uploader widget,
    // since simanticly camera_input is just a special case of file uploader.
    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (prevWidgetValue === undefined) {
      widgetMgr.setFileUploaderStateValue(
        element,
        newWidgetValue,
        {
          fromUi: false,
        },
        fragmentId
      )
    }
  }

  private createWidgetValue(): FileUploaderStateProto {
    const uploadedFileInfo: UploadedFileInfoProto[] = this.state.files
      .filter(f => f.status.type === "uploaded")
      .map(f => {
        const { name, size, status } = f
        return new UploadedFileInfoProto({
          fileId: (status as UploadedStatus).fileId,
          fileUrls: (status as UploadedStatus).fileUrls,
          name,
          size,
        })
      })

    return new FileUploaderStateProto({ uploadedFileInfo })
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState({ files: [] }, () => {
      const newWidgetValue = this.createWidgetValue()
      if (isNullOrUndefined(newWidgetValue)) {
        return
      }

      this.setState({
        imgSrc: null,
      })

      const { widgetMgr, element, fragmentId } = this.props
      widgetMgr.setFileUploaderStateValue(
        element,
        newWidgetValue,
        { fromUi: true },
        fragmentId
      )
    })
  }

  public render(): React.ReactNode {
    const { element, widgetMgr, disabled, width } = this.props

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <StyledCameraInput className="stCameraInput" data-testid="stCameraInput">
        <WidgetLabel
          label={element.label}
          disabled={disabled}
          labelVisibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
        >
          {element.help && (
            <StyledWidgetLabelHelp>
              <TooltipIcon
                content={element.help}
                placement={Placement.TOP_RIGHT}
              />
            </StyledWidgetLabelHelp>
          )}
        </WidgetLabel>
        {this.state.imgSrc ? (
          <>
            <StyledBox width={width}>
              {this.state.imgSrc !== this.RESTORED_FROM_WIDGET_STRING && (
                <StyledImg
                  src={this.state.imgSrc}
                  alt="Snapshot"
                  opacity={
                    this.state.shutter || !this.state.minShutterEffectPassed
                      ? "50%"
                      : "100%"
                  }
                  width={width}
                  height={(width * 9) / 16}
                />
              )}
            </StyledBox>
            <CameraInputButton
              onClick={this.removeCapture}
              progress={this.getProgress()}
              disabled={!!this.getProgress() || disabled}
            >
              {this.getProgress() ? (
                "Uploading..."
              ) : (
                <StyledSpan>
                  <Icon content={X} margin="0 xs 0 0" size="sm" /> Clear photo
                </StyledSpan>
              )}
            </CameraInputButton>
          </>
        ) : (
          <WebcamComponent
            handleCapture={this.handleCapture}
            width={width}
            disabled={disabled}
            clearPhotoInProgress={this.state.clearPhotoInProgress}
            setClearPhotoInProgress={this.setClearPhotoInProgress}
            facingMode={this.state.facingMode}
            setFacingMode={this.setFacingMode}
            testOverride={this.props.testOverride}
          />
        )}
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
    if (isNullOrUndefined(file)) {
      return
    }

    if (file.status.type === "uploading") {
      // The file hasn't been uploaded. Let's cancel the request.
      // However, it may have been received by the server so we'll still
      // send out a request to delete.
      file.status.cancelToken.cancel()
    }

    if (file.status.type === "uploaded" && file.status.fileUrls.deleteUrl) {
      this.props.uploadClient.deleteFile(file.status.fileUrls.deleteUrl)
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
    fileUrls: IFileURLs
  ): void => {
    this.setState(() => ({
      shutter: false,
    }))

    const curFile = this.getFile(localFileId)
    if (isNullOrUndefined(curFile) || curFile.status.type !== "uploading") {
      // The file may have been canceled right before the upload
      // completed. In this case, we just bail.
      return
    }

    this.updateFile(
      curFile.id,
      curFile.setStatus({
        type: "uploaded",
        fileId: fileUrls.fileId as string,
        fileUrls,
      })
    )
  }

  /**
   * Callback for file upload progress. Updates a single file's local `progress`
   * state.
   */
  private onUploadProgress = (event: ProgressEvent, fileId: number): void => {
    const file = this.getFile(fileId)
    if (isNullOrUndefined(file) || file.status.type !== "uploading") {
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

  public uploadFile = (fileURLs: IFileURLs, file: File): void => {
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
        fileURLs.uploadUrl as string,
        file,
        e => this.onUploadProgress(e, uploadingFileInfo.id),
        cancelToken.token
      )
      .then(() => this.onUploadComplete(uploadingFileInfo.id, fileURLs))
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
