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

export function ensureError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }

  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return new Error(`${err}`)
}

/**
 * Display text for a Promise rejection. Falsy values use `fallback`.
 */
export function formatRejectionMessage(
  err: unknown,
  fallback = "Unknown error"
): string {
  if (!err) {
    return fallback
  }
  if (err instanceof Error) {
    return err.toString()
  }
  if (typeof err === "string") {
    return err
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- remaining objects use Object.prototype.toString
  return String(err)
}
