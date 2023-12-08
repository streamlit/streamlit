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

import { useMemo, useState } from "react"
import { ConnectionState } from "../stores/ConnectionContext"
import type { ConnectionContextValue } from "../stores/ConnectionContext"
import { ConnectionManager } from "../lib/ConnectionManager"
import type { BaseUriParts } from "@streamlit/lib/src/util/UriUtil"

export function useConnectionManager(
  endpoint: string
): ConnectionContextValue {
  const [connectionState, setConnectionState] = useState(
    ConnectionState.INITIAL
  )
  // There's an unfortunate situation where we do not know the "official" url
  // So we let the connectionManager figure it out and let us know.
  const [workingEndpoint, setWorkingEndpoint] = useState<BaseUriParts | null>(
    null
  )

  const connectionManager = useMemo(() => {
    const manager = new ConnectionManager(endpoint)

    manager.on("connectionStateChanged", (state: ConnectionState) => {
      setConnectionState(state)
    })

    manager.on("connectionEndpointIdentified", (uri: BaseUriParts) => {
      setWorkingEndpoint(uri)
    })

    manager.connect()

    return manager
  }, [endpoint])

  return { connectionState, connectionManager, workingEndpoint }
}
