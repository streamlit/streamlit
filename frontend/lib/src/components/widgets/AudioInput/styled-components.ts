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

export const StyledAudioInputContainerDiv = styled.div()

export const StyledWaveformContainerDiv = styled.div(({ theme }) => ({
  height: theme.sizes.largestElementHeight,
  width: "100%",
  background: theme.genericColors.secondaryBg,
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
    ? theme.genericColors.bodyText
    : theme.colors.fadedText60,
  backgroundColor: theme.genericColors.secondaryBg,
  fontSize: theme.fontSizes.sm,
}))

// NoMicPermissions
export const StyledNoMicInputContainerDiv = styled.div(() => ({
  width: "100%",
  textAlign: "center",
  overflow: "hidden",
}))

export const StyledNoMicPermissionsErrorTextSpan = styled.span()

export const StyledNoMicInputLearnMoreLink = styled.a()

// Placeholder
export const StyledPlaceholderContainerDiv = styled.div(({ theme }) => ({
  height: theme.sizes.largestElementHeight,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledPlaceholderDotsDiv = styled.div(({ theme }) => ({
  height: 10,
  opacity: 0.2,
  width: "100%",
  backgroundImage: `radial-gradient(${theme.colors.fadedText10} 40%, transparent 40%)`,
  backgroundSize: "10px 10px",
  backgroundRepeat: "repeat",
}))

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
