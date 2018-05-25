/**
 * Implements a websocket connection over which we can send and receive
 * Google protocol buffers. It guarnatees message arrival order.
 */

import { ForwardMsg, BackMsg, Text as TextProto } from './protobuf';

// const NORMAL_CLOSURE = 1000;
// const RECONNECT_TIMEOUT = 200.0;

import { DISCONNECTED_STATE, CONNECTED_STATE, ERROR_STATE, STATIC_STATE } from
  './ConnectionStatus';

// import './PersistentWebsocket.css';

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
  constructor({uri, onMessage, resetState}) {
    // To guarantee packet transmission order, this is the index of the last
    // dispatched incoming message.
    this.lastDispatchedMessageIndex = -1;

    // And this is the index of the next message we recieve.
    this.nextMessageIndex = 0;

    // This dictionary stores recieved messages that we haven't sent out yet
    // (because we're still decoding previous messages)
    this.messageQueue = {}

    // Create a new websocket.
    this.state = DISCONNECTED_STATE;
    this.websocket = new WebSocket(uri);
    this.websocket.onmessage = ({data}) =>
      this.handleMessage(data, onMessage);
    this.websocket.onclose = () => {console.log('Closed')}
    this.websocket.onerror = () => {
      resetState('The connection is down. Please rerun your Python script.',
        TextProto.Format.WARNING);
    };

    // Update the state
    this.state = CONNECTED_STATE;
  }

  /**
   * Encdes the message with the outgoingMessageType and sends it over the wire.
   */
  sendToProxy(obj) {
    const msg = BackMsg.create(obj);
    const buffer = BackMsg.encode(msg).finish();
    this.websocket.send(buffer)
  }

  handleMessage(data, onMessage) {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex;
    this.nextMessageIndex += 1

    // Read in the message data.
    const reader = new FileReader();
    reader.readAsArrayBuffer(data)
    reader.onloadend = () => {
      if (this.messageQueue === undefined) {
        console.log("We don't have a message queue. This is bad.")
        return
      }

      const resultArray = new Uint8Array(reader.result);
      this.messageQueue[messageIndex] = ForwardMsg.decode(resultArray);
      while ((this.lastDispatchedMessageIndex + 1) in this.messageQueue) {
        const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1;
        onMessage(this.messageQueue[dispatchMessageIndex]);
        delete this.messageQueue[dispatchMessageIndex];
        this.lastDispatchedMessageIndex = dispatchMessageIndex;
      }
    }
  }

  handleClose() {
    this.state = DISCONNECTED_STATE;
  }

  handleError(event) {
    this.state = ERROR_STATE;
  }
};

export default WebsocketConnection;
