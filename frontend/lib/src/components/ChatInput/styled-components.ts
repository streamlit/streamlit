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

export const StyledChatComposer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.md,
  width: "100%",
}))

export const StyledComposerRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: theme.spacing.sm,
}))

export const StyledComposerInput = styled.textarea(({ theme }) => ({
  flex: 1,
  minHeight: theme.sizes.minElementHeight,
  maxHeight: `calc(${theme.sizes.minElementHeight} * 4)`,
  resize: "vertical",
  padding: theme.spacing.md,
  borderRadius: theme.radii.chatInput,
  border: `${theme.sizes.borderWidth} solid ${
    theme.colors.widgetBorderColor ?? theme.colors.borderColor
  }`,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  font: "inherit",
  lineHeight: theme.lineHeights.inputWidget,
  transition:
    "border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease",
  "::placeholder": {
    color: theme.colors.fadedText60,
  },
  ":disabled": {
    cursor: "not-allowed",
    backgroundColor: theme.colors.fadedText10,
    color: theme.colors.fadedText40,
  },
  ":focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    outlineOffset: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.bgColor,
  },
}))

export const StyledComposerActions = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
}))

type ComposerButtonVariant = "default" | "primary"

export const StyledComposerButton = styled.button<{
  variant?: ComposerButtonVariant
}>(({ theme, variant = "default" }) => ({
  width: theme.sizes.minElementHeight,
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.full,
  border: `${theme.sizes.borderWidth} solid ${
    variant === "primary" ? theme.colors.primary : theme.colors.borderColor
  }`,
  backgroundColor:
    variant === "primary" ? theme.colors.primary : theme.colors.bgColor,
  color: variant === "primary" ? theme.colors.white : theme.colors.bodyText,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background-color 0.2s ease, border-color 0.2s ease",
  padding: theme.spacing.none,
  ":hover": {
    borderColor: theme.colors.primary,
  },
  ":focus": {
    outline: "none",
  },
  ":focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    outlineOffset: 2,
  },
  ":disabled": {
    cursor: "not-allowed",
    opacity: 0.5,
  },
}))

export const StyledHiddenFileInput = styled.input({
  display: "none",
})

export const StyledChatAudioContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
  padding: theme.spacing.md,
  borderRadius: theme.radii.xl,
  backgroundColor: theme.colors.secondaryBg,
  border: theme.colors.widgetBorderColor
    ? `${theme.sizes.borderWidth} solid ${theme.colors.widgetBorderColor}`
    : `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
}))

export const StyledChatAudioWave = styled.div(({ theme }) => ({
  position: "relative",
  minHeight: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  overflow: "hidden",
  "& > div": {
    position: "absolute",
    inset: 0,
  },
}))

export const StyledChatAudioControls = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: theme.spacing.sm,
}))

type RecorderButtonVariant = "cancel" | "approve"

export const StyledChatAudioButton = styled.button<{
  variant: RecorderButtonVariant
}>(({ theme, variant }) => ({
  minWidth: "6rem",
  minHeight: theme.sizes.smallElementHeight,
  borderRadius: theme.radii.full,
  border: `${theme.sizes.borderWidth} solid ${
    variant === "approve" ? theme.colors.primary : theme.colors.borderColor
  }`,
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  fontWeight: theme.fontWeights.bold,
  backgroundColor:
    variant === "approve" ? theme.colors.primary : theme.colors.bgColor,
  color: variant === "approve" ? theme.colors.white : theme.colors.bodyText,
  cursor: "pointer",
  transition: "background-color 0.2s ease, border-color 0.2s ease",
  ":hover": {
    borderColor: theme.colors.primary,
  },
  ":focus": {
    outline: "none",
  },
  ":focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    outlineOffset: 2,
  },
  ":disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
}))
