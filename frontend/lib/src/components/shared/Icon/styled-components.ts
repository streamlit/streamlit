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

import isPropValid from "@emotion/is-prop-valid"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { EmotionIcon } from "@emotion-icons/emotion-icon"

import type { IconSizeProp } from "~lib/theme/types"
import { computeSpacingStyle } from "~lib/theme/utils"

import { getIconCssSize } from "./getIconCssSize"

const spinKeyframe = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
})

interface StyledSpinnerIconProps {
  size?: IconSizeProp
  margin?: string
  padding?: string
}

export const StyledSpinnerIcon = styled("span", {
  shouldForwardProp: (prop: string) =>
    isPropValid(prop) && !["size"].includes(prop),
})<StyledSpinnerIconProps>(({
  size = "lg",
  margin = "",
  padding = "",
  theme,
}) => {
  // Spinners are rendered 20% smaller to visually match the size of Material icons:
  const adjustedSpinnerSize = `calc(${getIconCssSize(size, theme.iconSizes)} * 0.80)`

  return {
    display: "block",
    animationName: spinKeyframe,
    animationDuration: "1000ms",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear",
    borderStyle: "solid",
    borderRadius: "50%",
    cursor: "wait",
    width: adjustedSpinnerSize,
    height: adjustedSpinnerSize,
    margin: computeSpacingStyle(margin, theme),
    padding: computeSpacingStyle(padding, theme),
    borderColor: theme.colors.fadedText10,
    borderTopColor: theme.colors.bodyText,
    borderWidth: theme.sizes.spinnerThickness,
    flexGrow: 0,
    flexShrink: 0,
    // Slow the spin rather than stopping it: the rotation is the only cue that
    // work is still in progress, and a parked ring reads as a hung app.
    "@media (prefers-reduced-motion: reduce)": {
      animationDuration: "1800ms",
    },
  }
})

interface StyledIconProps {
  as?: EmotionIcon
  color?: string
  size: IconSizeProp
  margin: string
  padding: string
}

export const StyledIcon = styled("span", {
  shouldForwardProp: (prop: string) =>
    isPropValid(prop) && !["size", "as"].includes(prop),
})<StyledIconProps>(({ color, size, margin, padding, theme }) => {
  const iconCssSize = getIconCssSize(size, theme.iconSizes)
  return {
    color: color || "inherit",
    fill: "currentColor",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: iconCssSize,
    width: iconCssSize,
    height: iconCssSize,
    margin: computeSpacingStyle(margin, theme),
    padding: computeSpacingStyle(padding, theme),
    flexShrink: 0,
  }
})

interface StyledDynamicIconProps {
  size?: IconSizeProp
  margin?: string
  padding?: string
}

export const StyledDynamicIcon = styled.span<StyledDynamicIconProps>(
  ({ size = "lg", margin = "", padding = "", theme }) => {
    const iconCssSize = getIconCssSize(size, theme.iconSizes)
    return {
      fill: "currentColor",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: iconCssSize,
      width: iconCssSize,
      height: iconCssSize,
      margin: computeSpacingStyle(margin, theme),
      padding: computeSpacingStyle(padding, theme),
      flexShrink: 0,
    }
  }
)

export const StyledImageIcon = styled.img({
  width: "100%",
  height: "100%",
})

interface StyledEmojiIconProps {
  size: IconSizeProp
  margin: string
  padding: string
  color?: string
}

export const StyledEmojiIcon = styled.span<StyledEmojiIconProps>(
  ({ size, margin, padding, theme, color }) => {
    // Shrink via font-size; width/height 1em track it so inherit does not compound.
    const adjustedIconSize = `calc(${getIconCssSize(size, theme.iconSizes)} * 0.90)`
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: adjustedIconSize,
      width: "1em",
      height: "1em",
      margin: computeSpacingStyle(margin, theme),
      padding: computeSpacingStyle(padding, theme),
      color: color,
    }
  }
)
