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

import { FileUploader as FileUploaderProto } from "autogen/proto"
import axios from "axios"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"

import { FileSize, getSizeDisplay, sizeConverter } from "lib/FileHelper"
import { FileUploadClient } from "lib/FileUploadClient"
import { logWarning } from "lib/log"
import { WidgetStateManager } from "lib/WidgetStateManager"
import React from "react"
import { FileRejection } from "react-dropzone"
import FileDropzone from "./FileDropzone"
import { StyledFileUploader } from "./styled-components"
import UploadedFiles from "./UploadedFiles"
import { UploadFileInfo } from "./UploadFileInfo"

export interface Props {
  disabled: boolean
  element: FileUploaderProto
  widgetStateManager: WidgetStateManager
  uploadClient: FileUploadClient
  width: number
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

export interface State {
  // List of files provided by the user. This can include rejected files that
  // will not be uploaded.
  files: UploadFileInfo[]
}

/** Compute FileUploaderStatus for the given state. */
function getFileUploaderStatus(state: State): FileUploaderStatus {
  const isFileUpdating = (file: UploadFileInfo): boolean =>
    file.status.type === "uploading" || file.status.type === "deleting"

  // If any of our files is Uploading or Deleting, then we're currently
  // updating.
  if (state.files.some(isFileUpdating)) {
    return "updating"
  }

  return "ready"
}

class FileUploader extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { files: [] }
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
    return getFileUploaderStatus(this.state)
  }

  public componentDidUpdate = (prevProps: Props, prevState: State): void => {
    const widgetId = this.props.element.id

    // Widgets are disabled if the app is not connected anymore.
    // If the app disconnects from the server, a new session is created and users
    // will lose access to the files they uploaded in their previous session.
    // If we are reconnecting, reset the file uploader so that the widget is
    // in sync with the new session.
    if (prevProps.disabled !== this.props.disabled && this.props.disabled) {
      this.reset()
      this.props.widgetStateManager.setStringArrayValue(widgetId, [], {
        fromUi: false,
      })
      return
    }

    // If there are no files updating or deleting, we pass the list
    // of uploaded fileIDs to widgetStateManager, to trigger a re-run.
    const prevStatus = getFileUploaderStatus(prevState)
    if (this.status === "ready" && prevStatus !== "ready") {
      this.props.widgetStateManager.setStringArrayValue(
        widgetId,
        this.uploadedFileIds,
        { fromUi: true }
      )
    }
  }

  /** Return an Array of fileIDs for each uploaded file. */
  private get uploadedFileIds(): string[] {
    return this.state.files
      .filter(file => file.status.type === "uploaded")
      .map(file => file.id)
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
      this.removeFile(this.state.files[0].id || "")
    }

    // Upload each accepted file.
    acceptedFiles.forEach(this.uploadFile)

    // Create an UploadFileInfo for each of our rejected files, and add them to
    // our state.
    if (rejectedFiles.length > 0) {
      const rejectedInfos = rejectedFiles.map(rejected => {
        return new UploadFileInfo(rejected.file, {
          type: "error",
          errorMessage: this.getErrorMessage(
            rejected.errors[0].code,
            rejected.file
          ),
        })
      })
      this.addFiles(rejectedInfos)
    }
  }

  public uploadFile = (file: File): void => {
    // Create an UploadFileInfo for this file and add it to our state.
    const cancelToken = axios.CancelToken.source()
    const uploadingFile = new UploadFileInfo(file, {
      type: "uploading",
      cancelToken,
      progress: 1,
    })
    this.addFile(uploadingFile)

    this.props.uploadClient
      .uploadFiles(
        this.props.element.id,
        [uploadingFile],
        e => this.onUploadProgress(e, uploadingFile.id),
        cancelToken.token,
        !this.props.element.multipleFiles
      )
      .then(() => {
        this.updateFile(
          uploadingFile.id,
          uploadingFile.setStatus({ type: "uploaded" })
        )
      })
      .catch(err => {
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          this.updateFile(
            uploadingFile.id,
            uploadingFile.setStatus({
              type: "error",
              errorMessage: err ? err.toString() : "Unknown error",
            })
          )
        }
      })
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
   * - Tell the server to delete its remote copy of the file
   * - Remove the fileID from our local state
   */
  public deleteFile = (fileId: string): void => {
    const file = this.state.files.find(file => file.id === fileId)
    if (file == null) {
      return
    }

    if (file.status.type === "deleting") {
      // The file is already being deleted - nothing to do.
      return
    }

    if (file.status.type === "error") {
      this.removeFile(fileId)
      return
    }

    if (file.status.type === "uploading") {
      // The file hasn't been uploaded. Let's cancel the request.
      // However, it may have been received by the server so we'll still
      // send out a request to delete.
      file.status.cancelToken.cancel()
    }

    // Update the file's status to "deleting"
    this.updateFile(fileId, file.setStatus({ type: "deleting" }))

    this.props.uploadClient
      .delete(this.props.element.id, fileId)
      .then(() => this.removeFile(fileId))
      .catch(err => {
        // The deletion failed for some reason.
        logWarning(`uploadClient.delete error: ${err}`)
        this.updateFile(
          fileId,
          file.setStatus({ type: "error", errorMessage: `${err}` })
        )
      })
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
  private removeFile = (idToRemove: string): void => {
    this.setState(state => ({
      files: state.files.filter(file => file.id !== idToRemove),
    }))
  }

  /** Replace the file with the given id in `state.files`. */
  private updateFile = (
    idToUpdate: string,
    replacement: UploadFileInfo
  ): void => {
    this.setState(state => ({
      files: state.files.map(file =>
        file.id === idToUpdate ? replacement : file
      ),
    }))
  }

  /**
   * Callback for file upload progress. Updates a single file's local `progress`
   * state.
   */
  private onUploadProgress = (event: ProgressEvent, fileId: string): void => {
    const file = this.state.files.find(file => file.id === fileId)
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

  public render = (): React.ReactNode => {
    const { files } = this.state
    const { element, disabled } = this.props
    const acceptedExtensions = element.type

    // We display files in the reverse order they were added.
    // This way, if you have multiple pages of uploaded files and then drop
    // another one, you'll see that newest file at the top of the first page.
    const newestToOldestFiles = files.slice().reverse()

    return (
      <StyledFileUploader data-testid="stFileUploader">
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        <FileDropzone
          onDrop={this.dropHandler}
          multiple={element.multipleFiles}
          acceptedExtensions={acceptedExtensions}
          maxSizeBytes={this.maxUploadSizeInBytes}
          disabled={disabled}
        />
        <UploadedFiles
          items={newestToOldestFiles}
          pageSize={3}
          onDelete={this.deleteFile}
          resetOnAdd
        />
      </StyledFileUploader>
    )
  }
}

export default FileUploader
