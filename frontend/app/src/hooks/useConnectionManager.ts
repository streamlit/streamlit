/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import {
    ConnectionManager,
    ConnectionState,
    IHostConfigResponse,
    StreamlitEndpoints
} from "@streamlit/connection"
import { SessionInfo } from "@streamlit/lib"
import { useCallback, useEffect, useRef, useState } from "react"

interface ConnectionManagerProps {
  sessionInfo: SessionInfo
  endpoints: StreamlitEndpoints
  claimHostAuthToken: () => Promise<string | undefined>
  resetHostAuthToken: () => void
  onHostConfigResp: (response: IHostConfigResponse) => void
  onMessage: (message: any) => void
  onConnectionError: (err: any) => void
}

export function useConnectionManager({
  sessionInfo,
  endpoints,
  claimHostAuthToken,
  resetHostAuthToken,
  onHostConfigResp,
  onMessage,
  onConnectionError,
}: ConnectionManagerProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.INITIAL
  )
  const connectionManagerRef = useRef<ConnectionManager | null>(null)

  const handleConnectionStateChanged = useCallback(
      (newState: ConnectionState) => {
        setConnectionState(newState)
      },
      []
  )

  const connect = useCallback(() => {
    if (connectionManagerRef.current) return

    connectionManagerRef.current = new ConnectionManager({
      getLastSessionId: () => sessionInfo.last?.sessionId,
      endpoints,
      onMessage,
      onConnectionError,
      connectionStateChanged: handleConnectionStateChanged,
      claimHostAuthToken,
      resetHostAuthToken,
      sendClientError: (error, message, source) => {
        console.error(`Client Error: ${error} - ${message} (${source})`)
      },
      onHostConfigResp,
    })
  }, [
    sessionInfo,
    endpoints,
    onMessage,
    onConnectionError,
    handleConnectionStateChanged,
    claimHostAuthToken,
    resetHostAuthToken,
    onHostConfigResp,
  ])

  const disconnect = useCallback(() => {
    connectionManagerRef.current?.disconnect()
    connectionManagerRef.current = null
  }, [])

  useEffect(() => {
    connect()
    return () => {
        disconnect()
    }
  }, [connect, disconnect])

  return {
    connectionState,
    connectionManager: connectionManagerRef.current,
    connect,
    disconnect,
  }
}
