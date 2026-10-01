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

import { describe, expect, it } from "vitest"

import { sizes } from "~lib/theme/primitives/sizes"
import { spacing } from "~lib/theme/primitives/spacing"

import {
  getBareEmbedOverlayToolbarPadding,
  getOverlayToolbarTopDistance,
  OVERLAY_TOOLBAR_BUTTON_MIN_SIZE_PX,
  TOP_DISTANCE,
} from "./overlayToolbarSpacing"

describe("overlayToolbarSpacing", () => {
  const defaultTheme = { spacing, sizes }

  it("builds TOP_DISTANCE from default tokens", () => {
    expect(TOP_DISTANCE).toBe(
      `calc(-1 * (${spacing.sm} + ${spacing.twoXS} + max(${sizes.smallElementHeight}, ${OVERLAY_TOOLBAR_BUTTON_MIN_SIZE_PX}) + ${spacing.twoXS} + ${spacing.twoXS}))`
    )
    expect(getOverlayToolbarTopDistance(defaultTheme)).toBe(TOP_DISTANCE)
  })

  it("builds bare-embed padding from the same button floor", () => {
    expect(getBareEmbedOverlayToolbarPadding(defaultTheme)).toBe(
      `calc(${spacing.twoXS} + ${spacing.twoXS} + ${spacing.twoXS} + 0.1rem + max(${sizes.smallElementHeight}, ${OVERLAY_TOOLBAR_BUTTON_MIN_SIZE_PX}))`
    )
  })

  it("tracks custom spacing tokens", () => {
    const custom = {
      spacing: { sm: "0.4rem", twoXS: "0.2rem" },
      sizes: { smallElementHeight: "1.25rem" },
    }
    expect(getOverlayToolbarTopDistance(custom)).toBe(
      `calc(-1 * (0.4rem + 0.2rem + max(1.25rem, 24px) + 0.2rem + 0.2rem))`
    )
  })
})
