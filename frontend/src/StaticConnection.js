/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading deltas over an HTTP connection (as opposed to with websockets).
 * Like WebsocketConnection it also implements:
 *
 *   get_status() - returns information to display status in the GUI
 *   connected_to_proxy() - always returns false
 *   send_to_proxy() - raises an exception because there's no proxy connection
 */

import { ForwardMsg } from './protobuf';
import { ERROR_STATE, STATIC_STATE } from './ConnectionStatus';


/**
* This class is the "brother" of WebsocketConnection. The class implements
* loading deltas over an HTTP connection (as opposed to with websockets).
* Like WebsocketConnection it also implements:
*
*   getStatus() - returns information to display status in the GUI
*   connectedToProxy() - always returns false
*   sendToProxy() - raises an exception because there's no proxy connection
*/
class StaticConnection {
  constructor({reportId, onMessage, setConnectionState}) {
    const uri = `reports/${reportId}.protobuf`;

    this.state = STATIC_STATE;

    // Load the report and display it.
    fetch(uri).then((response) => {
      return response.arrayBuffer();
    }).then((arrayBuffer) => {
      onMessage(ForwardMsg.decode(new Uint8Array(arrayBuffer)))
      setConnectionState({connectionState: STATIC_STATE});
    }).catch((error) => {
      setConnectionState({
        connectionState: ERROR_STATE,
        errMsg: `Unable to find or parse report with ID "${reportId}".`});
    })
  }
};

export default StaticConnection;
