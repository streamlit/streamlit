import React from "react";
import { ComponentProps, StreamlitComponent } from "./StreamlitComponent";

interface State {
  numClicks: number;
}

/**
 * Streamlit component template. Edit this file to make your component!
 */
class MyComponent extends React.PureComponent<ComponentProps, State> {
  public state = { numClicks: 0 };

  public render = (): React.ReactNode => {
    // Arguments that are passed to the plugin in Python are accessible
    // via `this.props.args`. Here, we access the "name" arg.
    let name = this.props.args["name"];
    if (name === undefined) {
      name = "Unspecified!";
    }

    // Create and return a div with some text in it.
    // When the div is clicked, we'll increment our "numClicks" state
    // variable, and send its new value back to Streamlit, where it'll
    // be available to the Python program.
    return (
      <div onClick={this.onClicked}>
        Hello, {name}. You've clicked {this.state.numClicks} times!
      </div>
    );
  };

  /**
   * Click handler for our <div>.
   */
  private onClicked = (): void => {
    // Increment state.numClicks, and pass the new value back to
    // Streamlit via `this.props.setWidgetValue`.
    this.setState(
      prevState => ({ numClicks: prevState.numClicks + 1 }),
      () => this.props.setWidgetValue(this.state.numClicks)
    );
  };

  public componentDidMount = (): void => {
    // After we're rendered for the first time, tell Streamlit that our height
    // has changed.
    this.props.updateFrameHeight();
  };

  public componentDidUpdate = (): void => {
    // After we're updated, tell Streamlit that our height may have changed.
    this.props.updateFrameHeight();
  };
}

// "StreamlitComponent" is a wrapper function. It bootstraps the
// connection between your component and the Streamlit app, and handles
// passing arguments from Python -> Component, and widget values from
// Component -> Python.
//
// You don't need to edit StreamlitComponent (but you're welcome to!).
export default StreamlitComponent(MyComponent);
