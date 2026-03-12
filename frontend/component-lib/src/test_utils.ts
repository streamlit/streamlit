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
 * Yields to the next macrotask so `MessageEvent` handlers scheduled by
 * `postMessage()` can run before assertions.
 *
 * Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 */
export const tick = (): Promise<void> =>
  // eslint-disable-next-line no-restricted-globals -- Outside of the main packages, we need to use window.setTimeout.
  new Promise<void>(resolve => setTimeout(resolve, 0))
