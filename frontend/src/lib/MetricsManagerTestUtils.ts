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

import { mockSessionInfo } from "./mocks/mocks"
import { SessionInfo } from "./SessionInfo"

// This file is only used in tests, so these imports can be in devDependencies
/* eslint-disable import/no-extraneous-dependencies */
import { SegmentMetricsManager } from "./SegmentMetricsManager"

export function getMetricsManagerForTest(
  sessionInfo?: SessionInfo
): SegmentMetricsManager {
  const mm = new SegmentMetricsManager(sessionInfo || mockSessionInfo())
  // @ts-expect-error
  mm.track = jest.fn()
  // @ts-expect-error
  mm.identify = jest.fn()
  return mm
}
