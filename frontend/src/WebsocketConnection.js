/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import { ForwardMsg, BackMsg } from './protobuf';
import { ConnectionState } from './ConnectionState';


/**
 * Timeout for the WebSocket connection attempt, in millis.
 */
const CONNECTION_TIMEOUT_MS = 3000;


/**
* This class is the "brother" of StaticConnection. The class  connects to the
* proxy and gets deltas over a websocket connection. It also implements:
*
*   getStatus() - returns information to display status in the GUI
*   connectedToProxy() - returns true when proxy connection is open
*   sendToProxy() - sends a message to the proxy
*/
class WebsocketConnection {
  /**
   * Constructor.
   */
  constructor(props) {
    this.props = props;

    // To guarantee packet transmission order, this is the index of the last
    // dispatched incoming message.
    this.lastDispatchedMessageIndex = -1;

    // And this is the index of the next message we recieve.
    this.nextMessageIndex = 0;

    // This dictionary stores recieved messages that we haven't sent out yet
    // (because we're still decoding previous messages)
    this.messageQueue = {};

    this.state = ConnectionState.DISCONNECTED;
    this.websocket = null;

    this.connect(0);
  }

  connect(uriIndex) {
    const { uriList, setConnectionState, onMessage } = this.props;

    if (uriIndex >= uriList.length) {
      setConnectionState({
        connectionState: ConnectionState.ERROR,
        errMsg: 'The connection is down. Please rerun your Python script.',
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      if (this.websocket.readyState === 0) {
        this.websocket.close();
        console.warn(
          `Websocket connection to ${uriList[uriIndex]} timed out`);
        this.connect(uriIndex + 1);
      }
    }, CONNECTION_TIMEOUT_MS);

    const uri = uriList[uriIndex];
    this.websocket = new WebSocket(uri);

    this.websocket.onmessage = ({ data }) => {
      this.handleMessage(data, onMessage);
    };

    this.websocket.onopen = () => {
      clearTimeout(timeoutId);
      setConnectionState({
        connectionState: ConnectionState.CONNECTED,
      });
    };

    this.websocket.onclose = () => {
      clearTimeout(timeoutId);
      setConnectionState({
        connectionState: ConnectionState.DISCONNECTED,
      });
    };

    this.websocket.onerror = () => {
      clearTimeout(timeoutId);
      this.connect(uriIndex + 1);
    };
  }

  /**
   * Encdes the message with the outgoingMessageType and sends it over the wire.
   */
  sendToProxy(obj) {
    if (!this.websocket) return;
    const msg = BackMsg.create(obj);
    const buffer = BackMsg.encode(msg).finish();
    this.websocket.send(buffer);
  }

  handleMessage(data, onMessage) {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex;
    this.nextMessageIndex += 1;

    // Read in the message data.
    const reader = new FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      if (this.messageQueue === undefined) {
        console.error('No message queue.');
        return;
      }

      const resultArray = new Uint8Array(reader.result);
      this.messageQueue[messageIndex] = ForwardMsg.decode(resultArray);
      while ((this.lastDispatchedMessageIndex + 1) in this.messageQueue) {
        const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1;
        onMessage(this.messageQueue[dispatchMessageIndex]);
        delete this.messageQueue[dispatchMessageIndex];
        this.lastDispatchedMessageIndex = dispatchMessageIndex;
      }
    };
  }
}

export default WebsocketConnection;
