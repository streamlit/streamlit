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

import { ComponentRegistry } from "~lib/components/widgets/CustomComponent"
import { ScriptRunState } from "~lib/ScriptRunState"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { baseTheme, ThemeConfig } from "~lib/theme"

/**
 * The lib config contains various configurations that the host platform can
 * use to configure streamlit-lib frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 */
export type LibConfig = {
  /**
   * the mapbox token that can be configured by a platform
   */
  mapboxToken?: string

  /**
   * Whether to disable the full screen mode all elements / widgets.
   */
  disableFullscreenMode?: boolean

  enforceDownloadInNewTab?: boolean

  /**
   * Whether and which value to set the `crossOrigin` property on media elements (img, video, audio).
   * It is only applied when window.__streamlit.BACKEND_BASE_URL is set.
   * If it is set to undefined, the `crossOrigin` property will not be set on media elements at all.
   * For img elements, see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
   */
  resourceCrossOriginMode?: undefined | "anonymous" | "use-credentials"
}

export interface LibContextProps {
  /** True if the app is in full-screen mode. */
  isFullScreen: boolean

  /** Function that sets the `isFullScreen` property. */
  setFullScreen: (value: boolean) => void

  /**
   * Add a callback that will be called every time the app's script finishes
   * executing.
   */
  addScriptFinishedHandler: (func: () => void) => void

  /** Remove a previously-added scriptFinishedHandler callback. */
  removeScriptFinishedHandler: (func: () => void) => void

  /** The currently active app theme. */
  activeTheme: ThemeConfig

  /**
   * Set the app's active theme locally and send it the app's host (if any).
   * @see App.setAndSendTheme
   */
  setTheme: (theme: ThemeConfig) => void

  /** List of all available themes. */
  availableThemes: ThemeConfig[]

  /**
   * Call to add additional themes to the app.
   * @see ThemeCreatorDialog
   */
  addThemes: (themes: ThemeConfig[]) => void

  /**
   * Change the page in a multi-page app.
   * @see PageLink
   */
  onPageChange: (pageScriptHash: string) => void

  /**
   * The current page of a multi-page app.
   * @see PageLink
   */
  currentPageScriptHash: string

  /**
   * The lib-specific configuration from the apps host which is requested via the
   * _stcore/host-config endpoint.
   */
  libConfig: LibConfig

  /**
   * The IDs of the fragments that the current script run corresponds to. If the
   * current script run isn't due to a fragment, this field is falsy.
   */
  fragmentIdsThisRun: Array<string>

  /**
   * The current locale of the app. Defaults to the browser's locale.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
   */
  locale: typeof window.navigator.language

  /**
   * The app's current ScriptRunState. This is used in combination with
   * scriptRunId to prune stale elements. It's also used by the app to
   * display the "running man" indicator when the app's script is being re-run.
   * Pulled from context in BlockNodeRenderer, ElementNodeRenderer, Tabs
   * @see Block
   * @see ElementNodeRender
   * @see Tabs
   */
  scriptRunState: ScriptRunState

  /**
   * The ID of the current "script run". When a Streamlit script is re-run
   * (usually as a result of the user interacting with a widget), the Streamlit
   * backend sends a new scriptRunId to the frontend. When the script run ends,
   * the frontend discards "stale" elements (that is, elements with a non-current
   * scriptRunId).
   * Pulled from context in BlockNodeRenderer, ElementNodeRenderer, Tabs
   * @see Block
   * @see ElementNodeRender
   * @see Tabs
   */
  scriptRunId: string

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
  addScriptFinishedHandler: () => {},
  removeScriptFinishedHandler: () => {},
  activeTheme: baseTheme,
  setTheme: () => {},
  availableThemes: [],
  addThemes: () => {},
  onPageChange: () => {},
  currentPageScriptHash: "",
  libConfig: {},
  fragmentIdsThisRun: [],
  locale: window.navigator.language,
  scriptRunState: ScriptRunState.NOT_RUNNING,
  scriptRunId: "",
  // This should be overwritten
  componentRegistry: new ComponentRegistry(noOpEndpoints),
})
LibContext.displayName = "LibContext"
