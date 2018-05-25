/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, { PureComponent } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import './ConnectionStatus.css';

// TODO: Share these constants with WebsocketConnection and StaticConnection.
export const DISCONNECTED_STATE = 'disconnected';
export const CONNECTED_STATE = 'connected';
export const ERROR_STATE = 'error'
export const STATIC_STATE = 'static'

class ConnectionStatus extends PureComponent {
  render() {
    if (this.props.connectionState == STATIC_STATE) {
      return null;
    }

    return (
      <div>
        <div id="ConnectionStatus">
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
    )
  }

  drawIcon() {
    switch (this.props.connectionState) {
      case undefined:
        return <use xlinkHref="./open-iconic.min.svg#ellipses" />

      case CONNECTED_STATE:
        return <use xlinkHref="./open-iconic.min.svg#bolt" />

      case DISCONNECTED_STATE:
        return <use xlinkHref="./open-iconic.min.svg#circle-x" />

      case STATIC_STATE:
        return <use xlinkHref="./open-iconic.min.svg#cloud" />

      case ERROR_STATE:
      default:
        return <use xlinkHref="./open-iconic.min.svg#warning" />
    }
  }

  drawLabel() {
    switch (this.props.connectionState) {
      case undefined:
        return 'Waiting';

      case CONNECTED_STATE:
        return 'Live';

      case DISCONNECTED_STATE:
        return 'Disconnected';

      case STATIC_STATE:
        return 'Static';

      case ERROR_STATE:
      default:
        return 'Error';
    }
  }

  drawTooltip() {
    switch (this.props.connectionState) {
      case undefined:
        return 'Waiting for connection';

      case CONNECTED_STATE:
        return 'Connected to live data feed';

      case DISCONNECTED_STATE:
        return 'Disconnected from live data feed';

      case STATIC_STATE:
        return 'Reading from saved report';

      case ERROR_STATE:
      default:
        return 'Something went wrong!';
    }
  }
};

export default ConnectionStatus;
