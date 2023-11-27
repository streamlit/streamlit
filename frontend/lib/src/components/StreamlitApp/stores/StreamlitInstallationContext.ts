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

import { createContext, useContext } from "react"

export enum ConnectionState {
  CONNECTED = "CONNECTED",
  DISCONNECTED_FOREVER = "DISCONNECTED_FOREVER",
  INITIAL = "INITIAL",
  PINGING_SERVER = "PINGING_SERVER",
  CONNECTING = "CONNECTING",
}

export interface StreamlitInstallation {
  // Identifier for the Application
  appId: string
  // Secondary Identifier for the Application TODO Is this needed?
  appHash: string
  // Identifier for the Session (aka the browser tab)
  sessionId: string
  // Streamlit Version
  streamlitVersion: string
  // Python Version
  pythonVersion: string
  // Installation Identifier
  installationId: string
  // Installation Identifier Alternative
  installationIdV3: string
  // CommandLine used to run the Streamlit App
  commandLine: string
}

export const StreamlitInstallationContext =
  createContext<StreamlitInstallation | null>(null)

export function useStreamlitInstallation(): StreamlitInstallation {
  const context = useContext(StreamlitInstallationContext)

  if (context === null) {
    throw new Error(
      "useStreamlitInstallation must be used within a StreamlitInstallationContextProvider"
    )
  }

  return context
}
