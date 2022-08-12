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
