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
 * User-facing message when a required widget is still empty after the user
 * tries to commit it or a form submit fails. Required widgets share this
 * exact string, including the period.
 */
export const REQUIRED_FIELD_MESSAGE = "This field is required."

/**
 * Returns the required-field message when it should be shown, or `null`
 * when it should stay hidden.
 *
 * The message is shown only when the widget is required, a previous commit
 * or submit already recorded the error, and the value is still empty.
 * Callers clear the stored flag when this returns `null`. With a widget
 * key, `required` is outside widget identity, so the same instance keeps
 * that flag across reruns.
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
