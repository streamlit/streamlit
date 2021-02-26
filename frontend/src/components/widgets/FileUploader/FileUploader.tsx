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
  maxSizeBytes: number
  // List of files provided by the user. This can include rejected files that
  // have not been uploaded to the server
  files: ExtendedFile[]
  // Number of files uploaded to the server. This must align with the server
  // in order to only do one rerun per upload batch.
  numValidFiles: number
}

class FileUploader extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    const maxMbs = props.element.maxUploadSizeMb

    this.state = {
      status: "READY",
      errorMessage: undefined,
      files: [],
      maxSizeBytes: sizeConverter(maxMbs, FileSize.MegaByte, FileSize.Byte),
      numValidFiles: 0,
    }
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

    const currentMaxSize = this.props.element.maxUploadSizeMb
    if (prevProps.element.maxUploadSizeMb !== currentMaxSize) {
      this.setState({
        maxSizeBytes: sizeConverter(
          currentMaxSize,
          FileSize.MegaByte,
          FileSize.Byte
        ),
      })
    }
  }

  public reset = (): void => {
    this.setState({
      status: FileStatus.READY,
      errorMessage: undefined,
      files: [],
    })
  }

  /**
   * @param {ExtendedFile[]} acceptedFiles react-dropzone returns an array of
   * files. ExtendedFile extends File so we can type it into an array of
   * ExtendedFile
   * @param {FileRejection[]} rejectedFiles react-dropzone returns an array
   * of FileRejections which consists of the files and errors encountered.
   */
  public dropHandler = (
    acceptedFiles: ExtendedFile[],
    rejectedFiles: FileRejection[]
  ): void => {
    const { element } = this.props
    const { multipleFiles } = element

    if (multipleFiles) {
      this.setState(state => ({
        numValidFiles: state.numValidFiles + acceptedFiles.length,
      }))
    } else {
      if (this.state.files.length > 0) {
        // Only one file is allowed. Remove existing file
        this.removeFile(this.state.files[0].id || "")
      }
      this.setState({ numValidFiles: 1 })
    }
    acceptedFiles.map(this.uploadFile)

    // Too many files were uploaded. Upload the first eligible file
    // and reject the rest
    if (rejectedFiles.length > 1 && !multipleFiles) {
      const firstFileIndex = rejectedFiles.findIndex(
        file =>
          file.errors.length === 1 && file.errors[0].code === "too-many-files"
      )

      if (firstFileIndex >= 0) {
        const firstFile: FileRejection = rejectedFiles[firstFileIndex]

        this.uploadFile(firstFile.file, acceptedFiles.length)
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

  private handleFile = (file: ExtendedFile, index: number): ExtendedFile => {
    // Add an unique ID to each file for server and client to sync on
    file.id = `${index}${new Date().getTime()}`
    // Add a cancel token to cancel file upload
    file.cancelToken = axios.CancelToken.source()
    this.setState(state => ({ files: [file, ...state.files] }))
    return file
  }

  private uploadFile = (file: ExtendedFile, index: number): void => {
    file.progress = 1
    file.status = FileStatus.UPLOADING
    const updatedFile = this.handleFile(file, index)
    this.props.uploadClient
      .uploadFiles(
        this.props.element.id,
        [updatedFile],
        this.state.numValidFiles,
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
    rejectedFiles.forEach((rejectedFile, index) => {
      Object.assign(rejectedFile.file, {
        status: FileStatus.ERROR,
        errorMessage: this.getErrorMessage(
          rejectedFile.errors[0].code,
          rejectedFile.file
        ),
      })
      this.handleFile(rejectedFile.file, index)
    })
  }

  private getErrorMessage = (
    errorCode: string,
    file: ExtendedFile
  ): string => {
    switch (errorCode) {
      case "file-too-large":
        return `File must be ${getSizeDisplay(
          this.state.maxSizeBytes,
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
    this.setState({
      status: FileStatus.ERROR,
      errorMessage,
    })
  }

  private delete = (fileId: string): void => {
    const file = this.state.files.find(file => file.id === fileId)
    if (fileId && file) {
      if (file.errorMessage) {
        this.removeFile(fileId)
        return
      }

      if (file.cancelToken) {
        // The file hasn't been uploaded. Let's cancel the request
        // However, it may have been received by the server so let's
        // send out a request to delete in case it has
        file.cancelToken.cancel()
      }

      this.props.uploadClient.delete(this.props.element.id, fileId)
      this.removeFile(fileId)
    } else {
      this.setError("File not found. Please try again.")
    }
  }

  public removeFile = (fileId: string): void => {
    this.setState(state => {
      const filteredFiles = state.files.filter(file => file.id !== fileId)
      const filesRemoved = state.files.length - filteredFiles.length

      return {
        status:
          filteredFiles.length > 0 ? FileStatus.UPLOADED : FileStatus.READY,
        errorMessage: undefined,
        files: filteredFiles,
        numValidFiles: state.numValidFiles - filesRemoved,
      }
    })
  }

  private onUploadProgress = (
    progressEvent: ProgressEvent,
    fileId: string
  ): void => {
    const latestProgress = Math.round(
      (progressEvent.loaded * 100) / progressEvent.total
    )
    const latestFile = this.state.files.find(file => file.id === fileId)
    if (latestFile && latestFile.progress !== latestProgress) {
      latestFile.progress = latestProgress

      this.setState(state => {
        const files = state.files.map(uploadingFile =>
          uploadingFile.id === fileId ? latestFile : uploadingFile
        )

        return { files }
      })
    }
  }

  public render = (): React.ReactNode => {
    const { maxSizeBytes, errorMessage, files } = this.state
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
          maxSizeBytes={maxSizeBytes}
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
