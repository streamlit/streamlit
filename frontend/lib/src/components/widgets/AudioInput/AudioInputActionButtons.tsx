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

import { memo } from "react"

import type { EmotionIcon } from "@emotion-icons/emotion-icon"
import { Mic } from "@emotion-icons/material-outlined"
import {
  Pause,
  PlayArrow,
  Refresh,
  StopCircle,
} from "@emotion-icons/material-rounded"

import {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"

import {
  StyledActionButtonContainerDiv,
  StyledSecondaryIconActionButton,
  StyledStopRecordingActionButton,
} from "./styled-components"

interface BaseActionButtonProps {
  onClick: () => void
  disabled: boolean
  ariaLabel: string
  iconContent: EmotionIcon
}

const SecondaryIconActionButton: React.FC<BaseActionButtonProps> = ({
  onClick,
  disabled,
  ariaLabel,
  iconContent,
}) => (
  <StyledSecondaryIconActionButton
    kind={BaseButtonKind.BORDERLESS_ICON}
    size={BaseButtonSize.MEDIUM}
    onClick={onClick}
    disabled={disabled}
    containerWidth
    autoFocus={false}
    aria-label={ariaLabel}
    data-testid="stAudioInputActionButton"
  >
    <Icon content={iconContent} size="base" color="inherit" />
  </StyledSecondaryIconActionButton>
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

const AudioInputStopRecordingButton: React.FC<
  AudioInputStopRecordingButtonProps
> = ({ disabled, stopRecording }) => (
  <StyledStopRecordingActionButton
    kind={BaseButtonKind.BORDERLESS_ICON}
    size={BaseButtonSize.MEDIUM}
    onClick={stopRecording}
    disabled={disabled}
    containerWidth
    autoFocus={false}
    aria-label="Stop recording"
    data-testid="stAudioInputActionButton"
  >
    <Icon content={StopCircle} size="base" color="inherit" />
  </StyledStopRecordingActionButton>
)

const AudioInputPlayPauseButton: React.FC<AudioInputPlayPauseButtonProps> = ({
  disabled,
  isPlaying,
  onClickPlayPause,
}) => {
  return isPlaying ? (
    <SecondaryIconActionButton
      onClick={onClickPlayPause}
      disabled={disabled}
      ariaLabel="Pause"
      iconContent={Pause}
    />
  ) : (
    <SecondaryIconActionButton
      onClick={onClickPlayPause}
      disabled={disabled}
      ariaLabel="Play"
      iconContent={PlayArrow}
    />
  )
}

const AudioInputStartRecordingButton: React.FC<
  AudioInputStartRecordingButtonProps
> = ({ disabled, startRecording }) => (
  <SecondaryIconActionButton
    onClick={startRecording}
    disabled={disabled}
    ariaLabel="Record"
    iconContent={Mic}
  />
)

const AudioInputResetButton: React.FC<AudioInputResetButtonProps> = ({
  onClick,
}) => (
  <SecondaryIconActionButton
    disabled={false}
    onClick={onClick}
    ariaLabel="Reset"
    iconContent={Refresh}
  />
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
        <DynamicIcon size="base" iconValue="spinner" />
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
