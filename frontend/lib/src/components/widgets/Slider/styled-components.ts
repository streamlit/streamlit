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

import styled from "@emotion/styled"
import { type StyleProps } from "baseui/slider"
import { transparentize } from "color2k"

export const StyledSlider = styled.div({
  position: "relative",
  ":focus-within:has(:focus-visible)": {
    "--slider-focused": 1,
  },
})

export interface StyledThumbProps {
  disabled: boolean
  isDragged: boolean
}

export const StyledThumb = styled.div<StyledThumbProps>(
  ({ disabled, theme, isDragged }) => ({
    alignItems: "center",
    backgroundColor: disabled ? theme.colors.gray60 : theme.colors.primary,
    borderTopLeftRadius: "100%",
    borderTopRightRadius: "100%",
    borderBottomLeftRadius: "100%",
    borderBottomRightRadius: "100%",
    borderTopStyle: "none",
    borderBottomStyle: "none",
    borderRightStyle: "none",
    borderLeftStyle: "none",
    display: "flex",
    justifyContent: "center",
    height: theme.sizes.sliderThumb,
    width: theme.sizes.sliderThumb,
    boxShadow: isDragged
      ? `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`
      : "none",
    ":focus": {
      outline: "none",
    },
    ":focus-visible": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
    },
  })
)

export interface StyledThumbValueProps {
  disabled: boolean
}

export const StyledThumbValue = styled.div<StyledThumbValueProps>(
  ({ disabled, theme }) => ({
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
    color: disabled ? theme.colors.gray60 : theme.colors.primary,
    top: "-1.6em",
    position: "absolute",
    whiteSpace: "nowrap",
    backgroundColor: theme.colors.transparent,
    lineHeight: theme.lineHeights.base,
    fontWeight: theme.fontWeights.normal,
    // If values are clickable, it's hard to move the right thumb when they're
    // very close. So make them unclickable:
    pointerEvents: "none",
  })
)

export const StyledInnerTrackWrapper = styled.div({
  flex: 1,
})

export const StyledThumbWrapper = styled.div<StyleProps>(({ theme }) => {
  return {
    position: "absolute",
    height: theme.spacing.twoXS,
    left: `calc(${theme.sizes.sliderThumb} / 2)`,
    right: `calc(${theme.sizes.sliderThumb} / 2)`,
  }
})

export interface StyledSliderTickBarProps {
  isHovered: boolean
  isDisabled: boolean
}

export const StyledSliderTickBar = styled.div<StyledSliderTickBarProps>(
  ({ theme, isHovered, isDisabled }) => ({
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    display: "flex",
    justifyContent: "space-between",
    pointerEvents: "none",
    marginTop: `-${theme.spacing.md}`,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    fontWeight: theme.fontWeights.normal,
    color: isDisabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    opacity: isHovered ? 1 : "var(--slider-focused, 0)",
    transition: isHovered ? "none" : "opacity 300ms 200ms",
  })
)
