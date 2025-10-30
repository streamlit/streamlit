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

import { LibConfig } from "@streamlit/connection"

/**
 * LibConfigContext provides configuration from LibConfig (from @streamlit/connection)
 * with flattened properties for better developer experience.
 *
 * Note: disableFullscreenMode and componentRegistry are intentionally omitted and
 * passed as props instead for better performance (avoids unnecessary re-renders).
 */
export interface LibConfigContextProps
  extends Omit<LibConfig, "disableFullscreenMode"> {
  /**
   * The current locale of the app. Defaults to the browser's locale.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
   */
  locale: typeof window.navigator.language
}

export const LibConfigContext = createContext<LibConfigContextProps>({
  locale: window.navigator.language,
  // Selected libConfig properties:
  mapboxToken: undefined,
  enforceDownloadInNewTab: undefined,
  resourceCrossOriginMode: undefined,
})

LibConfigContext.displayName = "LibConfigContext"
