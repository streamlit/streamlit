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
 * Compatibility shim for `@microlink/react-json-view` under Vite 8.
 *
 * Intent:
 * - Always resolve a callable React component from the imported module, even
 *   when the dependency is wrapped through nested default exports.
 *
 * Why this exists:
 * - `@microlink/react-json-view` is published as CommonJS, and Vite 8 interop can yield
 *   different runtime module shapes (`module`, `module.default`,
 *   `module.default.default`) depending on optimization path.
 * - Without normalization, Json components can fail with
 *   "Element type is invalid".
 * - Direct imports work in CI builds but fail when running locally with the
 *   hot-reload dev server (e.g., `make debug` or `make frontend-dev`).
 *
 * Removal criteria:
 * - Remove once direct `import ReactJson from "@microlink/react-json-view"` is proven
 *   stable across both CI builds AND local dev server in this repo.
 * - Validate by running the debug app and checking
 *   `work-tmp/debug/latest/frontend.log` for Json render/import failures.
 *
 * Vite references:
 * - https://vite.dev/guide/migration.html
 * - https://vite.dev/config/dep-optimization-options
 */
import * as ReactJsonViewModule from "@microlink/react-json-view"

import { resolveDefaultExport } from "./resolveDefaultExport"

type ReactJsonViewComponent =
  (typeof import("@microlink/react-json-view"))["default"]

const ReactJsonView = resolveDefaultExport(
  ReactJsonViewModule
) as ReactJsonViewComponent

export default ReactJsonView
export type { OnCopyProps, OnSelectProps } from "@microlink/react-json-view"
