import React from "react";
import "../App.css";
import { StComponentProps } from "../StComponentAPI";
import logo from "../logo.svg";

/**
 * Hello World example plugin, using React.
 */
class HelloReact extends React.PureComponent<StComponentProps> {
  public render = (): React.ReactNode => {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>Hello, {`${this.props.args["name"]}`}!</p>
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
}

export default HelloReact;
