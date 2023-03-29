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

  /**
   * Increment a counter that tracks the number of times a Delta message
   * of the given type has been processed by the frontend.
   *
   * No event is recorded for this. Instead, call `getAndResetDeltaCounter`
   * periodically, and enqueue an event with the result.
   */
  incrementDeltaCounter(deltaType: string): void

  /**
   * Get a copy of the pending DeltaCounter object, and reset it, and
   * clear the manager's copy.
   */
  getAndResetDeltaCounter(): DeltaCounter

  /** Clear the manager's pending DeltaCounter object. */
  clearDeltaCounter(): void

  /**
   * Increment a counter that tracks the number of times a CustomComponent
   * of the given type has been used by the frontend.
   *
   * No event is recorded for this. Instead, call `getAndResetCustomComponentCounter`
   * periodically, and enqueue an event with the result.
   */
  incrementCustomComponentCounter(customInstanceName: string): void

  /**
   * Get a copy of the pending CustomComponentCounter object, and reset it, and
   * clear the manager's copy.
   */
  getAndResetCustomComponentCounter(): CustomComponentCounter

  /** Clear the manager's pending CustomComponentCounter object. */
  clearCustomComponentCounter(): void
}
