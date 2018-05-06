/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, { PureComponent } from 'react';
import { UncontrolledTooltip } from 'reactstrap';

const NORMAL_CLOSURE = 1000;
const RECONNECT_TIMEOUT = 200.0;
const DISCONNECTED_STATE = 'disconnected';
const CONNECTED_STATE = 'connected';
const ERROR_STATE = 'error'

import './PersistentWebsocket.css';

/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */
class PersistentWebsocket extends PureComponent {
  /**
   * Constructor.
   */
  constructor(props) {
    super(props);
    this.state = {
      state: DISCONNECTED_STATE,
    };

    // Bind all callbacks
    this.openWebsocket = this.openWebsocket.bind(this);
  }

  /**
   * Upon mount, creates a new persistent websocket connection.
   */
  componentDidMount() {
    this.openWebsocket();
  }

  /**
   * When unmounting, close the websocket connection.
   */
  componentWillUnmount() {
    this.closeWebsocket();
  }

  openWebsocket() {
    // Prevent double-opening a websocket.
    if (this.websocket) {
      this.setState({
        state: ERROR_STATE,
        errorMsg: 'Cannot reopen an existing websocket.'
      })
      return;
    }

    // Create a new websocket.
    this.websocket = new WebSocket(this.props.uri);

    if (this.props.onRegister) {
      this.props.onRegister(message => {
        if (!this.websocket) {
          console.error('unable to send, websocket undefined')
        } else if (this.websocket.readyState === WebSocket.OPEN) {
          return this.websocket.send(message)
        } else if (this.websocket.readyState === WebSocket.CONNECTING) {
          console.error('unable to send, websocket connecting')
        } else {
          console.error('unable to send, websocket closed')
        }
      });
    }
    
    // To guarantee packet transmission order, this is the index of the last
    // sent message.
    this.lastSentMessageIndex = -1;

    // And this is the index of the next message we recieve.
    this.nextMessageIndex = 0;

    // This dictionary stores recieved messages that we haven't sent out yet
    // (because we're still decoding previous messages)
    this.messageQueue = {}

    // Set various event handler for the websocket.
    this.websocket.onopen = () => {
      this.setState({state: CONNECTED_STATE});
      if (this.props.onReconnect) {
        this.props.onReconnect();
      }
    };

    this.websocket.onmessage = ({data}) => {
      if (this.props.onMessage) {
        // Assign this message an index.
        const messageIndex = this.nextMessageIndex;
        this.nextMessageIndex += 1

        // Read in the message data.
        const reader = new FileReader();
        reader.readAsArrayBuffer(data)
        reader.onloadend = () => {
          this.messageQueue[messageIndex] = new Uint8Array(reader.result);
          while ((this.lastSentMessageIndex + 1) in this.messageQueue) {
            const sendMessageIndex = this.lastSentMessageIndex + 1;
            this.props.onMessage(this.messageQueue[sendMessageIndex]);
            delete this.messageQueue[sendMessageIndex];
            this.lastSentMessageIndex = sendMessageIndex;
          }
        }
      }
    };

    this.websocket.onclose = () => {
      if (this.state.state !== ERROR_STATE)
        this.setState({state: DISCONNECTED_STATE})
      this.closeWebsocket();
      if (this.props.persist)
        setTimeout(this.openWebsocket, RECONNECT_TIMEOUT);
    };

    this.websocket.onerror = (event) => {
      this.setState({
        state: ERROR_STATE,
        errorMsg: 'Error Connecting:' + this.props.uri
      });
    };
  }

  /**
   * Closes any open websockets.
   */
  closeWebsocket() {
    if (this.websocket) {
      this.websocket.close(NORMAL_CLOSURE);
    }
    delete this.websocket;
    delete this.lastSentMessageIndex;
    delete this.nextMessageIndex;
    delete this.messageQueue;
  }

  render() {
    // Configure icon and tooltip based on current state.
    const {state, errorMsg} = this.state;
    let iconName, tooltipText;
    if (state === DISCONNECTED_STATE) {
      iconName = 'ban'
      tooltipText = 'Disconnected.'
    } else if (state === CONNECTED_STATE) {
      iconName = 'bolt';
      tooltipText = `Connected: ${this.props.uri}`;
    } else if (state === ERROR_STATE) {
      iconName = 'warning';
      tooltipText = errorMsg;
    } else {
      iconName = 'warning';
      tooltipText = `Unknown state: "${state}"`;
    }

    // Return the visual representation,
    return (
      <span>
      <svg id="websocket-icon" viewBox="0 0 8 8" width="1em">
      <use xlinkHref={'/open-iconic.min.svg#' + iconName} />
      </svg>
      <UncontrolledTooltip placement="bottom" target="websocket-icon">
      {tooltipText}
      </UncontrolledTooltip>
      </span>
    )
  };
};

export default PersistentWebsocket;
