/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview This class is the "brother" of WebsocketConnection. The class
 * implements loading deltas over an HTTP connection (as opposed to with
 * websockets).
 */

import url from 'url'
import {ConnectionState} from './ConnectionState'
import {ForwardMsg, Text as TextProto} from 'autogen/protobuf'
import {getObject} from './s3helper'
import {logError} from './log'

interface Manifest {
  name: string;
  numMessages: number;
  firstDeltaIndex: number;
  numDeltas: number;
}

interface Props {
  reportId: string;

  /** Manifest JSON from the server. */
  manifest: Manifest;

  /** Function called when we receive a new message. */
  onMessage: (message: ForwardMsg) => void;

  /**
   * Function called when our ConnectionState changes.
   */
  onConnectionStateChange: (connectionState: ConnectionState) => void;
}

/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading ForwardMsgs over an HTTP connection (as opposed to with websockets).
 */
export class StaticConnection {
  public constructor(props: Props) {
    props.onConnectionStateChange(ConnectionState.STATIC)

    // This method returns a promise, but we don't care about its result.
    StaticConnection.getAllMessages(props)
  }

  private static async getAllMessages(props: Props): Promise<void> {
    const {numMessages, firstDeltaIndex, numDeltas} = props.manifest
    const {bucket, version} = getBucketAndVersion()

    for (let msgIdx = 0; msgIdx < numMessages; msgIdx++) {
      const isDeltaMsg = msgIdx >= firstDeltaIndex && msgIdx < firstDeltaIndex + numDeltas
      const deltaID = isDeltaMsg ? msgIdx - firstDeltaIndex : -1

      // If this is a delta message, insert a loading message
      // for its associated element
      if (isDeltaMsg) {
        props.onMessage(textElement({
          id: deltaID,
          body: `Loading element ${deltaID}...`,
          format: TextProto.Format.INFO,
        }))
      }

      const messageKey = `${version}/reports/${props.reportId}/${msgIdx}.pb`

      try {
        const response = await getObject({Bucket: bucket, Key: messageKey})
        const arrayBuffer = await response.arrayBuffer()
        props.onMessage(ForwardMsg.decode(new Uint8Array(arrayBuffer)))
      } catch (error) {
        if (isDeltaMsg) {
          props.onMessage(textElement({
            id: deltaID,
            body: `Error loading element ${deltaID}: ${error}`,
            format: TextProto.Format.ERROR,
          }))
        } else {
          logError(`Error loading non-delta message ${msgIdx}: ${error}`)
        }
      }
    }
  }
}

/**
 * Parses the S3 data bucket name and report version from the window location href
 */
function getBucketAndVersion(): {bucket?: string; version: string} {
  // TODO: Unify with ConnectionManager.ts
  const {hostname, pathname} = url.parse(window.location.href, true)
  const bucket = hostname
  const version = pathname != null ? pathname.split('/')[1] : 'null'
  return {bucket, version}
}

/**
 * Returns the json to construct a message which places an element at a
 * particular location in the document.
 */
function textElement({id, body, format}: { id: number; body: string; format: TextProto.Format }): any {
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
  }
}
