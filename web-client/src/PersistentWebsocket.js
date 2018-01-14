/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, { PureComponent } from 'react';
import { UncontrolledTooltip } from 'reactstrap';

const NORMAL_CLOSURE = 1000;
const RECONNECT_TIMEOUT = 500.0;
const DISCONNECTED_STATE = 'disconnected';
const CONNECTED_STATE = 'connected';
const ERROR_STATE = 'error'

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

     // Set various event handler for the websocket.
     this.websocket.onopen = () => {
       this.setState({state: CONNECTED_STATE});
       if (this.props.onReconnect) {
         this.props.onReconnect();
       }
     };

     this.websocket.onmessage = ({data}) => {
       if (this.props.onMessage) {
          this.props.onMessage(data);
        }
      };

      this.websocket.onclose = () => {
        console.log('PersistentWebsocket: Closed.')
        this.setState({state: DISCONNECTED_STATE})
        this.closeWebsocket();
        setTimeout(this.openWebsocket, RECONNECT_TIMEOUT);
      };

      this.websocket.onerror = (event) => {
        console.log('PersistentWebsocket: Received error.');
        console.log(event);
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
     this.websocket = undefined;
   }

   render() {
     // Configure icon and tooltip based on current state.
     const {state, errorMsg} = this.state;
     let iconName, tooltipText;
     if (state === DISCONNECTED_STATE) {
       iconName = 'link-broken'
       tooltipText = 'Disconnected.'
     } else if (state === CONNECTED_STATE) {
       iconName = 'link-intact';
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
           <use
             xlinkHref={'open-iconic.min.svg#' + iconName}
             style={{'fill':'#fff'}}
           />
         </svg>
         <UncontrolledTooltip placement="bottom" target="websocket-icon">
           {tooltipText}
         </UncontrolledTooltip>
       </span>
     )
   };
 };

export default PersistentWebsocket;
