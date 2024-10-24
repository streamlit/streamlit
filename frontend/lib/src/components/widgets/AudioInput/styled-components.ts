/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import { Spinner } from "baseui/spinner"

export const StyledAudioInputContainerDiv = styled.div()

export const StyledWaveformContainerDiv = styled.div(({ theme }) => ({
  height: theme.sizes.largestElementHeight,
  width: "100%",
  background: theme.colors.secondaryBg,
  borderRadius: theme.radii.default,
  marginBottom: theme.spacing.twoXS,
  display: "flex",
  alignItems: "center",
  position: "relative",
  paddingLeft: theme.spacing.xs,
  paddingRight: theme.spacing.sm,
}))

export const StyledWaveformInnerDiv = styled.div({
  flex: 1,
})

export const StyledWaveSurferDiv = styled.div<{ show: boolean }>(
  ({ show }) => ({
    display: show ? "block" : "none",
  })
)

export const StyledWaveformTimeCode = styled.span<{
  isPlayingOrRecording: boolean
}>(({ theme, isPlayingOrRecording }) => ({
  margin: theme.spacing.sm,
  fontFamily: theme.fonts.monospace,
  color: isPlayingOrRecording
    ? theme.colors.bodyText
    : theme.colors.fadedText60,
  backgroundColor: theme.colors.secondaryBg,
  fontSize: theme.fontSizes.sm,
}))

export const StyledErrorContainerDiv = styled.div({
  width: "100%",
  textAlign: "center",
  overflow: "hidden",
})

export const StyledErrorTextSpan = styled.span(({ theme }) => ({
  color: theme.colors.bodyText,
}))

export const StyledNoMicInputLearnMoreLink = styled.a(({ theme }) => ({
  color: theme.colors.linkText,
  textDecoration: "underline",
}))

// Placeholder
export const StyledPlaceholderContainerDiv = styled.div(({ theme }) => ({
  height: theme.sizes.largestElementHeight,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledPlaceholderDotsDiv = styled.div(({ theme }) => {
  const dotSize = "0.625em"
  return {
    opacity: 0.2,
    width: "100%",
    height: dotSize,
    backgroundSize: dotSize,
    backgroundImage: `radial-gradient(${theme.colors.fadedText10} 40%, transparent 40%)`,
    backgroundRepeat: "repeat",
  }
})

export const StyledActionButtonStopRecordingDiv = styled.span(({ theme }) => ({
  "& > button": {
    color: theme.colors.primary,
    padding: theme.spacing.threeXS,
  },
  "& > button:hover, & > button:focus": {
    color: theme.colors.red,
  },
}))

export const StyledActionButtonStartRecordingDiv = styled.span(
  ({ theme }) => ({
    "& > button": {
      padding: theme.spacing.threeXS,
      color: theme.colors.fadedText40,
    },
    "& > button:hover, & > button:focus": {
      color: theme.colors.primary,
    },
  })
)

export const StyledActionButtonPlayPauseDiv = styled.span(({ theme }) => ({
  "& > button": {
    padding: theme.spacing.threeXS,
    color: theme.colors.fadedText60,
  },
  "& > button:hover, & > button:focus": {
    color: theme.colors.bodyText,
  },
}))

export const StyledActionButtonContainerDiv = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexGrow: 0,
  flexShrink: 1,
  padding: theme.spacing.xs,
  gap: theme.spacing.twoXS,
  marginRight: theme.spacing.twoXS,
}))

export const StyledWidgetLabelHelp = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.sm,
}))

export const StyledSpinner = styled(Spinner)(({ theme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    width: theme.sizes.spinnerSize,
    height: theme.sizes.spinnerSize,
    borderWidth: theme.sizes.spinnerThickness,
    radius: theme.radii.md,
    justifyContents: "center",
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    borderColor: theme.colors.borderColor,
    borderTopColor: theme.colors.primary,
    flexGrow: 0,
    flexShrink: 0,
  }
})
