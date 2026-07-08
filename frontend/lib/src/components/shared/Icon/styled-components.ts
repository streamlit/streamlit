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

import type { IconSize } from "~lib/theme/types"
import { computeSpacingStyle } from "~lib/theme/utils"

const spinKeyframe = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
})

interface StyledSpinnerIconProps {
  size?: IconSize
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
  const adjustedSpinnerSize = `calc(${theme.iconSizes[size]} * 0.80)`

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
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  }
})

interface StyledIconProps {
  as?: EmotionIcon
  color?: string
  size: IconSize
  margin: string
  padding: string
}

export const StyledIcon = styled("span", {
  shouldForwardProp: (prop: string) =>
    isPropValid(prop) && !["size", "as"].includes(prop),
})<StyledIconProps>(({ color, size, margin, padding, theme }) => {
  return {
    color: color || "inherit",
    fill: "currentColor",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: theme.iconSizes[size],
    width: theme.iconSizes[size],
    height: theme.iconSizes[size],
    margin: computeSpacingStyle(margin, theme),
    padding: computeSpacingStyle(padding, theme),
    flexShrink: 0,
  }
})

interface StyledDynamicIconProps {
  size?: IconSize
  margin?: string
  padding?: string
}

export const StyledDynamicIcon = styled.span<StyledDynamicIconProps>(
  ({ size = "lg", margin = "", padding = "", theme }) => {
    return {
      fill: "currentColor",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: theme.iconSizes[size],
      width: theme.iconSizes[size],
      height: theme.iconSizes[size],
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
  size: IconSize
  margin: string
  padding: string
  color?: string
}

export const StyledEmojiIcon = styled.span<StyledEmojiIconProps>(
  ({ size, margin, padding, theme, color }) => {
    // Emojis are rendered 10% smaller to visually match the size of Material icons:
    const adjustedIconSize = `calc(${theme.iconSizes[size]} * 0.90)`
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: adjustedIconSize,
      width: adjustedIconSize,
      height: adjustedIconSize,
      margin: computeSpacingStyle(margin, theme),
      padding: computeSpacingStyle(padding, theme),
      color: color,
    }
  }
)
