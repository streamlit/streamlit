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

interface WithScreenCastProps {}

interface WithScreenCastState {
  fileName: string
  recording: boolean
  recordAudio: boolean
  countdown: number
  startAnimation: boolean
  blob?: Blob
  showRecordedDialog: boolean
  showScreencastDialog: boolean
  showUnsupportedDialog: boolean
}

export interface ScreenCastHOC extends WithScreenCastState {
  toggleRecordAudio: () => void
  startRecording: (fileName: string) => void
  stopRecording: () => void
}

const SUPPORTED_BROWSERS: any = {
  Chrome: "49",
  Firefox: "29",
  Opera: "36",
  Edge: "76",
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
      recording: false,
      recordAudio: false,
      startAnimation: false,
      showRecordedDialog: false,
      showScreencastDialog: false,
      showUnsupportedDialog: false,
    }

    toggleRecordAudio = (): void => {
      const { recordAudio } = this.state

      this.setState({
        recordAudio: !recordAudio,
      })
    }

    showDialog = (fileName: string): void => {
      const { recording, countdown } = this.state

      if (!this.checkSupportedBrowser()) {
        this.setState({
          showUnsupportedDialog: true,
        })
      } else {
        if (!recording && countdown < 0) {
          this.setState({
            fileName,
            showScreencastDialog: true,
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
        showRecordedDialog: false,
      })
    }

    stopRecording = async (): Promise<any> => {
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

    onAnimationEnd = async (): Promise<any> => {
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
      startRecording: this.showDialog,
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

    closeUnsupportedDialog = (): void => {
      this.setState({
        showUnsupportedDialog: false,
      })
    }

    closeScreencastDialog = (): void => {
      this.setState({
        showScreencastDialog: false,
      })
    }

    checkSupportedBrowser = (): boolean => {
      const whichBrowser = new WhichBrowser(navigator.userAgent)

      const result = Object.keys(SUPPORTED_BROWSERS).map(browser => {
        const browserVersion = SUPPORTED_BROWSERS[browser]

        return whichBrowser.isBrowser(browser, ">", browserVersion)
      })

      return result.some(supported => supported)
    }

    render(): ReactNode {
      const {
        blob,
        fileName,
        countdown,
        recordAudio,
        showRecordedDialog,
        showScreencastDialog,
        showUnsupportedDialog,
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
              fileName={fileName}
            />
          )}

          {showUnsupportedDialog && (
            <UnsupportedBrowserDialog onClose={this.closeUnsupportedDialog} />
          )}

          {showScreencastDialog && (
            <ScreencastDialog
              recordAudio={recordAudio}
              onClose={this.closeScreencastDialog}
              startRecording={this.startRecording}
              toggleRecordAudio={this.toggleRecordAudio}
            />
          )}
        </div>
      )
    }
  }

  return hoistNonReactStatics(ComponentWithScreencast, WrappedComponent)
}

export default withScreencast
