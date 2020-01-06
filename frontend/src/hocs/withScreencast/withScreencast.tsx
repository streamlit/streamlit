import classNames from "classnames"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { PureComponent, ComponentType, ReactNode } from "react"

import "./withScreencast.scss"

interface withScreenCastProps {}

interface screenCastState {
  recording: boolean
  recordAudio: boolean
  countdown: number
  startAnimation: boolean
}

export interface screenCastHoc extends screenCastState {
  toggleRecordAudio: () => void
  startRecording: () => void
  stopRecording: () => void
}

function withScreencast(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithScreencast extends PureComponent<
    withScreenCastProps,
    screenCastState
  > {
    state = {
      recording: false,
      recordAudio: false,
      countdown: -1,
      startAnimation: false,
    }

    toggleRecordAudio = () => {
      const { recordAudio } = this.state

      this.setState({
        recordAudio: !recordAudio,
      })
    }

    startRecording = () => {
      this.setState({
        countdown: 3,
        startAnimation: true,
      })
    }

    stopRecording = () => {
      this.setState({
        recording: false,
        countdown: -1,
        startAnimation: false,
      })
    }

    onAnimationEnd = () => {
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
        this.setState({
          recording: true,
        })
      }
    }

    getScreenCastProps = (): screenCastHoc => ({
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

    render(): ReactNode {
      const { countdown } = this.state

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
