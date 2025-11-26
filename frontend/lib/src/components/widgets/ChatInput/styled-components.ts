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

export const StyledChatInputContainer = styled.div`
  border: none;
  position: relative;
  display: flex;
`

export interface StyledChatInputProps {
  extended: boolean
}

export const StyledChatInput = styled.div<StyledChatInputProps>(
  ({ theme, extended }) => ({
    border: `${theme.sizes.borderWidth} solid`,
    borderColor: theme.colors.widgetBorderColor ?? theme.colors.transparent,
    borderRadius: theme.radii.chatInput,
    backgroundColor: theme.colors.secondaryBg,
    position: "relative",
    flexGrow: 1,
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingLeft: theme.spacing.lg,
    maxHeight: extended ? "none" : theme.sizes.minElementHeight,
    gap: theme.spacing.sm,
    overflow: "hidden",

    ":focus-within": {
      borderColor: theme.colors.primary,
    },
  })
)

interface StyledSendIconButtonProps {
  disabled: boolean
  extended: boolean
  hasError?: boolean
}

export const StyledSendIconButton = styled.button<StyledSendIconButtonProps>(
  ({ theme, disabled, extended, hasError }) => {
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
      borderTopRightRadius: extended ? "0" : theme.radii.chatInput,
      borderTopLeftRadius: extended ? theme.radii.default : "0",
      borderBottomRightRadius: theme.radii.chatInput,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: theme.lineHeights.none,
      margin: theme.spacing.none,
      padding: theme.spacing.sm,
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
    }
  }
)

interface StyledSendIconButtonContainerProps {
  isRecording?: boolean
}

export const StyledSendIconButtonContainer =
  styled.div<StyledSendIconButtonContainerProps>(({ theme, isRecording }) => ({
    display: "flex",
    alignItems: isRecording ? "center" : "flex-end",
    height: "100%",
    position: isRecording ? "static" : "absolute",
    right: isRecording ? undefined : 0,
    bottom: isRecording ? undefined : 0,
    marginBottom: isRecording ? 0 : `-${theme.sizes.borderWidth}`,
    pointerEvents: "none",
    gap: 0,
    paddingRight: isRecording ? theme.spacing.sm : 0,
  }))

interface StyledInputInstructionsContainerProps {
  acceptAudio?: boolean
}

export const StyledInputInstructionsContainer =
  styled.div<StyledInputInstructionsContainerProps>(
    ({ theme, acceptAudio }) => ({
      position: "absolute",
      bottom: "0px",
      // Calculate the right padding to account for button(s) on the right
      // Each button is: iconSizes.xl + 2 * spacing.sm
      // When acceptAudio is true, there are 2 buttons (mic + send) with extra margin
      right: acceptAudio
        ? `calc(2 * (${theme.iconSizes.xl} + 2 * ${theme.spacing.sm}) + 2 * ${theme.spacing.sm})`
        : `calc(${theme.iconSizes.xl} + 2 * ${theme.spacing.sm} + ${theme.spacing.sm})`,
    })
  )

interface StyledWaveformContainerProps {
  isRecording: boolean
}

export const StyledWaveformContainer =
  styled.div<StyledWaveformContainerProps>(({ isRecording }) => ({
    display: isRecording ? "flex" : "none",
    flex: isRecording ? 1 : undefined,
    alignItems: "center",
    minWidth: 0, // Allow flex item to shrink below content size if needed
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
