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
import AlertContainer, {
  Kind as AlertKind,
} from "components/shared/AlertContainer"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"

import {
  FileSize,
  FileStatus,
  getSizeDisplay,
  sizeConverter,
  UploadFileInfo,
} from "lib/FileHelper"
import { FileUploadClient } from "lib/FileUploadClient"
import { logWarning } from "lib/log"
import { WidgetStateManager } from "lib/WidgetStateManager"
import React from "react"
import { FileRejection } from "react-dropzone"
import FileDropzone from "./FileDropzone"
import { StyledFileUploader } from "./styled-components"
import UploadedFiles from "./UploadedFiles"

export interface Props {
  disabled: boolean
  element: FileUploaderProto
  widgetStateManager: WidgetStateManager
  uploadClient: FileUploadClient
  width: number
}

interface State {
  status: "READY" | "UPLOADING" | "UPLOADED" | "ERROR"
  errorMessage?: string
  // List of files provided by the user. This can include rejected files that
  // will not be uploaded.
  files: UploadFileInfo[]
}

class FileUploader extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      status: "READY",
      errorMessage: undefined,
      files: [],
    }
  }

  /**
   * Return this.props.element.maxUploadSizeMb, converted to bytes.
   */
  private get maxUploadSizeInBytes(): number {
    const maxMbs = this.props.element.maxUploadSizeMb
    return sizeConverter(maxMbs, FileSize.Megabyte, FileSize.Byte)
  }

  public componentDidUpdate = (prevProps: Props): void => {
    // Widgets are disabled if the app is not connected anymore.
    // If the app disconnects from the server, a new session is created and users
    // will lose access to the files they uploaded in their previous session.
    // If we are reconnecting, reset the file uploader so that the widget is
    // in sync with the new session.
    if (prevProps.disabled !== this.props.disabled && this.props.disabled) {
      this.reset()
    }
  }

  /**
   * Clear files and errors, and reset the widget to its READY state.
   */
  private reset = (): void => {
    this.setState({
      status: FileStatus.READY,
      errorMessage: undefined,
      files: [],
    })
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
    const rejectedInfos = rejectedFiles.map(rejected => {
      const info = new UploadFileInfo(rejected.file)
      info.status = FileStatus.ERROR
      info.errorMessage = this.getErrorMessage(
        rejected.errors[0].code,
        rejected.file
      )
      return info
    })
    this.setState(state => ({ files: [...rejectedInfos, ...state.files] }))
  }

  private uploadFile = (file: File): void => {
    // Create an UploadFileInfo for this file and add it to our state.
    const fileInfo = new UploadFileInfo(file)
    fileInfo.progress = 1
    fileInfo.status = FileStatus.UPLOADING
    fileInfo.cancelToken = axios.CancelToken.source()
    this.setState(state => ({ files: [fileInfo, ...state.files] }))

    this.props.uploadClient
      .uploadFiles(
        this.props.element.id,
        [fileInfo],
        e => this.onUploadProgress(e, fileInfo.id),
        fileInfo.cancelToken.token,
        !this.props.element.multipleFiles
      )
      .then(() => {
        // Update file state to reflect the successful upload.
        fileInfo.status = FileStatus.UPLOADED
        fileInfo.cancelToken = undefined
        fileInfo.progress = undefined
        // Clone state.files to force a re-render.
        this.setState(state => ({ files: state.files.slice() }))
      })
      .catch(err => {
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          this.setError(err ? err.toString() : "Unknown error")
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

  private setError = (errorMessage: string): void => {
    this.setState({ status: FileStatus.ERROR, errorMessage })
  }

  /**
   * Delete the file with the given ID:
   * - Cancel the file upload if it's in progress
   * - Tell the server to delete its remote copy of the file
   * - Remove the fileID from our local state
   */
  private delete = (fileId: string): void => {
    const file = this.state.files.find(file => file.id === fileId)
    if (fileId == null || file == null) {
      this.setError("File not found. Please try again.")
      return
    }

    if (file.errorMessage) {
      this.removeFile(fileId)
      return
    }

    if (file.cancelToken) {
      // The file hasn't been uploaded. Let's cancel the request.
      // However, it may have been received by the server so let's
      // send out a request to delete in case it has
      file.cancelToken.cancel()
    }

    this.props.uploadClient
      .delete(this.props.element.id, fileId)
      .catch(err => logWarning(`uploadClient.delete error: ${err}`))

    this.removeFile(fileId)
  }

  /**
   * Remove a fileID from our local `state.files` list.
   */
  private removeFile = (fileId: string): void => {
    this.setState(state => {
      const filteredFiles = state.files.filter(file => file.id !== fileId)

      return {
        status:
          filteredFiles.length > 0 ? FileStatus.UPLOADED : FileStatus.READY,
        errorMessage: undefined,
        files: filteredFiles,
      }
    })
  }

  /**
   * Callback for file upload progress. Updates a single file's local `progress`
   * state.
   */
  private onUploadProgress = (event: ProgressEvent, fileId: string): void => {
    const file = this.state.files.find(file => file.id === fileId)
    if (file == null) {
      return
    }

    const newProgress = Math.round((event.loaded * 100) / event.total)
    if (file.progress === newProgress) {
      return
    }

    // Update file.progress, and force a re-render by passing a cloned
    // state.files list to setState.
    file.progress = newProgress
    this.setState(state => ({ files: state.files.slice() }))
  }

  public render = (): React.ReactNode => {
    const { errorMessage, files } = this.state
    const { element, disabled } = this.props
    const acceptedExtensions = element.type

    return (
      <StyledFileUploader data-testid="stFileUploader">
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        {errorMessage ? (
          <AlertContainer kind={AlertKind.ERROR}>
            {errorMessage}
          </AlertContainer>
        ) : null}
        <FileDropzone
          onDrop={this.dropHandler}
          multiple={element.multipleFiles}
          acceptedExtensions={acceptedExtensions}
          maxSizeBytes={this.maxUploadSizeInBytes}
          disabled={disabled}
        />
        <UploadedFiles
          items={[...files]}
          pageSize={3}
          onDelete={this.delete}
          resetOnAdd
        />
      </StyledFileUploader>
    )
  }
}

export default FileUploader
