/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import axios, { CancelTokenSource } from "axios"
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import Icon from "components/shared/Icon"
import { Map as ImmutableMap } from "immutable"
import { FileUploadClient } from "lib/FileUploadClient"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { fileUploaderOverrides } from "lib/widgetTheme"
import React from "react"
import { Button, Spinner } from "reactstrap"
import "./FileUploader.scss"

export interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetStateManager: WidgetStateManager
  uploadClient: FileUploadClient
  width: number
}

interface State {
  status: "READY" | "UPLOADING" | "UPLOADED" | "ERROR"
  errorMessage?: string
  acceptedFiles: File[]
}

class FileUploader extends React.PureComponent<Props, State> {
  /** Used to cancel the current upload, if there is one. */
  private currentUploadCanceller?: CancelTokenSource

  public constructor(props: Props) {
    super(props)
    this.state = {
      status: "READY",
      errorMessage: undefined,
      acceptedFiles: [],
    }
  }

  private dropHandler = (
    acceptedFiles: File[],
    rejectedFiles: File[],
    event: React.SyntheticEvent<HTMLElement>
  ): void => {
    const { element } = this.props
    const maxSizeMb = element.get("maxUploadSizeMb")

    if (rejectedFiles.length > 0) {
      // TODO: Tell user which files *are* allowed.
      const errorMessage = `${rejectedFiles[0].type} files are not allowed`
      this.setState({
        status: "ERROR",
        errorMessage: errorMessage,
      })

      return
    }

    // validate file sizes
    const maxSizeBytes = maxSizeMb * 1024 * 1024
    for (const file of acceptedFiles) {
      if (file.size > maxSizeBytes) {
        const errorMessage = `The max file size allowed is ${maxSizeMb}MB`
        this.setState({
          status: "ERROR",
          errorMessage: errorMessage,
        })

        return
      }
    }

    // Upload all the files
    this.currentUploadCanceller = axios.CancelToken.source()
    const promises: Promise<void>[] = []
    for (const file of acceptedFiles) {
      const p = this.props.uploadClient.uploadFile(
        this.props.element.get("id"),
        file,
        undefined,
        this.currentUploadCanceller.token
      )
      promises.push(p)
    }

    this.setState({ acceptedFiles, status: "UPLOADING" })

    Promise.all(promises)
      .then(() => {
        this.currentUploadCanceller = undefined
        this.setState({ status: "UPLOADED" })
      })
      .catch(err => {
        if (axios.isCancel(err)) {
          // If this was a cancel error, we don't show the user an error -
          // the cancellation was in response to an action they took
          this.currentUploadCanceller = undefined
          this.setState({ status: "UPLOADED" })
        } else {
          this.setState({
            status: "ERROR",
            errorMessage: err ? err.toString() : "Unknown error",
          })
        }
      })
  }

  private reset = (): void => {
    this.setState({
      status: "READY",
      errorMessage: undefined,
      acceptedFiles: [],
    })
  }

  private renderErrorMessage = (): React.ReactNode => {
    const { errorMessage } = this.state
    return (
      <div className="uploadStatus uploadError">
        <span className="body">
          <Icon className="icon" type="warning" /> {errorMessage}
        </span>
        <Button outline size="sm" onClick={this.reset}>
          OK
        </Button>
      </div>
    )
  }

  private renderUploadingMessage = (): React.ReactNode => {
    return (
      <div className="uploadStatus uploadProgress">
        <span className="body">
          <Spinner color="secondary" size="sm" /> Uploading...
        </span>
        <Button outline size="sm" onClick={this.cancelCurrentUpload}>
          Cancel
        </Button>
      </div>
    )
  }

  private cancelCurrentUpload = (): void => {
    if (this.currentUploadCanceller != null) {
      this.currentUploadCanceller.cancel()
      this.currentUploadCanceller = undefined
    }
  }

  private renderFileUploader = (): React.ReactNode => {
    const { status, errorMessage } = this.state
    const { element } = this.props
    const accept: string[] = element
      .get("type")
      .toArray()
      .map((value: string) => "." + value)

    // Hack to hide drag-and-drop message and leave space for filename.
    let overrides: any = fileUploaderOverrides

    if (status === "UPLOADED") {
      overrides = { ...overrides }
      overrides.ContentMessage = { ...overrides.ContentMessage }
      overrides.ContentMessage.style = { ...overrides.ContentMessage.style }
      overrides.ContentMessage.style.visibility = "hidden"
      overrides.ContentMessage.style.overflow = "hidden"
      overrides.ContentMessage.style.height = "0.625rem" // half of lineHeightTight
    }

    return (
      <>
        {status === "UPLOADED" ? (
          <div className="uploadOverlay uploadDone">
            <span className="body">{this.state.acceptedFiles[0].name}</span>
          </div>
        ) : null}
        <FileUploaderBaseui
          onDrop={this.dropHandler}
          errorMessage={errorMessage}
          accept={accept.length === 0 ? undefined : accept}
          disabled={this.props.disabled}
          overrides={overrides}
        />
      </>
    )
  }

  public render = (): React.ReactNode => {
    const { status } = this.state
    const { element } = this.props
    const label: string = element.get("label")

    // The BaseWeb file uploader is not particularly configurable, so we hack it here by replacing
    // the uploader with our own UI where appropriate.
    return (
      <div className="Widget stFileUploader">
        <label>{label}</label>

        {status === "ERROR"
          ? this.renderErrorMessage()
          : status === "UPLOADING"
          ? this.renderUploadingMessage()
          : this.renderFileUploader()}
      </div>
    )
  }
}

export default FileUploader
