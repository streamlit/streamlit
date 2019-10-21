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
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import { fileUploaderOverrides } from "lib/widgetTheme"
import "./FileUploader.scss"

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
  ): any => {
    if (ev.target !== null) {
      if (ev.target.result instanceof ArrayBuffer) {
        this.props.widgetStateManager.sendUploadFileMessage(
          this.props.element.get("id"),
          file.name,
          file.lastModified,
          new Uint8Array(ev.target.result)
        )
      }
    }
    this.setState({ status: "UPLOADING" })
  }

  private dropHandler = (
    acceptedFiles: File[],
    rejectedFiles: File[],
    event: React.SyntheticEvent<HTMLElement>
  ) => {
    const { element } = this.props
    const maxSize = element.get("maxUploadSize")
    this.setState({ status: "READING" })
    acceptedFiles.forEach((file: File) => {
      const fileSilzeMB = file.size / 1024 / 1024
      if (fileSilzeMB < maxSize) {
        const fileReader = new FileReader()
        fileReader.onloadend = (ev: ProgressEvent<FileReader>) =>
          this.handleFileRead(ev, file)
        fileReader.readAsArrayBuffer(file)
      } else {
        this.setState({
          status: "READY",
          errorMessage: `The max file size allowed is ${maxSize}MB`,
        })
      }
    })
  }

  public componentDidUpdate() {
    const uiValue = this.props.widgetStateManager.getStringValue(
      this.props.element.get("id")
    )
    if (uiValue !== undefined && this.state.status === "UPLOADING") {
      this.setState({ status: "READY" })
    }
  }

  public render = (): React.ReactNode => {
    const { status, errorMessage } = this.state
    const { element } = this.props
    const accept: string[] = element.get("type").toArray()
    const label: string = element.get("label")
    return (
      <div className="file-uploader">
        <label>{label}</label>
        <FileUploaderBaseui
          onDrop={this.dropHandler}
          errorMessage={errorMessage}
          accept={accept}
          progressMessage={status !== "READY" ? status : undefined}
          onRetry={() =>
            this.setState({ status: "READY", errorMessage: undefined })
          }
          overrides={fileUploaderOverrides}
        />
      </div>
    )
  }
}

export default FileUploader
