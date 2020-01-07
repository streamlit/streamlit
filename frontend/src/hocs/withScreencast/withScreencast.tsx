import classNames from "classnames"
import ScreenCastRecorder from "lib/ScreenCastRecorder"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { PureComponent, ComponentType, ReactNode } from "react"

import VideoRecordedDialog from "./components/VideoRecordedDialog"

import "./withScreencast.scss"

interface WithScreenCastProps {}

interface WithScreenCastState {
  recording: boolean
  recordAudio: boolean
  countdown: number
  startAnimation: boolean
  blob?: Blob
  showRecordedDialog: boolean
}

export interface ScreenCastHOC extends WithScreenCastState {
  toggleRecordAudio: () => void
  startRecording: () => void
  stopRecording: () => void
}

function withScreencast(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithScreencast extends PureComponent<
    WithScreenCastProps,
    WithScreenCastState
  > {
    recorder?: ScreenCastRecorder | null

    state = {
      recording: false,
      recordAudio: false,
      countdown: -1,
      startAnimation: false,
      showRecordedDialog: false,
    }

    toggleRecordAudio = (): void => {
      const { recordAudio } = this.state

      this.setState({
        recordAudio: !recordAudio,
      })
    }

    startRecording = async () => {
      const { recordAudio } = this.state
      this.recorder = new ScreenCastRecorder({ recordAudio })

      await this.recorder.initialize()

      this.setState({
        countdown: 3,
        startAnimation: true,
        showRecordedDialog: false,
      })
    }

    stopRecording = async () => {
      let blob
      const { recording } = this.state

      if (
        this.recorder &&
        recording &&
        this.recorder.getState() !== "inactive"
      )
        blob = await this.recorder.stop()

      this.setState({
        blob,
        countdown: -1,
        recording: false,
        startAnimation: false,
        showRecordedDialog: true,
      })
    }

    onAnimationEnd = async () => {
      const { countdown } = this.state

      this.setState({
        startAnimation: false,
        countdown: countdown - 1,
      })

      if (countdown - 1 > 0) {
        window.setTimeout(() => {
          this.setState({
            startAnimation: true,
          })
        }, 1000)
      }

      if (countdown - 1 === 0) {
        if (this.recorder) await this.recorder.start()

        this.setState({
          recording: true,
        })
      }
    }

    getScreenCastProps = (): ScreenCastHOC => ({
      ...this.state,
      toggleRecordAudio: this.toggleRecordAudio,
      startRecording: this.startRecording,
      stopRecording: this.stopRecording,
    })

    getCountdownClassName = (): string => {
      const { startAnimation } = this.state

      return classNames("countdown", {
        withAnimation: startAnimation,
      })
    }

    closeRecordedDialog = (): void => {
      this.setState({
        showRecordedDialog: false,
      })
    }

    render(): ReactNode {
      const {
        countdown,
        showRecordedDialog,
        blob,
      }: WithScreenCastState = this.state

      return (
        <div className="withScreencast">
          <WrappedComponent screenCast={this.getScreenCastProps()} />
          {countdown > 0 && (
            <div
              className={this.getCountdownClassName()}
              onAnimationEnd={this.onAnimationEnd}
            >
              <span>{countdown}</span>
            </div>
          )}

          {showRecordedDialog && blob && (
            <VideoRecordedDialog
              onClose={this.closeRecordedDialog}
              videoBlob={blob}
            />
          )}
        </div>
      )
    }
  }

  // @ts-ignore
  ComponentWithScreencast.displayName = `withScreencast(${WrappedComponent.displayName ||
    WrappedComponent.name})`

  return hoistNonReactStatics(ComponentWithScreencast, WrappedComponent)
}

export default withScreencast
