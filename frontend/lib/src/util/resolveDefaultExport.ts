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
 * Unwrap nested CommonJS `default` export wrappers.
 *
 * Some dependencies can be returned as `module.default.default` under Vite 8
 * interop. We limit unwrapping depth to avoid walking arbitrary object graphs.
 */
export function resolveDefaultExport(
  moduleValue: unknown,
  maxDepth = 3
): unknown {
  let resolvedValue = moduleValue

  for (let i = 0; i < maxDepth; i += 1) {
    if (
      !resolvedValue ||
      typeof resolvedValue !== "object" ||
      !("default" in resolvedValue)
    ) {
      break
    }

    resolvedValue = resolvedValue.default
  }

  return resolvedValue
}
