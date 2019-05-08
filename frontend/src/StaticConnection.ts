/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview This class is the "brother" of WebsocketConnection. The class
 * implements loading deltas over an HTTP connection (as opposed to with
 * websockets).
 */

import url from 'url';
import {ConnectionState} from './ConnectionState';
import {Text as TextProto, Delta} from './protobuf';
import {getObject} from './s3helper';

interface Props {
  reportId: string;

  /** Manifest JSON from the server */
  manifest: {name: string; nDeltas: number};

  /** Function called when we receive a new message. */
  onMessage: (message: any) => void;

  /**
   * Function called when our ConnectionState changes.
   * If the new ConnectionState is ERROR, errMsg will be defined.
   */
  onConnectionStateChange: (connectionState: ConnectionState, errMsg?: string) => void;

  setReportName: (name: string) => void;
}

/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading deltas over an HTTP connection (as opposed to with websockets).
 */
export class StaticConnection {
  public constructor(props: Props) {
    const {name, nDeltas} = props.manifest;

    props.onConnectionStateChange(ConnectionState.STATIC);
    props.setReportName(name);

    // TODO: Unify with StreamlitApp.js
    const {hostname, pathname} = url.parse(window.location.href, true);
    const bucket = hostname;
    const version = pathname != null ? pathname.split('/')[1] : 'null';

    for (let id = 0; id < nDeltas; id++) {
      // Insert a loading message for this element.
      props.onMessage(textElement({
        id,
        body: `Loading element ${id}...`,
        format: TextProto.Format.INFO,
      }));
      const deltaKey = `${version}/reports/${props.reportId}/${id}.delta`;

      getObject({Bucket: bucket, Key: deltaKey})
        .then(response => response.arrayBuffer())
        .then((arrayBuffer) => {
          props.onMessage({
            type: 'delta',
            delta: Delta.decode(new Uint8Array(arrayBuffer)),
          });
        }).catch((error) => {
          props.onMessage(textElement({
            id,
            body: `Error loading element ${id}: ${error}`,
            format: TextProto.Format.ERROR,
          }));
        });
    }
  }
}

/**
 * Returns the json to construct a message which places an element at a
 * particular location in the document.
 */
function textElement({id, body, format}: {id: number; body: string; format: TextProto.Format}): any {
  return {
    type: 'delta',
    delta: {
      id,
      type: 'newElement',
      newElement: {
        type: 'text',
        text: {body, format},
      },
    },
  };
}
