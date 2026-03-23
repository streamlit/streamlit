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
 * Compatibility shim for `react-uid` when running under Vite 8.
 *
 * Intent:
 * - Provide one stable import surface that exposes both named exports and a
 *   default export for call sites in this codebase.
 *
 * Why this exists:
 * - `react-uid` has mixed module entrypoints, and Vite 8's dependency
 *   optimization/interoperability can surface a different runtime shape than
 *   callers expect, which can break default imports.
 *
 * Removal criteria:
 * - Remove this file and the corresponding Vite alias only after direct
 *   imports from `react-uid` are stable in local dev and production builds.
 * - Validate by running the debug app and ensuring no `react-uid` export or
 *   interop errors are present in `work-tmp/debug/latest/frontend.log`.
 *
 * Vite references:
 * - https://vite.dev/guide/migration.html
 * - https://vite.dev/config/dep-optimization-options
 */
import * as ReactUid from "react-uid/dist/es2015/index.js"

export * from "react-uid/dist/es2015/index.js"
export default ReactUid
