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
import { FileRejection } from "react-dropzone"
import { FileUploader as FileUploaderProto } from "autogen/proto"

import {
  ExtendedFile,
  FileSize,
  FileStatus,
  getSizeDisplay,
  sizeConverter,
} from "lib/FileHelper"
import { FileUploadClient } from "lib/FileUploadClient"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"
import AlertContainer, {
  Kind as AlertKind,
} from "components/shared/AlertContainer"
import { logWarning } from "lib/log"
import FileDropzone from "./FileDropzone"
import UploadedFiles from "./UploadedFiles"
import { StyledFileUploader } from "./styled-components"

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
  files: ExtendedFile[]
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
   * @param {ExtendedFile[]} acceptedFiles react-dropzone returns an array of
   * files. ExtendedFile extends File so we can type it into an array of
   * ExtendedFile
   * @param {FileRejection[]} rejectedFiles react-dropzone returns an array
   * of FileRejections which consists of the files and errors encountered.
   */
  private dropHandler = (
    acceptedFiles: ExtendedFile[],
    rejectedFiles: FileRejection[]
  ): void => {
    const { element } = this.props
    const { multipleFiles } = element

    if (!multipleFiles && this.state.files.length > 0) {
      // Only one file is allowed. Remove existing file
      this.removeFile(this.state.files[0].id || "")
    }

    // Upload each accepted file.
    acceptedFiles.forEach(this.uploadFile)

    // Too many files were dropped. Upload the first eligible file
    // and reject the rest
    if (rejectedFiles.length > 1 && !multipleFiles) {
      const firstFileIndex = rejectedFiles.findIndex(
        file =>
          file.errors.length === 1 && file.errors[0].code === "too-many-files"
      )

      if (firstFileIndex >= 0) {
        const firstFile: FileRejection = rejectedFiles[firstFileIndex]

        this.uploadFile(firstFile.file)
        this.rejectFiles([
          ...rejectedFiles.slice(0, firstFileIndex),
          ...rejectedFiles.slice(firstFileIndex + 1),
        ])
      } else {
        this.rejectFiles(rejectedFiles)
      }
    } else {
      this.rejectFiles(rejectedFiles)
    }
  }

  private handleFile = (file: ExtendedFile): ExtendedFile => {
    // Add a unique ID to each file for server and client to sync on
    file.id = `${Math.random()}${new Date().getTime()}`
    // Add a cancel token to cancel file upload
    file.cancelToken = axios.CancelToken.source()
    this.setState(state => ({ files: [file, ...state.files] }))
    return file
  }

  private uploadFile = (file: ExtendedFile): void => {
    file.progress = 1
    file.status = FileStatus.UPLOADING
    const updatedFile = this.handleFile(file)
    this.props.uploadClient
      .uploadFiles(
        this.props.element.id,
        [updatedFile],
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        e => this.onUploadProgress(e, updatedFile.id!),
        updatedFile.cancelToken
          ? updatedFile.cancelToken.token
          : axios.CancelToken.source().token,
        !this.props.element.multipleFiles
      )
      .then(() => {
        this.setState(state => {
          const files = state.files.map(existingFile => {
            // Destructing a file object causes us to lose the
            // File object properties i.e. size.
            if (file.id === existingFile.id) {
              delete file.progress
              delete file.cancelToken
              file.status = FileStatus.UPLOADED
              return file
            }
            return existingFile
          })
          return { files }
        })
      })
      .catch(err => {
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          this.setError(err ? err.toString() : "Unknown error")
        }
      })
  }

  private rejectFiles = (rejectedFiles: FileRejection[]): void => {
    rejectedFiles.forEach(rejectedFile => {
      Object.assign(rejectedFile.file, {
        status: FileStatus.ERROR,
        errorMessage: this.getErrorMessage(
          rejectedFile.errors[0].code,
          rejectedFile.file
        ),
      })
      this.handleFile(rejectedFile.file)
    })
  }

  /**
   * Return a human-readable message for the given error.
   */
  private getErrorMessage = (
    errorCode: string,
    file: ExtendedFile
  ): string => {
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
    this.setState(state => {
      return { files: state.files.slice() }
    })
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
