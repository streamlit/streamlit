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

import { hasLightBackgroundColor } from "~lib/theme"
import { getPrimaryFocusBoxShadow } from "~lib/theme/utils"

export const StyledChatInputContainer = styled.div({
  position: "relative",
  display: "flex",
  flexDirection: "column",
})

export interface StyledChatInputProps {
  extended?: boolean
}

export const StyledChatInput = styled.div<StyledChatInputProps>(
  ({ theme }) => ({
    // Per Figma: Widget styling with proper theme colors
    backgroundColor: theme.colors.secondaryBg, // Widget background (matches other input widgets)
    border: `${theme.sizes.borderWidth} solid`,
    borderColor: theme.colors.widgetBorderColor ?? theme.colors.transparent,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    borderRadius: theme.radii.default,
    boxSizing: "border-box",

    ":focus-within": {
      borderColor: theme.colors.primary,
    },
  })
)

export const StyledContentArea = styled.div(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm, // Gap between FilePreviewList and PrimaryRegion
}))

export const StyledPrimaryRegion = styled.div({
  position: "relative",
  display: "flex",
  flexDirection: "column",
})

export const StyledActionRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  gap: theme.spacing.sm,
}))

export const StyledLeftCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flex: "1 0 0",
  gap: theme.spacing.sm,
  alignItems: "center",
}))

export const StyledRightCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.sm,
  alignItems: "center",
  position: "relative",
}))

export const StyledInputInstructions = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.sm,
  right: theme.spacing.lg,
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.twoSm,
  textAlign: "right",
  whiteSpace: "nowrap",
  pointerEvents: "auto",
  cursor: "text",
  zIndex: theme.zIndices.priority,
  "& .stChatInputInstructions": {
    position: "static",
  },
}))

interface StyledSendIconButtonProps {
  disabled: boolean
  extended?: boolean
  hasError?: boolean
  primary?: boolean
}

export const StyledSendIconButton = styled.button<StyledSendIconButtonProps>(
  ({ theme, disabled, hasError, primary }) => {
    if (primary) {
      return {
        border: "none",
        backgroundColor: disabled
          ? theme.colors.darkenedBgMix15
          : theme.colors.primary,
        borderRadius: theme.radii.button,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: theme.lineHeights.none,
        margin: theme.spacing.none,
        padding: theme.spacing.xs,
        width: theme.sizes.minElementHeight,
        height: theme.sizes.minElementHeight,
        color: disabled ? theme.colors.fadedText40 : theme.colors.white,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 200ms ease",
        "&:focus": {
          outline: "none",
        },
        ":focus": {
          outline: "none",
        },
        "&:focus-visible": {
          boxShadow: getPrimaryFocusBoxShadow(theme),
        },
        "&:hover": {
          backgroundColor: disabled
            ? theme.colors.darkenedBgMix15
            : theme.colors.primary,
        },
      }
    }

    const lightTheme = hasLightBackgroundColor(theme)
    const [cleanIconColor, dirtyIconColor] = lightTheme
      ? [theme.colors.gray60, theme.colors.gray80]
      : [theme.colors.gray80, theme.colors.gray40]

    const getSendIconColor = (): string => {
      if (hasError) return theme.colors.redTextColor
      if (disabled) return cleanIconColor
      return dirtyIconColor
    }

    return {
      border: "none",
      backgroundColor: theme.colors.transparent,
      borderRadius: theme.radii.default,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: theme.lineHeights.none,
      margin: theme.spacing.none,
      padding: theme.spacing.none,
      color: getSendIconColor(),
      pointerEvents: "auto",
      "&:focus": {
        outline: "none",
      },
      ":focus": {
        outline: "none",
      },
      "&:focus-visible": {
        backgroundColor: lightTheme
          ? theme.colors.gray10
          : theme.colors.gray90,
        boxShadow: getPrimaryFocusBoxShadow(theme),
      },
      "&:hover": {
        color: hasError ? theme.colors.red70 : theme.colors.primary,
      },
      "&:disabled, &:disabled:hover, &:disabled:active": {
        backgroundColor: theme.colors.transparent,
        borderColor: theme.colors.transparent,
        color: theme.colors.gray60,
        cursor: "not-allowed",
      },
      "& svg": {
        width: theme.iconSizes.lg,
        height: theme.iconSizes.lg,
      },
    }
  }
)

interface StyledWaveformContainerProps {
  isRecording: boolean
}

export const StyledWaveformContainer =
  styled.div<StyledWaveformContainerProps>(({ isRecording }) => ({
    display: isRecording ? "flex" : "none",
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  }))

export const StyledChatAudioWave = styled.div(({ theme }) => ({
  position: "relative",
  width: "100%",
  minHeight: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  overflow: "hidden",
  "& > div": {
    position: "absolute",
    inset: 0,
  },
}))
