/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading deltas over an HTTP connection (as opposed to with websockets).
 * Like WebsocketConnection it also implements:
 *
 *   get_status() - returns information to display status in the GUI
 *   connected_to_proxy() - always returns false
 *   send_to_proxy() - raises an exception because there's no proxy connection
 */


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
    console.log('static uri', uri);
    fetch(uri).then((response) => {
      console.log('Got a responses');
      console.log(response);
      msg = StreamlitMsg.decode(new Uint8Array(response.arrayBuffer()));
      console.log('Convert it to a message')
      console.log(msg);
      console.log('About to call the callback.')
      onMessage(msg);
      console.log('Just called the callback.')
    };
  }
};

export default StaticConnection;
