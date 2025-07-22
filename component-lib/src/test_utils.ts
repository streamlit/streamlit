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

// A function that doesn't do anything, but allows you to release
// handlers so that pending events can be executed.
//
// MDN explains this as well:
//
// postMessage() schedules the MessageEvent to be dispatched only after all pending execution
// contexts have finished. For example, if postMessage() is invoked in an event handler,
// that event handler will run to completion, as will any remaining handlers for that same
// event, before the MessageEvent is dispatched.
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
export const tick = () =>
  new Promise((resolve) => setTimeout(() => resolve(0), 0));
