import React from "react";
import "./App.css";
import logo from "./logo.svg";
import { StComponentProps } from "./StComponentAPI";
import { Radio as UIRadio, RadioGroup } from "baseui/radio";

/**
 * Example plugin.
 * Plugin writers *do* edit this class.
 */
class Plugin extends React.PureComponent<StComponentProps> {
  public render = (): React.ReactNode => {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>Hello, {`${this.getArg("name")}`}!</p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header>
      </div>
    );
  };

  /** Return the argument with the given name. */
  private getArg(argName: string): any | undefined {
    if (this.props.args == null || !(argName in this.props.args)) {
      return undefined;
    }

    return this.props.args[argName];
  }
}

export default Plugin;
