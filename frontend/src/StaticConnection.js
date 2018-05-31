/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading deltas over an HTTP connection (as opposed to with websockets).
 * Like WebsocketConnection it also implements:
 *
 *   get_status() - returns information to display status in the GUI
 *   connected_to_proxy() - always returns false
 *   send_to_proxy() - raises an exception because there's no proxy connection
 */

import {ConnectionState} from './ConnectionState';
import {Report} from './protobuf';


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
  constructor({reportId, onMessage, setConnectionState, setReportName}) {
    const uri = `reports/${reportId}.protobuf`;

    this.state = ConnectionState.STATIC;

    // Load the report and display it.
    fetch(uri).then((response) => {
      return response.arrayBuffer();
    }).then((arrayBuffer) => {
      const report = Report.decode(new Uint8Array(arrayBuffer));
      setConnectionState({connectionState: ConnectionState.STATIC});
      setReportName(report.name);
      onMessage({
        type: 'deltaList',
        deltaList: report.deltaList,
      });
    }).catch((error) => {
      setConnectionState({
        connectionState: ConnectionState.ERROR,
        errMsg: `Unable to find or parse report with ID "${reportId}".`});
    })
  }
};

export default StaticConnection;
