/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, {PureComponent} from 'react';
import {ConnectionState} from './ConnectionState';
import {UncontrolledTooltip} from 'reactstrap';
import './ConnectionStatus.css';

class ConnectionStatus extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      minimized: this.shouldMinimize(),
    };

    this.handleScroll_bound = this.handleScroll.bind(this);
  }

  componentDidMount() {
    window.addEventListener('scroll', this.handleScroll_bound);
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll_bound);
  }

  shouldMinimize() {
    return window.scrollY > 32;
  }

  handleScroll() {
    this.setState({
      minimized: this.shouldMinimize(),
    });
  }

  render() {
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
            {this.drawLabel()}
          </label>
        </div>
        <UncontrolledTooltip placement="bottom" target="ConnectionStatus">
          {this.drawTooltip()}
        </UncontrolledTooltip>
      </div>
    );
  }

  drawIcon() {
    switch (this.props.connectionState) {
      case undefined:
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

  drawLabel() {
    switch (this.props.connectionState) {
      case undefined:
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

  drawTooltip() {
    switch (this.props.connectionState) {
      case undefined:
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
