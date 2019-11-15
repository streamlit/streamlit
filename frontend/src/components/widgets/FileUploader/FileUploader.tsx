/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import { fileUploaderOverrides } from "lib/widgetTheme"
import "./FileUploader.scss"
import { Button } from "reactstrap"

interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetStateManager: WidgetStateManager
  width: number
}

interface State {
  status: "READY" | "READING" | "UPLOADING"
  errorMessage?: string
}

class FileUploader extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = {
      status: "READY",
    }
  }

  private handleFileRead = (
    ev: ProgressEvent<FileReader>,
    file: File
  ): void => {
    if (ev.target !== null) {
      if (ev.target.result instanceof ArrayBuffer) {
        this.props.widgetStateManager.sendUploadFileMessage(
          this.props.element.get("id"),
          file.name,
          file.lastModified,
          new Uint8Array(ev.target.result)
        )
      } else {
        console.warn("This file is not ArrayBuffer type.")
      }
    }
    this.setState({ status: "UPLOADING" })
  }

  private dropHandler = (
    acceptedFiles: File[],
    rejectedFiles: File[],
    event: React.SyntheticEvent<HTMLElement>
  ): void => {
    const { element } = this.props
    const maxSizeMb = element.get("maxUploadSizeMb")

    if (rejectedFiles.length > 0) {
      this.setState({
        status: "READY",
        errorMessage: `${rejectedFiles[0].type} files are not allowed`,
      })
      return
    }

    this.setState({ status: "READING" })
    acceptedFiles.forEach((file: File) => {
      const fileSizeMB = file.size / 1024 / 1024
      if (fileSizeMB < maxSizeMb) {
        const fileReader = new FileReader()
        fileReader.onloadend = (ev: ProgressEvent<FileReader>) =>
          this.handleFileRead(ev, file)
        fileReader.readAsArrayBuffer(file)
      } else {
        this.setState({
          status: "READY",
          errorMessage: `The max file size allowed is ${maxSizeMb}MB`,
        })
      }
    })
  }

  public componentDidUpdate(oldProps: Props): void {
    const progress = this.props.element.get("progress")
    const oldProgress = oldProps.element.get("progress")
    if (
      oldProgress !== 1 &&
      progress === 1 &&
      this.state.status === "UPLOADING"
    ) {
      this.setState({ status: "READY" })
    }
  }

  closeErrorMessage = (): void => {
    this.setState({ status: "READY", errorMessage: undefined })
  }

  renderErrorMessage = (): React.ReactNode => {
    const { errorMessage } = this.state
    return (
      <div className="stFileUploaderError">
        <span className="stFileUploaderError__text">{errorMessage}</span>
        <Button
          className="stFileUploaderError__button"
          outline
          onClick={this.closeErrorMessage}
        >
          Ok
        </Button>
      </div>
    )
  }

  public render = (): React.ReactNode => {
    const { status, errorMessage } = this.state
    const { element } = this.props
    const accept: string[] = element
      .get("type")
      .toArray()
      .map((value: string) => "." + value)
    const label: string = element.get("label")
    return (
      <div className="Widget stFileUploader">
        <label>{label}</label>
        {errorMessage ? (
          this.renderErrorMessage()
        ) : (
          <FileUploaderBaseui
            onDrop={this.dropHandler}
            errorMessage={errorMessage}
            accept={accept.length === 0 ? undefined : accept}
            progressMessage={status !== "READY" ? status : undefined}
            onRetry={() => {
              this.setState({ status: "READY", errorMessage: undefined })
            }}
            onCancel={() => {
              this.setState({ status: "READY", errorMessage: undefined })
              this.props.widgetStateManager.sendDeleteUploadedFileMessage(
                this.props.element.get("id")
              )
            }}
            overrides={fileUploaderOverrides}
          />
        )}
      </div>
    )
  }
}

export default FileUploader
