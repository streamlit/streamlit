/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useMemo } from "react"
import { MessageQueue } from "../lib/MessageQueue"
import type { ConnectionManager } from "../lib/ConnectionManager"
import type { BaseUriParts } from "../../../util/UriUtil"
import { LOG } from "../lib/log"

export function useMessageQueue(
  connectionManager: ConnectionManager
): MessageQueue {
  return useMemo(() => {
    const queue = new MessageQueue()

    connectionManager.on(
      "connectionEndpointIdentified",
      (uri: BaseUriParts) => {
        queue.setUri(uri).catch(reason => {
          const err = `Failed to process a Websocket message (${reason})`
          LOG.error(err)
          connectionManager.handleFatalError(err)
        })
      }
    )

    connectionManager.on("message", (msg: Uint8Array) => {
      queue.queueMessage(msg).catch(reason => {
        const err = `Failed to process a Websocket message (${reason})`
        LOG.error(err)
        connectionManager.handleFatalError(err)
      })
    })

    return queue
  }, [connectionManager])
}
