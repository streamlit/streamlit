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
import { keyframes } from "@emotion/react"
import { Keyframes } from "@emotion/serialize"
import { EmotionTheme } from "src/lib/theme"
import { transparentize } from "color2k"

const recordingIndicatorPulse = (theme: EmotionTheme): Keyframes => keyframes`
0% {
  box-shadow: 0 0 ${theme.spacing.twoXS} ${theme.colors.red};
}
50% {
  box-shadow: 0 0 ${theme.spacing.sm} ${theme.spacing.twoXS} ${theme.colors.red};
}
100% {
  box-shadow: 0 0 ${theme.spacing.twoXS} ${theme.colors.red};
}`

export const StyledRecordingIndicator = styled.div(({ theme }) => ({
  position: "absolute",
  bottom: theme.spacing.lg,
  right: theme.spacing.sm,
  width: theme.spacing.sm,
  height: theme.spacing.sm,
  backgroundColor: "red",
  borderRadius: theme.radii.full,
  boxShadow: `0 0 ${theme.spacing.twoXS} ${theme.colors.red}`,
  animation: `${recordingIndicatorPulse(theme)} 2s linear infinite`,
}))

export const StyledMenuDivider = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.colors.fadedText10}`,
  margin: `${theme.spacing.sm} ${theme.spacing.none}`,
}))

export interface ItemProps {
  isDisabled: boolean
  isRecording: boolean
}

export interface ItemStyleProps {
  isHighlighted: boolean
  styleProps?: React.CSSProperties
}

export const StyledMenuItemShortcut = styled.span<ItemProps>(
  ({ isRecording, theme }) => {
    return {
      color: isRecording ? theme.colors.red : theme.colors.fadedText60,
      fontSize: theme.fontSizes.sm,
      marginTop: theme.spacing.twoXS,
      fontVariant: "small-caps",
      textTransform: "uppercase",
    }
  }
)

export const StyledMenuItem = styled.ul<ItemProps>(
  ({ isDisabled, isRecording, theme }) => {
    const disabledStyles = isDisabled
      ? {
          backgroundColor: theme.colors.transparent,
          color: theme.colors.fadedText60,
          cursor: "not-allowed",
        }
      : {
          "&:active": {
            backgroundColor: theme.colors.primary,
            color: theme.colors.white,
            outline: "none",
            [StyledMenuItemShortcut as any]: {
              color: theme.colors.white,
            },
          },
          "&:focus": {
            backgroundColor: theme.colors.primary,
            color: theme.colors.white,
          },
        }

    const recordingStyles = isRecording && {
      color: theme.colors.red,
      fontWeight: theme.fontWeights.bold,
    }

    return {
      display: "block",
      flexDirection: "row",
      alignItems: "flex-start",
      cursor: "pointer",
      ...(recordingStyles || {}),
      ...disabledStyles,
      "@media print": {
        display: "none !important",
      },
    }
  }
)

export const StyledCoreItem = styled.li<ItemStyleProps>(
  ({ isHighlighted, styleProps, theme }) => {
    const highlightedStyles = isHighlighted && {
      "&:hover": {
        backgroundColor: theme.colors.secondaryBg,
      },
    }

    const margin = styleProps?.margin || 0
    const padding =
      styleProps?.padding || `${theme.spacing.twoXS} ${theme.spacing.twoXL}`
    const backgroundColor =
      styleProps?.backgroundColor || theme.colors.primaryBg
    const fontSize = styleProps?.fontSize || theme.fontSizes.md

    return {
      margin,
      padding,
      backgroundColor,
      fontSize,
      ...(highlightedStyles || {}),
      display: "block",
    }
  }
)

export const StyledDevItem = styled.li<ItemStyleProps>(
  ({ isHighlighted, styleProps, theme }) => {
    const highlightedStyles = isHighlighted && {
      "&:hover": {
        // Whatever color we use here as the hover state, we want to transparentize it
        // to its full extend, so you can see the underlying color of the menu.
        backgroundColor: transparentize(theme.colors.secondaryBg, 1),
      },
    }
    const margin = styleProps?.margin || 0
    const padding =
      styleProps?.padding || `${theme.spacing.twoXS} ${theme.spacing.twoXL}`
    const backgroundColor =
      styleProps?.backgroundColor || theme.colors.secondaryBg
    const fontSize = styleProps?.fontSize || theme.fontSizes.md
    return {
      margin,
      padding,
      backgroundColor,
      fontSize,
      ...(highlightedStyles || {}),
      display: "block",
    }
  }
)

export const StyledMenuItemLabel = styled.span(({ theme }) => ({
  marginRight: theme.spacing.md,
  flexGrow: 1,
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
}))

export const StyledUl = styled.ul(() => ({
  borderBottom: "$1px solid rgba(38, 39, 48, 0.2)",
  borderTop: "$1px solid rgba(38, 39, 48, 0.2)",
  margin: "-.20rem 0 -.5rem 0",
}))
