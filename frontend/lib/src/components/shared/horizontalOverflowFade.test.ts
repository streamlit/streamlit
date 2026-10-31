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

import { getHorizontalOverflowFadeStyles } from "./horizontalOverflowFade"

describe("getHorizontalOverflowFadeStyles", () => {
  const styles = getHorizontalOverflowFadeStyles("1rem")

  it("hides the scrollbar, contains overscroll, and pads focus into the fade", () => {
    expect(styles.scrollbarWidth).toBe("none")
    expect(styles.overscrollBehaviorX).toBe("contain")
    expect(styles.scrollPaddingInline).toBe("1rem")
  })

  it("fades both overflowing edges with a to-right mask", () => {
    expect(styles["&[data-can-scroll-start][data-can-scroll-end]"]).toEqual({
      maskImage: expect.stringMatching(/to right.*1rem/),
      WebkitMaskImage: expect.stringMatching(/to right.*1rem/),
    })
  })

  it("fades only the overflowing start or end edge", () => {
    expect(
      styles["&[data-can-scroll-start]:not([data-can-scroll-end])"]
    ).toEqual({
      maskImage: expect.stringContaining("to right"),
      WebkitMaskImage: expect.stringContaining("to right"),
    })
    expect(
      styles["&:not([data-can-scroll-start])[data-can-scroll-end]"]
    ).toEqual({
      maskImage: expect.stringContaining("to right"),
      WebkitMaskImage: expect.stringContaining("to right"),
    })
  })
})
