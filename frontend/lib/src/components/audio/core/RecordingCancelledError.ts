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
 * Rejection used when a pending stop is abandoned on purpose (the user
 * cancelled, or the player or controller was reset or torn down). Callers
 * treat it as a non-error: no error state, and no approval of the recording.
 */
export class RecordingCancelledError extends Error {
  constructor(message = "Recording cancelled") {
    super(message)
    this.name = "RecordingCancelledError"
  }
}
