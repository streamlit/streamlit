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

import { TOTAL_HEIGHT, WAVEFORM_HEIGHT } from "./constants"

export const StyledAudioInputContainerDiv = styled.div(() => ({
  height: TOTAL_HEIGHT,
}))

export const StyledWaveformContainerDiv = styled.div(({ theme }) => ({
  height: WAVEFORM_HEIGHT,
  width: "100%",
  background: theme.genericColors.secondaryBg,
  borderRadius: 8,
  marginBottom: 2,
  display: "flex",
  alignItems: "center",
  position: "relative",
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
  margin: 8,
  fontFamily: "Source Code Pro, monospace",
  color: isPlayingOrRecording
    ? theme.genericColors.bodyText
    : theme.colors.fadedText60,
  backgroundColor: theme.genericColors.secondaryBg,
  fontSize: 14,
}))

// NoMicPermissions
export const StyledNoMicInputContainerDiv = styled.div(() => ({
  width: "100%",
  textAlign: "center",
}))

export const StyledNoMicPermissionsErrorTextSpan = styled.span()

export const StyledNoMicInputLearnMoreLink = styled.a()

// Placeholder
export const StyledPlaceholderContainerDiv = styled.div(() => ({
  height: WAVEFORM_HEIGHT,
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
