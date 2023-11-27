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

export interface StreamlitAppCommands {
  rerunScript: () => void
  clearCache: () => void
  stopScript: () => void
  setRunOnSave: (runOnSave: boolean) => void
  loadGitInfo: () => void
  debugDisconnectWebSocket: () => void
  debugShutdownRuntime: () => void
  fileUrlsRequest: (requestId: string, files: File[]) => void
}

// eslint-disable-next-line @typescript-eslint/no-empty-function -- The function is fake
const dummyFunction = (): void => {}

export const StreamlitAppCommandsContext = createContext<StreamlitAppCommands>(
  {
    rerunScript: dummyFunction,
    clearCache: dummyFunction,
    stopScript: dummyFunction,
    setRunOnSave: dummyFunction,
    loadGitInfo: dummyFunction,
    debugDisconnectWebSocket: dummyFunction,
    debugShutdownRuntime: dummyFunction,
    fileUrlsRequest: dummyFunction,
  }
)

export function useStreamlitAppCommands(): StreamlitAppCommands {
  return useContext(StreamlitAppCommandsContext)
}
