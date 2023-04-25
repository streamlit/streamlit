/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { Delta, ForwardMsgMetadata } from "src/autogen/proto"

/**
 * A mapping of [delta type] -> [count] which is used to upload delta stats
 * when the app is idle.
 */
export interface DeltaCounter {
  [name: string]: number
}

/**
 * A mapping of [component instance name] -> [count] which is used to upload
 * custom component stats when the app is idle.
 */
export interface CustomComponentCounter {
  [name: string]: number
}

/**
 * Interface for gathering app usage metrics. By default, Streamlit uses the
 * `SegementMetricsManager` implementation.
 */
export interface MetricsManager {
  /** Record a new event with the manager. */
  enqueue(evName: string, evData: Record<string, any>): void

  /** Record all appropriate events for a delta message. */
  handleDeltaMessage(delta: Delta, metadata: ForwardMsgMetadata): void

  /**
   * Get a copy of the pending DeltaCounter object, and reset it, and
   * clear the manager's copy.
   */
  getAndResetDeltaCounter(): DeltaCounter

  /** Clear the manager's pending DeltaCounter object. */
  clearDeltaCounter(): void

  /**
   * Get a copy of the pending CustomComponentCounter object, and reset it, and
   * clear the manager's copy.
   */
  getAndResetCustomComponentCounter(): CustomComponentCounter
}
