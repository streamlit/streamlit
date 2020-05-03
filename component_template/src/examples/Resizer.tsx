import React from "react"
import { withStreamlitConnection, StreamlitComponent } from "../streamlit"

interface State {
  fontSize: number
}

/**
 * A component that grows and shrinks.
 */
class Resizer extends StreamlitComponent<State> {
  public state = { fontSize: 18 }

  private smaller = (): void => {
    this.setState(prevState => ({
      fontSize: Math.max(prevState.fontSize - 4, 18),
    }))
  }

  private larger = (): void => {
    this.setState(prevState => ({
      fontSize: prevState.fontSize + 4,
    }))
  }

  public render = (): React.ReactNode => {
    const styleProp = { fontSize: this.state.fontSize }
    return (
      <div>
        <div style={styleProp}>I'm resizable!</div>
        <span>
          <button onClick={this.smaller} disabled={this.state.fontSize <= 18}>
            Smaller
          </button>
          <button onClick={this.larger}>Larger</button>
        </span>
      </div>
    )
  }
}

export default withStreamlitConnection(Resizer)
