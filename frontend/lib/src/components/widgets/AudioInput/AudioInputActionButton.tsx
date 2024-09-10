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

import React from "react"

import { useTheme } from "@emotion/react"
import { Mic } from "@emotion-icons/material-outlined"
import { Pause, PlayArrow, StopCircle } from "@emotion-icons/material-rounded"
import { EmotionIcon } from "@emotion-icons/emotion-icon"

import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import {
  StyledActionButtonPauseDiv,
  StyledActionButtonPlayDiv,
  StyledActionButtonStartRecordingDiv,
  StyledActionButtonStopRecordingDiv,
} from "./styled-components"

interface BaseActionButtonProps {
  onClick: () => void
  disabled: boolean
  ariaLabel: string
  iconContent: EmotionIcon
}

const ActionButton: React.FC<BaseActionButtonProps> = ({
  onClick,
  disabled,
  ariaLabel,
  iconContent,
}) => (
  <BaseButton
    kind={BaseButtonKind.BORDERLESS_ICON}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    data-testid="stAudioInputActionButton"
  >
    <Icon content={iconContent} size="lg" color="inherit" />
  </BaseButton>
)

interface AudioInputActionButtonProps {
  disabled: boolean
  isRecording: boolean
  isPlaying: boolean
  recordingUrlExists: boolean
  startRecording(): void
  stopRecording(): void
  onClickPlayPause(): void
}

const AudioInputActionButton: React.FC<AudioInputActionButtonProps> = ({
  disabled,
  isRecording,
  isPlaying,
  recordingUrlExists,
  startRecording,
  stopRecording,
  onClickPlayPause,
}) => {
  const theme = useTheme()

  if (isRecording) {
    // It's currently recording, so show the stop recording button
    return (
      <StyledActionButtonStopRecordingDiv>
        <ActionButton
          onClick={stopRecording}
          disabled={disabled}
          ariaLabel="Stop recording"
          iconContent={StopCircle}
        />
      </StyledActionButtonStopRecordingDiv>
    )
  } else if (recordingUrlExists) {
    if (isPlaying) {
      // It's playing, so show the pause button
      return (
        <StyledActionButtonPauseDiv>
          <ActionButton
            onClick={onClickPlayPause}
            disabled={disabled}
            ariaLabel="Pause"
            iconContent={Pause}
          />
        </StyledActionButtonPauseDiv>
      )
    }
    // It's paused, so show the play button
    return (
      <StyledActionButtonPlayDiv>
        <ActionButton
          onClick={onClickPlayPause}
          disabled={disabled}
          ariaLabel="Play"
          iconContent={PlayArrow}
        />
      </StyledActionButtonPlayDiv>
    )
  }
  // Press the button to record
  return (
    <StyledActionButtonStartRecordingDiv>
      <ActionButton
        onClick={startRecording}
        disabled={disabled}
        ariaLabel="Record"
        iconContent={Mic}
      />
    </StyledActionButtonStartRecordingDiv>
  )
}

export default AudioInputActionButton
