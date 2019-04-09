/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Displays the status of a WebSocket connection.
 */

import React, {PureComponent, ReactNode} from 'react';
import {UncontrolledTooltip} from 'reactstrap';
import {ConnectionState} from './ConnectionState';
import './ConnectionStatus.css';

interface Props {
  connectionState: ConnectionState;
}

interface State {
  minimized: boolean;
}

class ConnectionStatus extends PureComponent<Props, State> {
  public static defaultProps = {
    connectionState: ConnectionState.INITIAL,
  };

  public constructor(props: Props) {
    super(props);

    this.state = {
      minimized: ConnectionStatus.shouldMinimize(),
    };
  }

  public componentDidMount(): void {
    window.addEventListener('scroll', this.handleScroll);
  }

  public componentWillUnmount(): void {
    window.removeEventListener('scroll', this.handleScroll);
  }

  private static shouldMinimize(): boolean {
    return window.scrollY > 32;
  }

  private handleScroll = (): void => {
    this.setState({
      minimized: ConnectionStatus.shouldMinimize(),
    });
  };

  public render(): ReactNode {
    if (this.props.connectionState === ConnectionState.STATIC) {
      return null;
    }

    return (
      <div>
        <div
          id="ConnectionStatus"
          className={this.state.minimized ? 'minimized' : ''}>
          <svg className="icon" viewBox="0 0 8 8">
            {this.drawIcon()}
          </svg>
          <label>
            {this.getLabel()}
          </label>
        </div>
        <UncontrolledTooltip placement="bottom" target="ConnectionStatus">
          {this.drawTooltip()}
        </UncontrolledTooltip>
      </div>
    );
  }

  private drawIcon(): ReactNode {
    switch (this.props.connectionState) {
      case ConnectionState.INITIAL:
        return <use xlinkHref="./open-iconic.min.svg#ellipses" />;

      case ConnectionState.CONNECTED:
        return <use xlinkHref="./open-iconic.min.svg#bolt" />;

      case ConnectionState.DISCONNECTED:
        return <use xlinkHref="./open-iconic.min.svg#circle-x" />;

      case ConnectionState.STATIC:
        return <use xlinkHref="./open-iconic.min.svg#cloud" />;

      case ConnectionState.ERROR:
      default:
        return <use xlinkHref="./open-iconic.min.svg#warning" />;
    }
  }

  private getLabel(): string {
    switch (this.props.connectionState) {
      case ConnectionState.INITIAL:
        return 'Waiting';

      case ConnectionState.CONNECTED:
        return 'Live';

      case ConnectionState.DISCONNECTED:
        return 'Disconnected';

      case ConnectionState.STATIC:
        return 'Static';

      case ConnectionState.ERROR:
      default:
        return 'Error';
    }
  }

  private drawTooltip(): string {
    switch (this.props.connectionState) {
      case ConnectionState.INITIAL:
        return 'Waiting for connection';

      case ConnectionState.CONNECTED:
        return 'Connected to live data feed';

      case ConnectionState.DISCONNECTED:
        return 'Disconnected from live data feed';

      case ConnectionState.STATIC:
        return 'Reading from saved report';

      case ConnectionState.ERROR:
      default:
        return 'Something went wrong!';
    }
  }
}

export default ConnectionStatus;
