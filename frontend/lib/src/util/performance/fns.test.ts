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

import { afterEach, describe, expect, it, vi } from "vitest"

import { ScriptRunState } from "~lib/ScriptRunState"

import { mark, measure } from "./fns"
import type { StPerformanceMetric } from "./types"

// Typed metric name from StPerformanceMetric
const SCRIPT_RUN_CYCLE: StPerformanceMetric = "script-run-cycle"

describe("performance fns", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("mark", () => {
    it("delegates to performance.mark with the given name", () => {
      const spy = vi
        .spyOn(performance, "mark")
        .mockImplementation(name => ({ name }) as unknown as PerformanceMark)

      const result = mark(ScriptRunState.RUNNING)

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(ScriptRunState.RUNNING)
      expect((result as unknown as { name: string }).name).toBe(
        ScriptRunState.RUNNING
      )
    })
  })

  describe("measure", () => {
    it("delegates to performance.measure with the provided arguments", () => {
      const spy = vi
        .spyOn(performance, "measure")
        .mockImplementation(
          name => ({ name }) as unknown as PerformanceMeasure
        )

      const result = measure(
        SCRIPT_RUN_CYCLE,
        ScriptRunState.RUNNING,
        ScriptRunState.NOT_RUNNING
      )

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(
        SCRIPT_RUN_CYCLE,
        ScriptRunState.RUNNING,
        ScriptRunState.NOT_RUNNING
      )
      expect((result as unknown as { name: string }).name).toBe(
        SCRIPT_RUN_CYCLE
      )
    })

    it("supports measure options instead of a start mark", () => {
      const spy = vi
        .spyOn(performance, "measure")
        .mockImplementation(
          name => ({ name }) as unknown as PerformanceMeasure
        )

      const options: PerformanceMeasureOptions = {
        start: 5,
        end: 10,
        detail: { reason: "test" },
      }
      measure(SCRIPT_RUN_CYCLE, options)

      expect(spy).toHaveBeenCalledWith(SCRIPT_RUN_CYCLE, options, undefined)
    })
  })
})
