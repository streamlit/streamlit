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

import React, { PureComponent, ReactNode } from "react"
import classNames from "classnames"

import "./style.scss"

interface Props {
  countdown: number
  start: boolean
  interval: number
  endCallback: Function
}

interface State {
  countdown: number
  startAnimation: boolean
}

const DEFAULT_COUNTDOWN_INTERVAL = 1000

class Countdown extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    endCallback: () => {},
    start: true,
    interval: DEFAULT_COUNTDOWN_INTERVAL,
  }

  state = {
    countdown: this.props.countdown,
    startAnimation: this.props.start || true,
  }

  onAnimationEnd = async (): Promise<any> => {
    const { countdown } = this.state
    const { endCallback, interval } = this.props

    this.setState({
      startAnimation: false,
      countdown: countdown - 1,
    })

    if (countdown - 1 > 0) {
      window.setTimeout(() => {
        this.setState({
          startAnimation: true,
        })
      }, interval)
    }

    if (countdown - 1 === 0) {
      endCallback()
    }
  }

  getCountdownClassName = (): string => {
    const { startAnimation } = this.state

    return classNames("countdown", {
      withAnimation: startAnimation,
    })
  }

  render(): ReactNode {
    const { countdown }: State = this.state

    return (
      <div
        className={this.getCountdownClassName()}
        onAnimationEnd={this.onAnimationEnd}
      >
        <span>{countdown}</span>
      </div>
    )
  }
}

export default Countdown
