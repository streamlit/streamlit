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

import { mockTheme } from "~lib/mocks/mockTheme"
import { computeDerivedColors } from "~lib/theme/getColors"

import { createCardBackgroundTheme } from "./cardBackgroundTheme"

describe("createCardBackgroundTheme", () => {
  const { emotion } = mockTheme

  it("swaps the background and secondary background", () => {
    const theme = createCardBackgroundTheme(emotion)

    expect(theme.colors.bgColor).toBe(emotion.colors.secondaryBg)
    expect(theme.colors.secondaryBg).toBe(emotion.colors.bgColor)
  })

  it("swaps back for a nested filled card", () => {
    const theme = createCardBackgroundTheme(createCardBackgroundTheme(emotion))

    expect(theme.colors.bgColor).toBe(emotion.colors.bgColor)
    expect(theme.colors.secondaryBg).toBe(emotion.colors.secondaryBg)
  })

  it("recomputes the colors derived from the swapped backgrounds", () => {
    const theme = createCardBackgroundTheme(emotion)

    expect(theme.colors.bgMix).toBe(
      computeDerivedColors({
        ...emotion.colors,
        bgColor: emotion.colors.secondaryBg,
        secondaryBg: emotion.colors.bgColor,
      }).bgMix
    )
  })

  it("keeps every other theme value", () => {
    const theme = createCardBackgroundTheme(emotion)

    expect(theme.colors.bodyText).toBe(emotion.colors.bodyText)
    expect(theme.colors.borderColor).toBe(emotion.colors.borderColor)
    expect(theme.radii).toBe(emotion.radii)
  })
})
