/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import { ForwardMsg, BackMsg } from './protobuf';
import { ConnectionState } from './ConnectionState';


/**
 * Number of times to try to connect to websocket.
 */
const MAX_RETRIES = 3;


/**
 * Timeout for the WebSocket connection attempt, in millis. This grows by N
 * with each Nth retry.
 */
const CONNECTION_TIMEOUT_MS = 2000;


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

    /**
     * To guarantee packet transmission order, this is the index of the last
     * dispatched incoming message.
     */
    this.lastDispatchedMessageIndex = -1;

    /**
     * And this is the index of the next message we recieve.
     */
    this.nextMessageIndex = 0;

    /**
     * This dictionary stores recieved messages that we haven't sent out yet
     * (because we're still decoding previous messages)
     */
    this.messageQueue = {};

    this.state = ConnectionState.DISCONNECTED;
    this.websocket = null;

    /**
     * Keep track of how many times we tried to connect.
     */
    this.attemptNumber = 0;

    this.connect(0);
  }

  connect(uriIndex) {
    const { uriList, setConnectionState, onMessage } = this.props;

    if (uriIndex >= uriList.length) {
      if (this.attemptNumber < MAX_RETRIES) {
        uriIndex = 0;
        this.attemptNumber += 1;
      } else {
        setConnectionState({
          connectionState: ConnectionState.ERROR,
          errMsg: 'The connection is down. Please rerun your Python script.',
        });
        return;
      }
    }

    let tryingNext = false;

    const tryNext = () => {
      if (!tryingNext) {
        this.connect(uriIndex + 1);
        tryingNext = true;
      }
    };

    const timeoutId = setTimeout(() => {
      if (this.websocket.readyState === 0) {
        console.warn(
          `Websocket connection to ${uriList[uriIndex]} timed out`);
        this.websocket.close();
        tryNext();
      }
    }, CONNECTION_TIMEOUT_MS * (this.attemptNumber + 1));

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
      tryNext();
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
