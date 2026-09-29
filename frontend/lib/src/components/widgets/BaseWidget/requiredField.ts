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
 * Tooltip / alert copy for a blocked empty commit or failed form submit.
 * Required widgets must use this exact string, including the period.
 */
export const REQUIRED_FIELD_MESSAGE = "This field is required."

/**
 * Required error after a blocked empty commit or failed form submit.
 * Returns null when required is off or the field is non-empty so leftover
 * chrome does not survive a keyed remount that changes those conditions.
 */
export function requiredFieldError(
  required: boolean,
  hasRequiredError: boolean,
  isEmpty: boolean
): string | null {
  return required && hasRequiredError && isEmpty
    ? REQUIRED_FIELD_MESSAGE
    : null
}
