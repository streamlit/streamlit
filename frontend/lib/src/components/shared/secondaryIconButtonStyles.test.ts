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

import { lightTheme } from "~lib/theme/themeConfigs"

import { getSecondaryIconButtonColorStyles } from "./secondaryIconButtonStyles"

describe("getSecondaryIconButtonColorStyles", () => {
  const theme = lightTheme.emotion

  it("uses fadedText60 at rest and bodyText on hover/focus", () => {
    const styles = getSecondaryIconButtonColorStyles(theme)

    expect(styles.color).toBe(theme.colors.fadedText60)
    expect(styles["&:hover:not(:disabled), &:focus:not(:disabled)"]).toEqual({
      color: theme.colors.bodyText,
    })
    expect(styles["&:disabled, &:disabled:hover, &:disabled:focus"]).toEqual({
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
    })
  })

  it("includes data-hovered when requested", () => {
    const styles = getSecondaryIconButtonColorStyles(theme, {
      includeDataHovered: true,
    })

    expect(
      styles["&:hover:not(:disabled), &:focus:not(:disabled), &[data-hovered]"]
    ).toEqual({
      color: theme.colors.bodyText,
    })
  })
})
