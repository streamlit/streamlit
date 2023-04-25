/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
    height: theme.radii.xl,
    justifyContent: "center",
    width: theme.radii.xl,
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
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes.sm,
    paddingBottom: theme.spacing.twoThirdsSmFont,
    color: disabled ? theme.colors.gray : theme.colors.primary,
    top: "-22px",
    position: "absolute",
    whiteSpace: "nowrap",
    backgroundColor: theme.colors.transparent,
    lineHeight: theme.lineHeights.base,
    fontWeight: "normal",
  })
)

export const StyledTickBar = styled.div(({ theme }) => ({
  paddingBottom: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
  paddingTop: theme.spacing.twoThirdsSmFont,
  justifyContent: "space-between",
  alignItems: "center",
  display: "flex",
}))

export const StyledTickBarItem = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    lineHeight: theme.lineHeights.base,
    fontWeight: "normal",
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.monospace,
    color: disabled ? theme.colors.fadedText40 : "inherit",
  })
)
