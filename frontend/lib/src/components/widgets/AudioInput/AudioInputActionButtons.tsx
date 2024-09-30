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

import React, { memo } from "react"

import { Mic } from "@emotion-icons/material-outlined"
import {
  Pause,
  PlayArrow,
  Refresh,
  StopCircle,
} from "@emotion-icons/material-rounded"
import { EmotionIcon } from "@emotion-icons/emotion-icon"

import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import Icon from "@streamlit/lib/src/components/shared/Icon"

import {
  StyledActionButtonContainerDiv,
  StyledActionButtonPlayPauseDiv,
  StyledActionButtonStartRecordingDiv,
  StyledActionButtonStopRecordingDiv,
  StyledSpinner,
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
    fluidWidth
    data-testid="stAudioInputActionButton"
  >
    <Icon content={iconContent} size="lg" color="inherit" />
  </BaseButton>
)

export interface AudioInputActionButtonProps {
  disabled: boolean
  isRecording: boolean
  isPlaying: boolean
  isUploading: boolean
  isError: boolean
  recordingUrlExists: boolean
  startRecording(): void
  stopRecording(): void
  onClickPlayPause(): void
  onClear(): void
}

interface AudioInputStopRecordingButtonProps {
  disabled: boolean
  stopRecording(): void
}

interface AudioInputPlayPauseButtonProps {
  disabled: boolean
  isPlaying: boolean
  onClickPlayPause(): void
}

interface AudioInputStartRecordingButtonProps {
  disabled: boolean
  startRecording(): void
}

interface AudioInputResetButtonProps {
  onClick(): void
}

export const AudioInputStopRecordingButton: React.FC<
  AudioInputStopRecordingButtonProps
> = ({ disabled, stopRecording }) => (
  <StyledActionButtonStopRecordingDiv>
    <ActionButton
      onClick={stopRecording}
      disabled={disabled}
      ariaLabel="Stop recording"
      iconContent={StopCircle}
    />
  </StyledActionButtonStopRecordingDiv>
)

export const AudioInputPlayPauseButton: React.FC<
  AudioInputPlayPauseButtonProps
> = ({ disabled, isPlaying, onClickPlayPause }) => {
  return (
    <StyledActionButtonPlayPauseDiv>
      {isPlaying ? (
        <ActionButton
          onClick={onClickPlayPause}
          disabled={disabled}
          ariaLabel="Pause"
          iconContent={Pause}
        />
      ) : (
        <ActionButton
          onClick={onClickPlayPause}
          disabled={disabled}
          ariaLabel="Play"
          iconContent={PlayArrow}
        />
      )}
    </StyledActionButtonPlayPauseDiv>
  )
}

export const AudioInputStartRecordingButton: React.FC<
  AudioInputStartRecordingButtonProps
> = ({ disabled, startRecording }) => (
  <StyledActionButtonStartRecordingDiv>
    <ActionButton
      onClick={startRecording}
      disabled={disabled}
      ariaLabel="Record"
      iconContent={Mic}
    />
  </StyledActionButtonStartRecordingDiv>
)

export const AudioInputResetButton: React.FC<AudioInputResetButtonProps> = ({
  onClick,
}) => (
  <StyledActionButtonPlayPauseDiv>
    <ActionButton
      disabled={false}
      onClick={onClick}
      ariaLabel="Reset"
      iconContent={Refresh}
    />
  </StyledActionButtonPlayPauseDiv>
)

const AudioInputActionButtons: React.FC<AudioInputActionButtonProps> = ({
  disabled,
  isRecording,
  isPlaying,
  isUploading,
  isError,
  recordingUrlExists,
  startRecording,
  stopRecording,
  onClickPlayPause,
  onClear,
}) => {
  if (isError) {
    return (
      <StyledActionButtonContainerDiv>
        <AudioInputResetButton onClick={onClear} />
      </StyledActionButtonContainerDiv>
    )
  }

  if (isUploading) {
    return (
      <StyledActionButtonContainerDiv>
        <StyledSpinner aria-label="Uploading" />
      </StyledActionButtonContainerDiv>
    )
  }

  return (
    <StyledActionButtonContainerDiv>
      {isRecording ? (
        <AudioInputStopRecordingButton
          disabled={disabled}
          stopRecording={stopRecording}
        />
      ) : (
        <AudioInputStartRecordingButton
          disabled={disabled}
          startRecording={startRecording}
        />
      )}
      {recordingUrlExists && (
        <AudioInputPlayPauseButton
          disabled={disabled}
          isPlaying={isPlaying}
          onClickPlayPause={onClickPlayPause}
        />
      )}
    </StyledActionButtonContainerDiv>
  )
}

export default memo(AudioInputActionButtons)
