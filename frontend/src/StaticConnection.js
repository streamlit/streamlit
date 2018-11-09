/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview This class is the "brother" of WebsocketConnection. The class
 * implements loading deltas over an HTTP connection (as opposed to with
 * websockets).  Like WebsocketConnection it also implements:
 *
 *   get_status() - returns information to display status in the GUI
 *   connected_to_proxy() - always returns false
 *   send_to_proxy() - raises an exception because there's no proxy connection
 */

import {ConnectionState} from './ConnectionState';
import {Text as TextProto, Delta} from './protobuf';

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
    const manifestUri = `reports/${reportId}/manifest.json`;

    this.state = ConnectionState.STATIC;
    const fetchParams = {
        redirect: 'follow',
        credentials: 'same-origin',
        mode: 'no-cors'
    };

    // Load the report and display it
    fetch(manifestUri, fetchParams).then((response) => {
      return response.json();
    }).then(({name, nDeltas}) => {
      setConnectionState({connectionState: ConnectionState.STATIC});
      setReportName(name);
      for (let id = 0 ; id < nDeltas ; id++) {
        // Insert a loading message for this element.
        onMessage(textElement({id,
          body: `Loading element ${id}...`,
          format: TextProto.Format.INFO
        }));
        const deltaUri = `reports/${reportId}/${id}.delta`;
        fetch(deltaUri, fetchParams).then((response) => {
          return response.arrayBuffer();
        }).then((arrayBuffer) => {
          onMessage({
            type: 'delta',
            delta: Delta.decode(new Uint8Array(arrayBuffer))
          });
        }).catch((error) => {
          onMessage(textElement({id,
            body: `Error loading element ${id}: ${error}`,
            format: TextProto.Format.ERROR
          }));
        });
      }
    }).catch((error) => {
      setConnectionState({
        connectionState: ConnectionState.ERROR,
        errMsg: `Unable to find or parse report with ID "${reportId}": ${error}`
      });
    })
  }
};

/**
 * Returns the json to construct a message which places an element at a
 * particular location in the document.
 */
function textElement({id, body, format}) {
  return {
    type: 'delta',
    delta: {
      id: id,
      type: 'newElement',
      newElement: {
        type: 'text',
        text: {
          body: body,
          format: format,
        }
      }
    }
  };
}

export default StaticConnection;
