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
import { transparentize } from "color2k"

export interface StyledSliderProps {
  disabled: boolean
}

export const StyledThumb = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    alignItems: "center",
    backgroundColor: disabled ? theme.colors.gray : theme.colors.primary,
    borderTopLeftRadius: "100%",
    borderTopRightRadius: "100%",
    borderBottomLeftRadius: "100%",
    borderBottomRightRadius: "100%",
    borderTopStyle: "none",
    borderBottomStyle: "none",
    borderRightStyle: "none",
    borderLeftStyle: "none",
    boxShadow: "none",
    display: "flex",
    justifyContent: "center",
    height: theme.sizes.sliderThumb,
    width: theme.sizes.sliderThumb,
    ":focus": {
      outline: "none",
    },
    ":focus-visible": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
    },
  })
)

export const StyledThumbValue = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
    color: disabled ? theme.colors.gray : theme.colors.primary,
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

export const StyledSliderContainer = styled.div({
  position: "relative",
})

export interface StyledMarkProps {
  isSelected: boolean
}

export const StyledMark = styled.div<StyledMarkProps>(
  ({ isSelected, theme }) => ({
    backgroundColor: isSelected
      ? theme.colors.primary
      : theme.colors.secondaryBg,
    borderRadius: theme.radii.full,
    width: `calc(${theme.sizes.sliderThumb} * 0.8333)`,
    height: `calc(${theme.sizes.sliderThumb} * 0.8333)`,
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  })
)
