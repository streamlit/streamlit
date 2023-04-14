/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { logWarning } from "src/lib/log"
import ScreenCastRecorder from "src/lib/ScreenCastRecorder"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { PureComponent, ComponentType, ReactNode } from "react"

import {
  UnsupportedBrowserDialog,
  ScreencastDialog,
  VideoRecordedDialog,
} from "src/app/hocs/withScreencast/components"
import Countdown from "src/app/components/Countdown"

export type Steps =
  | "UNSUPPORTED"
  | "OFF"
  | "SETUP"
  | "COUNTDOWN"
  | "RECORDING"
  | "PREVIEW_FILE"

interface WithScreenCastState {
  fileName: string
  recordAudio: boolean
  outputBlob?: Blob
  currentState: Steps
}

export interface ScreenCastHOC {
  currentState: Steps
  toggleRecordAudio: () => void
  startRecording: (fileName: string) => void
  stopRecording: () => void
}

interface InjectedProps {
  screenCast: ScreenCastHOC
}

type WrappedProps<P extends InjectedProps> = Omit<P, "screenCast">

function withScreencast<P extends InjectedProps>(
  WrappedComponent: ComponentType<P>
): ComponentType<WrappedProps<P>> {
  class ComponentWithScreencast extends PureComponent<
    WrappedProps<P>,
    WithScreenCastState
  > {
    public static readonly displayName = `withScreencast(${
      WrappedComponent.displayName || WrappedComponent.name
    })`

    private recorder?: ScreenCastRecorder | null

    state = {
      fileName: "streamlit-screencast",
      recordAudio: false,
      currentState: "OFF" as Steps,
    }

    private toggleRecordAudio = (): void => {
      const { recordAudio } = this.state
      this.setState({ recordAudio: !recordAudio })
    }

    private showDialog = (fileName: string): void => {
      const { currentState } = this.state

      if (!ScreenCastRecorder.isSupportedBrowser()) {
        this.setState({ currentState: "UNSUPPORTED" })
      } else if (currentState === "OFF") {
        this.setState({
          fileName,
          currentState: "SETUP",
        })
      } else {
        this.stopRecording().catch(err =>
          logWarning(`withScreencast.stopRecording threw an error: ${err}`)
        )
      }
    }

    public startRecording = async (): Promise<any> => {
      const { recordAudio } = this.state

      this.recorder = new ScreenCastRecorder({
        recordAudio,
        onErrorOrStop: () => this.stopRecording(),
      })

      try {
        await this.recorder.initialize()
      } catch (e) {
        logWarning(`ScreenCastRecorder.initialize error: ${e}`)
        this.setState({ currentState: "UNSUPPORTED" })
        return
      }

      this.setState({ currentState: "COUNTDOWN" })
    }

    private stopRecording = async (): Promise<any> => {
      let outputBlob
      const { currentState } = this.state

      // We should do nothing if the user try to stop recording when it is not started
      if (currentState === "OFF" || this.recorder == null) {
        return
      }

      if (currentState === "COUNTDOWN") {
        this.setState({
          currentState: "OFF",
        })
      }

      if (currentState === "RECORDING") {
        if (this.recorder.getState() === "inactive") {
          this.setState({
            currentState: "OFF",
          })
        } else {
          outputBlob = await this.recorder.stop()
          this.setState({
            outputBlob,
            currentState: "PREVIEW_FILE",
          })
        }
      }
    }

    private onCountdownEnd = async (): Promise<any> => {
      if (this.recorder == null) {
        // Should never happen.
        throw new Error("Countdown finished but recorder is null")
      }

      const hasStarted = this.recorder.start()

      if (hasStarted) {
        this.setState({
          currentState: "RECORDING",
        })
      } else {
        this.stopRecording().catch(err =>
          logWarning(`withScreencast.stopRecording threw an error: ${err}`)
        )
      }
    }

    private getScreenCastProps = (): ScreenCastHOC => ({
      currentState: this.state.currentState,
      toggleRecordAudio: this.toggleRecordAudio,
      startRecording: this.showDialog,
      stopRecording: this.stopRecording,
    })

    private closeDialog = (): void => {
      this.setState({
        currentState: "OFF",
      })
    }

    public render = (): ReactNode => {
      const {
        outputBlob,
        fileName,
        recordAudio,
        currentState,
      }: WithScreenCastState = this.state

      return (
        <div className="withScreencast">
          <WrappedComponent
            {...(this.props as P)}
            screenCast={this.getScreenCastProps()}
          />

          {currentState === "UNSUPPORTED" && (
            <UnsupportedBrowserDialog onClose={this.closeDialog} />
          )}

          {currentState === "SETUP" && (
            <ScreencastDialog
              recordAudio={recordAudio}
              onClose={this.closeDialog}
              startRecording={this.startRecording}
              toggleRecordAudio={this.toggleRecordAudio}
            />
          )}

          {currentState === "COUNTDOWN" && (
            <Countdown countdown={3} endCallback={this.onCountdownEnd} />
          )}

          {currentState === "PREVIEW_FILE" && outputBlob && (
            <VideoRecordedDialog
              onClose={this.closeDialog}
              videoBlob={outputBlob}
              fileName={fileName}
            />
          )}
        </div>
      )
    }
  }

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithScreencast, WrappedComponent)
}

export default withScreencast
