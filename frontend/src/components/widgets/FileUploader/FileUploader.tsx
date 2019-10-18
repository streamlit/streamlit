/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import "./FileUploader.scss"

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback: any, delay: number | null) {
  const savedCallback = React.useRef(() => {}) // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback
  }, [callback]) // Set up the interval.
  React.useEffect((): any => {
    function tick() {
      savedCallback.current()
    }
    if (delay !== null) {
      let id = setInterval(tick, delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

// useFakeProgress is an elaborate way to show a fake file transfer for illustrative purposes. You
// don't need this is your application. Use metadata from your upload destination if it's available,
// or don't provide progress.
function useFakeProgress(): [number, () => void, () => void] {
  const [fakeProgress, setFakeProgress] = React.useState(0)
  const [isActive, setIsActive] = React.useState(false)
  function stopFakeProgress() {
    setIsActive(false)
    setFakeProgress(0)
  }
  function startFakeProgress() {
    setIsActive(true)
  }
  useInterval(
    () => {
      if (fakeProgress >= 100) {
        stopFakeProgress()
      } else {
        setFakeProgress(fakeProgress + 10)
      }
    },
    isActive ? 500 : null
  )
  return [fakeProgress, startFakeProgress, stopFakeProgress]
}

interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetStateManager: WidgetStateManager
  width: number
}

interface State {
  status: "READY" | "READING" | "UPLOADING"
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
    this.setState({ status: "READING" })
    acceptedFiles.forEach((file: File) => {
      const fileReader = new FileReader()
      fileReader.onloadend = (ev: ProgressEvent<FileReader>) =>
        this.handleFileRead(ev, file)
      fileReader.readAsArrayBuffer(file)
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
    const status = this.state.status //this.props.widgetStateManager.set
    return (
      <FileUploaderBaseui //onCancel={stopFakeProgress}
        onDrop={this.dropHandler} // progressAmount is a number from 0 - 100 which indicates the percent of file transfer completed //progressAmount={progressAmount}
        progressMessage={status !== "READY" ? status : undefined}
      />
    )
  }
}

export default FileUploader
