/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConnectionState } from "lib/ConnectionState"
import { ForwardMsg, StaticManifest } from "autogen/proto"
import { getBucketAndResourceRoot, getObject } from "lib/s3helper"
import { logError } from "lib/log"

interface Props {
  reportId: string

  /** Manifest protobuf from the server. */
  manifest: StaticManifest

  /** Function called when we receive a new message. */
  onMessage: (message: ForwardMsg) => void

  /**
   * Function called when our ConnectionState changes.
   */
  onConnectionStateChange: (connectionState: ConnectionState) => void
}

/**
 * This class is the "brother" of WebsocketConnection. The class implements
 * loading ForwardMsgs over an HTTP connection (as opposed to with websockets).
 */
export class StaticConnection {
  constructor(props: Props) {
    props.onConnectionStateChange(ConnectionState.STATIC)

    // This method returns a promise, but we don't care about its result.
    StaticConnection.getAllMessages(props)
  }

  private static async getAllMessages(props: Props): Promise<void> {
    const { numMessages } = props.manifest
    const { bucket, resourceRoot } = getBucketAndResourceRoot()

    for (let msgIdx = 0; msgIdx < numMessages; msgIdx++) {
      const messageKey = `${resourceRoot}/reports/${props.reportId}/${msgIdx}.pb`

      try {
        const response = await getObject({ Bucket: bucket, Key: messageKey })
        const arrayBuffer = await response.arrayBuffer()
        props.onMessage(ForwardMsg.decode(new Uint8Array(arrayBuffer)))
      } catch (error) {
        logError(`Error loading message ${msgIdx}: ${error}`)
      }
    }
  }
}
