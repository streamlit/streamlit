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

export const INVALID_TEXT_INPUT_MESSAGE = "Invalid input."

/**
 * Compiles the user-provided validation pattern into a RegExp.
 *
 * The `"us"` flags (unicode + dotAll) intentionally match the convention used
 * by `st.column_config.TextColumn` so regex behavior is consistent across
 * Streamlit's text inputs.
 *
 * Returns the compiled RegExp on success, an error message string if the
 * pattern is invalid, or undefined if no pattern was provided.
 */
export function compileTextInputValidationRegex(
  pattern?: string | null
): RegExp | string | undefined {
  if (!pattern) {
    return undefined
  }

  try {
    return new RegExp(pattern, "us")
  } catch (error) {
    return `Invalid validate regex: ${pattern}. Error: ${String(error)}`
  }
}

/**
 * Returns true if the value satisfies the validation regex. Empty values
 * (null or "") always pass so that validation does not block clearing.
 */
export function passesTextInputValidation(
  value: string | null,
  validateRegex: RegExp
): boolean {
  if (value === null || value === "") {
    return true
  }

  return validateRegex.test(value)
}
