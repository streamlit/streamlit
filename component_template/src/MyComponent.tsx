import React, { ReactNode } from "react"
import { withStreamlitConnection, StreamlitComponent } from "./streamlit"

// We import bootstrap.css to get some simple default styling for our
// text and button. You can remove or replace this.
import "bootstrap/dist/css/bootstrap.min.css"

interface State {
  numClicks: number
}

/**
 * Streamlit component template. Edit this file to make your component!
 */
class MyComponent extends StreamlitComponent<State> {
  public state = { numClicks: 0 }

  public render = (): ReactNode => {
    // Arguments that are passed to the plugin in Python are accessible
    // via `this.props.args`. Here, we access the "name" arg.
    let name = this.props.args["name"]
    if (name === undefined) {
      name = "Unspecified"
    }

    // Create and return a div with some text in it.
    // When the div is clicked, we'll increment our "numClicks" state
    // variable, and send its new value back to Streamlit, where it'll
    // be available to the Python program.
    return (
      <div>
        <div>Hello, {name}!</div>
        <button onClick={this.onClicked}>Click Me!</button>
      </div>
    )
  }

  /** Click handler for our "Click Me!" button. */
  private onClicked = (): void => {
    // Increment state.numClicks, and pass the new value back to
    // Streamlit via `this.props.setWidgetValue`.
    this.setState(
      prevState => ({ numClicks: prevState.numClicks + 1 }),
      () => this.props.setWidgetValue(this.state.numClicks)
    )
  }
}

// "withStreamlitConnection" is a wrapper function. It bootstraps the
// connection between your component and the Streamlit app, and handles
// passing arguments from Python -> Component, and widget values from
// Component -> Python.
//
// You don't need to edit withStreamlitConnection (but you're welcome to!).
export default withStreamlitConnection(MyComponent)
