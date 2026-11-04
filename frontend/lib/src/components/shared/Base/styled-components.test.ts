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

import {
  getSecondaryIconButtonColorStyles,
  SECONDARY_ICON_DISABLED_SELECTOR,
  SECONDARY_ICON_HOVER_SELECTOR,
} from "./styled-components"

describe("getSecondaryIconButtonColorStyles", () => {
  const theme = lightTheme.emotion

  it("uses fadedText60 at rest, bodyText on hover/focus-visible, and fadedText40 when disabled", () => {
    const styles = getSecondaryIconButtonColorStyles(theme)

    expect(styles.color).toBe(theme.colors.fadedText60)
    expect(styles[SECONDARY_ICON_HOVER_SELECTOR]).toEqual({
      color: theme.colors.bodyText,
    })
    expect(styles[SECONDARY_ICON_DISABLED_SELECTOR]).toEqual({
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
    })
  })

  it("accepts rest/hover/disabled color overrides", () => {
    const styles = getSecondaryIconButtonColorStyles(theme, {
      restColor: theme.colors.redTextColor,
      hoverColor: theme.colors.redColor,
      disabledColor: theme.colors.fadedText10,
    })

    expect(styles.color).toBe(theme.colors.redTextColor)
    expect(styles[SECONDARY_ICON_HOVER_SELECTOR]).toEqual({
      color: theme.colors.redColor,
    })
    expect(styles[SECONDARY_ICON_DISABLED_SELECTOR]).toEqual({
      color: theme.colors.fadedText10,
      cursor: "not-allowed",
    })
  })
})
