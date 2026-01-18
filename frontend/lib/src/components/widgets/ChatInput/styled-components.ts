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
import styled from "@emotion/styled"

export const StyledChatInputContainer = styled.div({
  position: "relative",
  display: "flex",
  flexDirection: "column",
})

export const StyledChatInput = styled.div(({ theme }) => ({
  backgroundColor: theme.colors.secondaryBg,
  border: `${theme.sizes.borderWidth} solid`,
  borderColor: theme.colors.widgetBorderColor ?? theme.colors.transparent,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  flex: 1,
  paddingTop: theme.spacing.md,
  paddingBottom: theme.spacing.md,
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
  gap: theme.spacing.sm,
  borderRadius: theme.radii.default,
  boxSizing: "border-box",

  ":focus-within": {
    borderColor: theme.colors.primary,
  },
}))

// Files area - wrapping container for file chips above the input row
export const StyledFilesArea = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
}))

// Main input row - contains [left cluster] [textarea/waveform] [right cluster]
// Uses flex-wrap to handle stacked mode: textarea wraps to its own line when stacked
export const StyledInputRow = styled.div<{ isStacked?: boolean }>(
  ({ theme, isStacked }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: theme.spacing.sm,
    flexWrap: isStacked ? "wrap" : "nowrap",
  })
)

// Wrapper for textarea - adapts to inline or stacked layout
// In stacked mode: order: -1 moves it above buttons, width: 100% makes it wrap to own line
// In inline mode: flex: 1 makes it fill remaining space between button clusters
export const StyledTextareaWrapper = styled.div<{ isStacked?: boolean }>(
  ({ isStacked }) => ({
    flex: isStacked ? "none" : 1,
    width: isStacked ? "100%" : "auto",
    order: isStacked ? -1 : 0,
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  })
)

// Left cluster - flex-shrink so it collapses when empty
export const StyledLeftCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flexShrink: 0,
  gap: theme.spacing.sm,
  alignItems: "center",
}))

// Right cluster - contains mic and send buttons
export const StyledRightCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.sm,
  alignItems: "center",
}))

export const StyledInputInstructions = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.twoXS,
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
        width: theme.sizes.chatInputPrimaryButtonSize,
        height: theme.sizes.chatInputPrimaryButtonSize,
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
          boxShadow: theme.shadows.focusRing,
        },
        "&:hover": {
          backgroundColor: disabled
            ? theme.colors.darkenedBgMix15
            : theme.colors.primary,
        },
      }
    }

    const getSendIconColor = (): string => {
      if (hasError) return theme.colors.redTextColor
      if (disabled) return theme.colors.fadedText40
      return theme.colors.fadedText60
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
        boxShadow: theme.shadows.focusRing,
      },
      "&:hover": {
        color: hasError ? theme.colors.redColor : theme.colors.bodyText,
      },
      "&:active": {
        color: theme.colors.primary,
      },
      "&:disabled, &:disabled:hover, &:disabled:active": {
        backgroundColor: theme.colors.transparent,
        borderColor: theme.colors.transparent,
        color: theme.colors.fadedText40,
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
  height: theme.sizes.chatInputPrimaryButtonSize,
  borderRadius: theme.radii.default,
  overflow: "hidden",
  "& > div": {
    position: "absolute",
    inset: 0,
  },
}))
