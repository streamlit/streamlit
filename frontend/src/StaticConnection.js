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
  constructor({reportId, onMessage}) {
    const uri = `reports/${reportId}.protobuf`;

    // Load the report and display it.
    fetch(uri).then((response) => {
      return response.arrayBuffer();
    }).then((arrayBuffer) => {
      onMessage(ForwardMsg.decode(new Uint8Array(arrayBuffer)))
    }).catch((error) => {
      console.error('Unable to parse the data stream!!')
      console.error(error);
      // TODO: Do something meaningful here!
    })
  }
};

export default StaticConnection;
