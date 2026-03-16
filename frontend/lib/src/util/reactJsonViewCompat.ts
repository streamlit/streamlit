/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/**
 * Compatibility shim for react-json-view.
 *
 * Vite 8 can produce varying module structures from CommonJS dependencies
 * like @microlink/react-json-view - sometimes directly exposing the component,
 * sometimes wrapping it in default exports. This causes "Element type is
 * invalid" errors when trying to render.
 *
 * This shim ensures we always resolve a callable React component from the
 * imported module, even when the dependency is wrapped through nested
 * default exports.
 */

import * as ReactJsonModule from "@microlink/react-json-view"

// Re-export types
export type {
  InteractionProps,
  OnCopyProps,
  OnSelectProps,
} from "@microlink/react-json-view"

/**
 * Resolve the actual component from potentially nested default exports.
 * Handles cases where the module is structured as:
 * - { default: Component }
 * - { default: { default: Component } }
 * - Component (direct export)
 */
function resolveDefaultExport(mod: unknown): unknown {
  let current = mod
  // Unwrap up to 2 levels of nested defaults
  for (let i = 0; i < 2; i++) {
    if (
      current &&
      typeof current === "object" &&
      "default" in current &&
      (current as Record<string, unknown>).default
    ) {
      current = (current as Record<string, unknown>).default
    } else {
      break
    }
  }
  return current
}

const ReactJson = resolveDefaultExport(
  ReactJsonModule
) as typeof import("@microlink/react-json-view").default

export default ReactJson
