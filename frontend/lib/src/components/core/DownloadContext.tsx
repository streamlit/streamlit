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
import { createContext } from "react"

import { DeferredFileResponse } from "@streamlit/protobuf"

export interface DownloadContextProps {
  /**
   * Optional function to request a deferred file. Used by the DownloadButton
   * component to execute deferred callables and get download URLs.
   */
  requestDeferredFile?: (fileId: string) => Promise<DeferredFileResponse>
}

/**
 * DownloadContext provides download-related helpers to elements.
 *
 * Defaults are safe for initial render and tests. When not provided,
 * deferred downloads should show a configuration error.
 */
export const DownloadContext = createContext<DownloadContextProps>({
  requestDeferredFile: undefined,
})

// Set the context display name for React DevTools
DownloadContext.displayName = "DownloadContext"
