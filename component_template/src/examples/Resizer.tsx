import React from "react"
import { ComponentProps, connectToStreamlit } from "../StreamlitComponent"

interface State {
  fontSize: number
}

/**
 * Radio Button example, using BaseUI.
 */
class Resizer extends React.PureComponent<ComponentProps, State> {
  public constructor(props: ComponentProps) {
    super(props)
    this.state = { fontSize: 18 }
  }

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

  public componentDidUpdate = (): void => {
    this.props.updateFrameHeight()
  }

  public componentDidMount = (): void => {
    this.props.updateFrameHeight()
  }
}

export default connectToStreamlit(Resizer)
