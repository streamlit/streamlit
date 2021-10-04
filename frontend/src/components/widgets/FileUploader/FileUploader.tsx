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

import axios from "axios"
import _ from "lodash"
import React from "react"
import { FileRejection } from "react-dropzone"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "src/autogen/proto"
import { FormClearHelper } from "src/components/widgets/Form"

import { FileSize, getSizeDisplay, sizeConverter } from "src/lib/FileHelper"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import FileDropzone from "./FileDropzone"
import { StyledFileUploader } from "./styled-components"
import UploadedFiles from "./UploadedFiles"
import { UploadFileInfo, UploadedStatus } from "./UploadFileInfo"

export interface Props {
  disabled: boolean
  element: FileUploaderProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  width: number
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

export interface State {
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

class FileUploader extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  /**
   * A counter for assigning unique internal IDs to each file tracked
   * by the uploader. These IDs are used to update file state internally,
   * and are separate from the serverFileIds that are returned by the server.
   */
  private localFileIdCounter = 1

  public constructor(props: Props) {
    super(props)
    this.state = this.initialValue
  }

  get initialValue(): State {
    const emptyState = { files: [], newestServerFileId: 0 }
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
   * Return this.props.element.maxUploadSizeMb, converted to bytes.
   */
  private get maxUploadSizeInBytes(): number {
    const maxMbs = this.props.element.maxUploadSizeMb
    return sizeConverter(maxMbs, FileSize.Megabyte, FileSize.Byte)
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
   * Clear files and errors, and reset the widget to its READY state.
   */
  private reset = (): void => {
    this.setState({ files: [] })
  }

  /**
   * Called by react-dropzone when files and drag-and-dropped onto the widget.
   *
   * @param acceptedFiles an array of files.
   * @param rejectedFiles an array of FileRejections. A FileRejection
   * encapsulates a File and an error indicating why it was rejected by
   * the dropzone widget.
   */
  private dropHandler = (
    acceptedFiles: File[],
    rejectedFiles: FileRejection[]
  ): void => {
    const { element } = this.props
    const { multipleFiles } = element

    // If this is a single-file uploader and multiple files were dropped,
    // all the files will be rejected. In this case, we pull out the first
    // valid file into acceptedFiles, and reject the rest.
    if (
      !multipleFiles &&
      acceptedFiles.length === 0 &&
      rejectedFiles.length > 1
    ) {
      const firstFileIndex = rejectedFiles.findIndex(
        file =>
          file.errors.length === 1 && file.errors[0].code === "too-many-files"
      )

      if (firstFileIndex >= 0) {
        acceptedFiles.push(rejectedFiles[firstFileIndex].file)
        rejectedFiles.splice(firstFileIndex, 1)
      }
    }

    // If this is a single-file uploader that already has a file,
    // remove that file so that it can be replaced with our new one.
    if (
      !multipleFiles &&
      acceptedFiles.length > 0 &&
      this.state.files.length > 0
    ) {
      this.removeFile(this.state.files[0].id)
    }

    // Upload each accepted file.
    acceptedFiles.forEach(this.uploadFile)

    // Create an UploadFileInfo for each of our rejected files, and add them to
    // our state.
    if (rejectedFiles.length > 0) {
      const rejectedInfos = rejectedFiles.map(rejected => {
        const { file } = rejected
        return new UploadFileInfo(
          file.name,
          file.size,
          this.nextLocalFileId(),
          {
            type: "error",
            errorMessage: this.getErrorMessage(
              rejected.errors[0].code,
              rejected.file
            ),
          }
        )
      })
      this.addFiles(rejectedInfos)
    }
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
   * Return a human-readable message for the given error.
   */
  private getErrorMessage = (errorCode: string, file: File): string => {
    switch (errorCode) {
      case "file-too-large":
        return `File must be ${getSizeDisplay(
          this.maxUploadSizeInBytes,
          FileSize.Byte
        )} or smaller.`
      case "file-invalid-type":
        return `${file.type} files are not allowed.`
      case "file-too-small":
        // This should not fire.
        return `File size is too small.`
      case "too-many-files":
        return "Only one file is allowed."
      default:
        return "Unexpected error. Please try again."
    }
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
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState({ files: [] }, () => {
      const newWidgetValue = this.createWidgetValue()
      if (newWidgetValue == null) {
        return
      }

      this.props.widgetMgr.setFileUploaderStateValue(
        this.props.element,
        newWidgetValue,
        { fromUi: true }
      )
    })
  }

  public render = (): React.ReactNode => {
    const { files } = this.state
    const { element, disabled, widgetMgr } = this.props
    const acceptedExtensions = element.type

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    // We display files in the reverse order they were added.
    // This way, if you have multiple pages of uploaded files and then drop
    // another one, you'll see that newest file at the top of the first page.
    const newestToOldestFiles = files.slice().reverse()

    return (
      <StyledFileUploader data-testid="stFileUploader">
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
        <FileDropzone
          onDrop={this.dropHandler}
          multiple={element.multipleFiles}
          acceptedExtensions={acceptedExtensions}
          maxSizeBytes={this.maxUploadSizeInBytes}
          disabled={disabled}
        />
        {newestToOldestFiles.length > 0 && (
          <UploadedFiles
            items={newestToOldestFiles}
            pageSize={3}
            onDelete={this.deleteFile}
            resetOnAdd
          />
        )}
      </StyledFileUploader>
    )
  }

  private nextLocalFileId(): number {
    return this.localFileIdCounter++
  }
}

export default FileUploader
