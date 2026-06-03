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

export const StyledChatInputContainer = styled.div<{
  isStretchHeight?: boolean
}>(({ isStretchHeight }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  ...(isStretchHeight && { height: "100%" }),
}))

export const StyledChatInput = styled.div<{ isStretchHeight?: boolean }>(
  ({ theme, isStretchHeight }) => ({
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
    ...(isStretchHeight && { height: "100%" }),

    ":focus-within": {
      borderColor: theme.colors.primary,
    },
  })
)

// Files area - wrapping container for file chips above the input row
export const StyledFilesArea = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
}))

// Main input row - contains textarea and toolbar
// When expanded: column layout with textarea above toolbar
// When not expanded: row layout (inline or stacked via flex-wrap)
export const StyledInputRow = styled.div<{
  isStacked?: boolean
  hasExpandedHeight?: boolean
}>(({ theme, isStacked, hasExpandedHeight }) => ({
  display: "flex",
  // Column layout when expanded, row layout otherwise
  flexDirection: hasExpandedHeight ? "column" : "row",
  alignItems: hasExpandedHeight ? "stretch" : "center",
  justifyContent: hasExpandedHeight ? "flex-start" : "space-between",
  width: "100%",
  gap: theme.spacing.sm,
  // Only use flex-wrap for stacked mode (non-expanded)
  flexWrap: !hasExpandedHeight && isStacked ? "wrap" : "nowrap",
  ...(hasExpandedHeight && { flex: 1 }),
}))

// Wrapper for textarea - adapts to inline, stacked, or expanded layout
// In stacked mode: order: -1 moves it above buttons, width: 100% makes it wrap to own line
// In inline mode: flex: 1 makes it fill remaining space between button clusters
// In expanded height mode: flex: 1 fills vertical space, width: 100% for full width
export const StyledTextareaWrapper = styled.div<{
  isStacked?: boolean
  hasExpandedHeight?: boolean
}>(({ isStacked, hasExpandedHeight }) => ({
  flex: isStacked && !hasExpandedHeight ? "none" : 1,
  width: isStacked || hasExpandedHeight ? "100%" : "auto",
  // Use order only for stacked mode (non-expanded) to move textarea above buttons
  order: isStacked && !hasExpandedHeight ? -1 : 0,
  display: "flex",
  alignItems: hasExpandedHeight ? "stretch" : "center",
  minWidth: 0,
}))

// Left cluster - flex-shrink so it collapses when empty
// In non-expanded row mode, use order: -1 to position before textarea (which is first in DOM)
export const StyledLeftCluster = styled.div<{
  hasExpandedHeight?: boolean
}>(({ theme, hasExpandedHeight }) => ({
  display: "flex",
  flexDirection: "row",
  flexShrink: 0,
  gap: theme.spacing.sm,
  alignItems: "center",
  // In non-expanded mode, position before textarea via CSS order
  order: hasExpandedHeight ? 0 : -1,
}))

// Right cluster - contains mic and send buttons
export const StyledRightCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.sm,
  alignItems: "center",
}))

// Toolbar row - contains left and right button clusters
// Used when hasExpandedHeight is true to keep buttons in a dedicated bottom row
export const StyledToolbarRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  gap: theme.spacing.sm,
}))

// Character count indicator - displayed inline with buttons
export const StyledInputInstructions = styled.div(({ theme }) => ({
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.twoSm,
  textAlign: "right",
  whiteSpace: "nowrap",
  pointerEvents: "auto",
  cursor: "text",
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

export const StyledChatInputTextArea = styled.textarea<{
  $height: string
  $maxHeight: string
  $minHeight: string
}>(({ theme, $height, $maxHeight, $minHeight }) => ({
  fontWeight: theme.fontWeights.normal,
  lineHeight: theme.lineHeights.inputWidget,
  height: $height,
  maxHeight: $maxHeight,
  minHeight: $minHeight,
  overflowY: "auto",
  padding: `${theme.spacing.twoXS} 0`,
  width: "100%",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontFamily: "inherit",
  fontSize: theme.fontSizes.sm,
  color: "inherit",
  boxSizing: "border-box",
  resize: "none",
  display: "block",
  "&::placeholder": { color: theme.colors.fadedText60 },
  "&:disabled": {
    color: theme.colors.fadedText40,
    WebkitTextFillColor: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))
