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

export interface ViewStateContextProps {
  /**
   * Global fullscreen state for the Streamlit app. When true, the app is in
   * fullscreen mode (typically triggered by a user action like expanding a chart).
   *
   * This differs from element-specific fullscreen (ElementFullscreenContext) which
   * tracks which specific element is expanded. This global state is used to:
   * - Hide the app chrome (header, toolbar) during fullscreen
   * - Adjust layout calculations and sizing
   * - Apply fullscreen-specific styling
   *
   * This context is optimized for components that need to react to fullscreen
   * state changes without re-rendering on unrelated updates.
   *
   * Consumed by:
   * @see ElementNodeRenderer - Passes isFullScreen to element width/height calculations
   * @see useStWidthHeight - Adjusts element dimensions based on fullscreen state
   * @see Toolbar - Shows/hides based on fullscreen state
   * @see ArrowVegaLiteChart - Adjusts chart sizing
   * @see PlotlyChart - Adjusts chart sizing
   * @see DeckGlJsonChart - Adjusts map sizing
   * @see GraphVizChart - Adjusts chart sizing
   * @see ImageList - Adjusts image sizing
   * @see DataFrame - Adjusts table sizing
   * @see AudioInput - Adjusts input sizing
   */
  isFullScreen: boolean

  /**
   * Function to set the global fullscreen state. Used when a user expands
   * or collapses an element to/from fullscreen.
   *
   * Consumed by:
   * @see useFullscreen - Hook that manages fullscreen toggling for individual elements
   * @see App.handleFullScreen - Top-level state management
   */
  setFullScreen: (value: boolean) => void
}

/**
 * ViewStateContext provides global view state for the Streamlit app.
 *
 * This context contains view-level state that affects the overall application
 * layout and presentation, such as fullscreen mode.
 *
 * We provide safe default values to prevent crashes during initial render
 * before the App component has fully initialized.
 */
export const ViewStateContext = createContext<ViewStateContextProps>({
  isFullScreen: false,
  setFullScreen: () => {},
})

// Set the context display name for React DevTools
ViewStateContext.displayName = "ViewStateContext"
