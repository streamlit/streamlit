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

import classNames from "classnames"
import WhichBrowser from "which-browser"
import ScreenCastRecorder from "lib/ScreenCastRecorder"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { PureComponent, ComponentType, ReactNode } from "react"

import {
  UnsupportedBrowserDialog,
  ScreencastDialog,
  VideoRecordedDialog,
} from "hocs/withScreencast/components"

import "./withScreencast.scss"

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
  countdown: number
  startAnimation: boolean
  outputBlob?: Blob
  currentState: Steps
}

export interface ScreenCastHOC {
  currentState: Steps
  toggleRecordAudio: () => void
  startRecording: (fileName: string) => void
  stopRecording: () => void
}

// Supported browsers taken from https://caniuse.com/#search=getdisplaymedia
const SUPPORTED_BROWSERS: any = {
  Chrome: "72",
  Firefox: "66",
  Opera: "64",
  Edge: "17",
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
      countdown: -1,
      recordAudio: false,
      startAnimation: false,
      currentState: "OFF" as Steps,
    }

    toggleRecordAudio = (): void => {
      const { recordAudio } = this.state

      this.setState({
        recordAudio: !recordAudio,
      })
    }

    showDialog = (fileName: string): void => {
      const { currentState } = this.state

      if (!this.checkSupportedBrowser()) {
        this.setState({
          currentState: "UNSUPPORTED",
        })
      } else {
        if (currentState === "OFF") {
          this.setState({
            fileName,
            currentState: "SETUP",
          })
        } else {
          this.stopRecording()
        }
      }
    }

    startRecording = async (): Promise<any> => {
      const { recordAudio } = this.state
      this.recorder = new ScreenCastRecorder({ recordAudio })

      await this.recorder.initialize()

      this.setState({
        countdown: 3,
        startAnimation: true,
        currentState: "COUNTDOWN",
      })
    }

    stopRecording = async (): Promise<any> => {
      let outputBlob
      const { currentState } = this.state

      if (
        this.recorder &&
        currentState === "RECORDING" &&
        this.recorder.getState() !== "inactive"
      )
        outputBlob = await this.recorder.stop()

      this.setState({
        outputBlob,
        countdown: -1,
        startAnimation: false,
        currentState: "PREVIEW_FILE",
      })
    }

    onAnimationEnd = async (): Promise<any> => {
      const { countdown } = this.state

      if (this.recorder == null) {
        // Should never happen.
        throw new Error("Countdown finished but recorder is null")
      }

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
        const hasStarted = this.recorder.start()

        if (hasStarted) {
          this.setState({
            currentState: "RECORDING",
          })
        } else {
          this.stopRecording()
        }
      }
    }

    getScreenCastProps = (): ScreenCastHOC => ({
      currentState: this.state.currentState,
      toggleRecordAudio: this.toggleRecordAudio,
      startRecording: this.showDialog,
      stopRecording: this.stopRecording,
    })

    getCountdownClassName = (): string => {
      const { startAnimation } = this.state

      return classNames("countdown", {
        withAnimation: startAnimation,
      })
    }

    closeDialog = (): void => {
      this.setState({
        currentState: "OFF",
      })
    }

    checkSupportedBrowser = (): boolean => {
      const whichBrowser = new WhichBrowser(navigator.userAgent)

      const result = Object.keys(SUPPORTED_BROWSERS).map(browser => {
        const browserVersion = SUPPORTED_BROWSERS[browser]

        return whichBrowser.isBrowser(browser, ">=", browserVersion)
      })

      return result.some(supported => supported)
    }

    render(): ReactNode {
      const {
        outputBlob,
        fileName,
        countdown,
        recordAudio,
        currentState,
      }: WithScreenCastState = this.state

      return (
        <div className="withScreencast">
          <WrappedComponent screenCast={this.getScreenCastProps()} />

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
            <div
              className={this.getCountdownClassName()}
              onAnimationEnd={this.onAnimationEnd}
            >
              <span>{countdown}</span>
            </div>
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
