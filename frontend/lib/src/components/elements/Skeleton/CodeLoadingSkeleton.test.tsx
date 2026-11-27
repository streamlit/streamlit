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

import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ElementTimingContext } from "~lib/components/core/RenderTimingContext"
import { render } from "~lib/test_util"
import { RenderTimingTracker } from "~lib/util/performance/RenderTimingTracker"

import { CodeLoadingSkeleton } from "./CodeLoadingSkeleton"

describe("CodeLoadingSkeleton", () => {
  it("reports code loading for render timing while it's mounted", () => {
    const tracker = new RenderTimingTracker({ onReport: vi.fn() })
    const handle = tracker.createElementHandle()
    const { unmount } = render(
      <ElementTimingContext.Provider value={handle}>
        <CodeLoadingSkeleton height="300px" />
      </ElementTimingContext.Provider>
    )

    const skeleton = screen.getByTestId("stSkeleton")
    expect(skeleton).toHaveAttribute("aria-hidden", "true")
    expect(skeleton).toHaveStyle({ height: "300px" })
    expect(Array.from(handle.loadingSlots.values())).toEqual(["code"])

    unmount()
    expect(handle.loadingSlots.size).toBe(0)
    tracker.dispose()
  })
})
