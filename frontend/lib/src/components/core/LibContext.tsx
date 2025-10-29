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

import { ComponentRegistry } from "~lib/components/widgets/CustomComponent"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"

/**
 * LibContextProps extends LibConfig (from @streamlit/connection) with additional
 * properties specific to the lib package's context needs.
 */
export interface LibContextProps extends LibConfig {
  /** True if the app is in full-screen mode. */
  isFullScreen: boolean

  /** Function that sets the `isFullScreen` property. */
  setFullScreen: (value: boolean) => void

  /**
   * The current locale of the app. Defaults to the browser's locale.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
   */
  locale: typeof window.navigator.language

  /**
   * The app's ComponentRegistry instance. Dispatches "Custom Component"
   * iframe messages to ComponentInstances.
   * Pulled from context in ComponentInstance
   * @see ComponentInstance
   */
  componentRegistry: ComponentRegistry
}

const noOpEndpoints: StreamlitEndpoints = {
  setStaticConfigUrl: () => {},
  sendClientErrorToHost: () => {},
  checkSourceUrlResponse: () => Promise.resolve(),
  buildComponentURL: () => "",
  buildBidiComponentURL: () => "",
  buildMediaURL: () => "",
  buildDownloadUrl: () => "",
  buildFileUploadURL: () => "",
  buildAppPageURL: () => "",
  uploadFileUploaderFile: () =>
    Promise.reject(new Error("unimplemented endpoint")),
  deleteFileAtURL: () => Promise.reject(new Error("unimplemented endpoint")),
}

export const LibContext = createContext<LibContextProps>({
  isFullScreen: false,
  setFullScreen: () => {},
  locale: window.navigator.language,
  // This should be overwritten
  componentRegistry: new ComponentRegistry(noOpEndpoints),
  // Flattened libConfig properties:
  mapboxToken: undefined,
  disableFullscreenMode: undefined,
  enforceDownloadInNewTab: undefined,
  resourceCrossOriginMode: undefined,
})
LibContext.displayName = "LibContext"
