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

import React, {
  FC,
  ProfilerOnRenderCallback,
  PropsWithChildren,
  Profiler as ReactProfiler,
} from "react"

import { CircularBuffer } from "./CircularBuffer"

export type ProfilerProps = PropsWithChildren<{
  /**
   * The unique ID of a Profiler.
   * Statically typed so we can enforce which profiles are being collected.
   */
  id: "Main" | "Sidebar" | "Bottom" | "Event"
}>

/**
 * Callback function for React Profiler that collects performance data and
 * writes it to the global `window.__streamlit_profiles__` object so that it can
 * be collected in our performance tests.
 */
const handleRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  window.__streamlit_profiles__ = window.__streamlit_profiles__ || {}

  window.__streamlit_profiles__[id] =
    window.__streamlit_profiles__[id] ||
    // Use a CircularBuffer to limit the number of profiles stored in memory to
    // prevent any potential memory leaks.
    // 1000 is an arbitrary number that should be enough to store more than
    // enough entries for debugging purposes without consuming too much memory.
    new CircularBuffer<(typeof window.__streamlit_profiles__)[string]>(1000)

  window.__streamlit_profiles__[id].push({
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  })
}

/**
 * Programmatic profiler component that collects performance data from React
 * Profiler.
 *
 * Since the Profiling build of React is not used in production, this component
 * is only doing something meaningful in tests. Otherwise it is effectively a
 * no-op since the callback will never be called.
 */
export const Profiler: FC<ProfilerProps> = ({ id, children }) => {
  return (
    <ReactProfiler id={id} onRender={handleRender}>
      {children}
    </ReactProfiler>
  )
}
