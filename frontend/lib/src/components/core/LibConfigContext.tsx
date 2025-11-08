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
 * LibConfigContext provides static configuration values from LibConfig
 * (server-sent configuration) plus browser-detected locale.
 *
 * Properties from LibConfig (inherited via extension):
 *
 * - `mapboxToken`: Mapbox API token for rendering map visualizations. Optional -
 *   if not provided, Mapbox-based maps will not render.
 *   Consumed by:
 *    @see DeckGlJsonChart
 *
 * - `enforceDownloadInNewTab`: Whether to enforce opening download links in a new
 *   tab. When true, all download buttons and links will open in a new tab instead
 *   of triggering a download in the current tab. This is useful for environments
 *   where downloads need to be explicitly controlled or logged by the host application.
 *   Consumed by:
 *   @see DownloadButton
 *   @see DataFrame
 *   @see useDownloadUrl
 *
 * - `resourceCrossOriginMode`: Controls the CORS mode for loading media resources
 *   (images, videos, audio). This determines the crossOrigin attribute set on media
 *   elements. Values: "anonymous" (CORS without credentials), "use-credentials"
 *   (CORS with credentials), or undefined (no CORS, same-origin only). This is
 *   important for apps running in iframes or cross-origin contexts.
 *   Consumed by:
 *   @see useCrossOriginAttribute
 *   @see Particles
 *   @see LogoComponent
 *   @see StreamlitMarkdown
 *
 * Note: `disableFullscreenMode` is intentionally omitted from LibConfig and passed
 * as a prop instead for better performance (avoids unnecessary re-renders).
 */
export interface LibConfigContextProps
  extends Omit<LibConfig, "disableFullscreenMode"> {
  /**
   * The current locale of the app. Defaults to the browser's locale.
   * Used for internationalization of date pickers and other locale-sensitive
   * UI components.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
   *
   * Consumed by:
   * @see DateInput
   */
  locale: typeof window.navigator.language
}

/**
 * LibConfigContext provides static configuration throughout the app.
 *
 * These values are set once during app initialization and rarely (if ever)
 * change during the app's lifetime. They come from:
 * 1. Server-sent LibConfig (from backend)
 * 2. Browser environment (locale)
 *
 * We provide safe default values to prevent crashes during initial render
 * before the App component has fully initialized. These defaults are sensible
 * fallbacks that allow the app to render even if the server hasn't sent config yet.
 */
export const LibConfigContext = createContext<LibConfigContextProps>({
  locale: window.navigator.language,
  // Selected libConfig properties:
  mapboxToken: undefined,
  enforceDownloadInNewTab: undefined,
  resourceCrossOriginMode: undefined,
})

// Set the context display name for React DevTools
LibConfigContext.displayName = "LibConfigContext"
