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

/**
 * Formats a duration in seconds into a human-readable string.
 *
 * @param seconds - The duration in seconds to format
 * @returns A formatted string representation of the duration in parentheses
 *
 * @example
 * formatTime(1.1)    // "(1.1 seconds)"
 * formatTime(65.3)   // "(1 minute, 5.3 seconds)"
 * formatTime(3661.1) // "(1 hour, 1 minute, 1.1 seconds)"
 *
 * TODO: In the future, we might want to replace this with `Intl.DurationFormat` (see
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat).
 * But that API is not available on Firefox yet.
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours === 0 && mins === 0) {
    return `(${secs.toFixed(1)} seconds)`
  }

  if (hours === 0) {
    const minText = `${mins} minute${mins === 1 ? "" : "s"}`
    const secText = secs === 0 ? "" : `, ${secs.toFixed(1)} seconds`
    return `(${minText}${secText})`
  }

  const hourText = `${hours} hour${hours === 1 ? "" : "s"}`
  const minText = mins === 0 ? "" : `, ${mins} minute${mins === 1 ? "" : "s"}`
  const secText = secs === 0 ? "" : `, ${secs.toFixed(1)} seconds`
  return `(${hourText}${minText}${secText})`
}
