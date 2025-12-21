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

import React, { createContext, useContext, ReactNode } from "react"
import { ConnectionState, ConnectionManager } from "@streamlit/connection"
import { useConnectionManager } from "./hooks/useConnectionManager"
import { SessionInfo, StreamlitEndpoints } from "@streamlit/lib"

interface ConnectionContextValue {
  connectionState: ConnectionState
  connectionManager: ConnectionManager | null
  connect: () => void
  disconnect: () => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

export const useConnection = () => {
  const context = useContext(ConnectionContext)
  if (!context) {
    throw new Error("useConnection must be used within a ConnectionContextProvider")
  }
  return context
}

interface ConnectionContextProviderProps {
  children: ReactNode
  sessionInfo: SessionInfo
  endpoints: StreamlitEndpoints
  claimHostAuthToken: () => Promise<string | undefined>
  resetHostAuthToken: () => void
  onHostConfigResp: (response: any) => void
  onMessage: (message: any) => void
  onConnectionError: (err: any) => void
}

export const ConnectionContextProvider = (props: ConnectionContextProviderProps) => {
  const connectionData = useConnectionManager(props)

  return (
    <ConnectionContext.Provider value={connectionData}>
      {props.children}
    </ConnectionContext.Provider>
  )
}
