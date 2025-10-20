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

import { ScriptRunState } from "~lib/ScriptRunState"

export interface ScriptRunContextProps {
  /**
   * The app's current ScriptRunState. This is used in combination with
   * scriptRunId to prune stale elements. It's also used by the app to
   * display the "running man" indicator when the app's script is being re-run.
   *
   * This context is optimized for components that need to react to script
   * execution state changes without re-rendering on unrelated updates.
   *
   * Consumed by: BlockNodeRenderer, ElementNodeRenderer, Tabs, Form
   * @see Block
   * @see ElementNodeRenderer
   * @see Tabs
   * @see Form
   */
  scriptRunState: ScriptRunState

  /**
   * The ID of the current "script run". When a Streamlit script is re-run
   * (usually as a result of the user interacting with a widget), the Streamlit
   * backend sends a new scriptRunId to the frontend. When the script run ends,
   * the frontend discards "stale" elements (that is, elements with a non-current
   * scriptRunId).
   *
   * Consumed by: BlockNodeRenderer, ElementNodeRenderer, Tabs
   * @see Block
   * @see ElementNodeRenderer
   * @see Tabs
   */
  scriptRunId: string

  /**
   * The IDs of the fragments that the current script run corresponds to. If the
   * current script run isn't due to a fragment, this field is falsy.
   *
   * Consumed by: BlockNodeRenderer
   * @see Block
   */
  fragmentIdsThisRun: Array<string>
}

/**
 * ScriptRunContext provides script execution state throughout the app.
 *
 * We provide safe default values to prevent crashes during initial render
 * before the App component has fully initialized. These are the same default
 * placeholder values as App.tsx.
 */
export const ScriptRunContext = createContext<ScriptRunContextProps>({
  scriptRunState: ScriptRunState.NOT_RUNNING,
  scriptRunId: "<null>",
  fragmentIdsThisRun: [],
})

// Set the context display name for React DevTools
ScriptRunContext.displayName = "ScriptRunContext"
