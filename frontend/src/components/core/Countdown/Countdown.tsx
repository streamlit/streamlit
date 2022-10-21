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

import React, { PureComponent, ReactNode } from "react"
import { StyledCountdown } from "./styled-components"

interface Props {
  countdown: number
  endCallback: () => void
}

interface State {
  countdown: number
}

class Countdown extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    endCallback: () => {},
  }

  state = {
    countdown: this.props.countdown,
  }

  onAnimationEnd = async (): Promise<any> => {
    const { countdown } = this.state
    const { endCallback } = this.props
    const newCountdown = countdown - 1

    if (newCountdown >= 0) {
      this.setState({
        countdown: newCountdown,
      })
    }

    if (newCountdown === 0) {
      endCallback()
    }
  }

  render(): ReactNode {
    const { countdown }: State = this.state

    return (
      <StyledCountdown
        onAnimationEnd={this.onAnimationEnd}
        key={`frame${countdown}`}
      >
        {/* The key forces DOM mutations, for animation to restart. */}
        <span>{countdown}</span>
      </StyledCountdown>
    )
  }
}

export default Countdown
