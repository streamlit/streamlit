/**
 * Implements a websocket connection over which we can send and receive
 * Google protocol buffers. It guarnatees message arrival order.
 */

// import React, { PureComponent } from 'react';
// import { UncontrolledTooltip } from 'reactstrap';

const NORMAL_CLOSURE = 1000;
const RECONNECT_TIMEOUT = 200.0;
const DISCONNECTED_STATE = 'disconnected';
const CONNECTED_STATE = 'connected';
const ERROR_STATE = 'error'

// import './PersistentWebsocket.css';

/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */
class ProtobufWebsocket {
  /**
   * Constructor.
   */
  constructor({uri, onMessage, incomingMessageType}) {
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
      this.handleMessage(data, incomingMessageType, onMessage);
    this.websocket.onclose = this.handleClose.bind(this);
    this.websocket.onerror = this.handleError.bind(this);
  }

  handleMessage(data, messageType, onMessage) {
    console.log('handleMessage');
    console.log(data);

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
      this.messageQueue[messageIndex] = messageType.decode(resultArray);
      while ((this.lastDispatchedMessageIndex + 1) in this.messageQueue) {
        const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1;
        console.log('About to send message', dispatchMessageIndex);
        onMessage(this.messageQueue[dispatchMessageIndex]);
        console.log('About to sent message message', dispatchMessageIndex);
        delete this.messageQueue[dispatchMessageIndex];
        this.lastDispatchedMessageIndex = dispatchMessageIndex;
      }
    }

    console.log('FINISHED handleMessage');
    console.log(data);
  }

  handleClose() {
    console.log('handleClose');
    // if (this.state.state !== ERROR_STATE)
    //   this.setState({state: DISCONNECTED_STATE})
    // this.closeWebsocket();
    // if (this.props.persist)
    //   setTimeout(this.openWebsocket, RECONNECT_TIMEOUT);
  }

  handleError(event) {
    console.log('handleError')
    console.log(event)
    // this.setState({
    //   state: ERROR_STATE,
    //   errorMsg: 'Error Connecting:' + this.props.uri
    // });
  }

  // /**
  //  * Upon mount, creates a new persistent websocket connection.
  //  */
  // componentDidMount() {
  //   this.openWebsocket();
  // }
  //
  // /**
  //  * When unmounting, close the websocket connection.
  //  */
  // componentWillUnmount() {
  //   this.closeWebsocket();
  // }
  //
  // openWebsocket() {
  //   // Prevent double-opening a websocket.
  //   if (this.websocket) {
  //     this.setState({
  //       state: ERROR_STATE,
  //       errorMsg: 'Cannot reopen an existing websocket.'
  //     })
  //     return;
  //   }
  //
  //
  //   // if (this.props.onRegister) {
  //   //   this.props.onRegister(message => {
  //   //     if (!this.websocket) {
  //   //       console.error('unable to send, websocket undefined')
  //   //     } else if (this.websocket.readyState === WebSocket.OPEN) {
  //   //       return this.websocket.send(message)
  //   //     } else if (this.websocket.readyState === WebSocket.CONNECTING) {
  //   //       console.error('unable to send, websocket connecting')
  //   //     } else {
  //   //       console.error('unable to send, websocket closed')
  //   //     }
  //   //   });
  //   // }



  //   // Set various event handler for the websocket.
  //   this.websocket.onopen = () => {
  //     this.setState({state: CONNECTED_STATE});
  //     if (this.props.onReconnect) {
  //       this.props.onReconnect();
  //     }
  //   };
  //

  //
  // /**
  //  * Closes any open websockets.
  //  */
  // closeWebsocket() {
  //   if (this.websocket) {
  //     this.websocket.close(NORMAL_CLOSURE);
  //   }
  //   delete this.websocket;
  //   delete this.lastDispatchedMessageIndex;
  //   delete this.nextMessageIndex;
  //   delete this.messageQueue;
  // }
  //
  // render() {
  //   // Configure icon and tooltip based on current state.
  //   const {state, errorMsg} = this.state;
  //   let iconName, tooltipText;
  //   if (state === DISCONNECTED_STATE) {
  //     iconName = 'ban'
  //     tooltipText = 'Disconnected.'
  //   } else if (state === CONNECTED_STATE) {
  //     iconName = 'bolt';
  //     tooltipText = `Connected: ${this.props.uri}`;
  //   } else if (state === ERROR_STATE) {
  //     iconName = 'warning';
  //     tooltipText = errorMsg;
  //   } else {
  //     iconName = 'warning';
  //     tooltipText = `Unknown state: "${state}"`;
  //   }
  //
  //   // Return the visual representation,
  //   return (
  //     <span>
  //     <svg id="websocket-icon" viewBox="0 0 8 8" width="1em">
  //     <use xlinkHref={'/open-iconic.min.svg#' + iconName} />
  //     </svg>
  //     <UncontrolledTooltip placement="bottom" target="websocket-icon">
  //     {tooltipText}
  //     </UncontrolledTooltip>
  //     </span>
  //   )
  // };
};

export default ProtobufWebsocket;
