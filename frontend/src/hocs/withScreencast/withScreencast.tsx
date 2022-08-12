import { logWarning } from "src/lib/log"
import ScreenCastRecorder from "src/lib/ScreenCastRecorder"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { PureComponent, ComponentType, ReactNode } from "react"

import {
  UnsupportedBrowserDialog,
  ScreencastDialog,
  VideoRecordedDialog,
} from "src/hocs/withScreencast/components"
import Countdown from "src/components/core/Countdown"

export type Steps =
  | "UNSUPPORTED"
  | "OFF"
  | "SETUP"
  | "COUNTDOWN"
  | "RECORDING"
  | "PREVIEW_FILE"

interface WithScreenCastProps {}

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

function withScreencast(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithScreencast extends PureComponent<
    WithScreenCastProps,
    WithScreenCastState
  > {
    static readonly displayName = `withScreencast(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    recorder?: ScreenCastRecorder | null

    state = {
      fileName: "streamlit-screencast",
      recordAudio: false,
      currentState: "OFF" as Steps,
    }

    private toggleRecordAudio = (): void => {
      const { recordAudio } = this.state

      this.setState({
        recordAudio: !recordAudio,
      })
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

    public render(): ReactNode {
      const {
        outputBlob,
        fileName,
        recordAudio,
        currentState,
      }: WithScreenCastState = this.state

      return (
        <div className="withScreencast">
          <WrappedComponent
            screenCast={this.getScreenCastProps()}
            {...this.props}
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
