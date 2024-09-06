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

export interface BaseActionButtonProps {
  onClick: () => void
  disabled: boolean
  ariaLabel: string
  iconContent: EmotionIcon
  color?: string
}

export const ActionButton: React.FC<BaseActionButtonProps> = ({
  onClick,
  disabled,
  ariaLabel,
  iconContent,
  color,
}) => (
  <BaseButton
    kind={BaseButtonKind.BORDERLESS_ICON}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    <Icon content={iconContent} size="lg" color={color} />
  </BaseButton>
)

export interface AudioInputActionButtonProps {
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
      <ActionButton
        onClick={stopRecording}
        disabled={disabled}
        ariaLabel="Stop recording"
        iconContent={StopCircle}
        color={theme.colors.primary}
      />
    )
  } else if (recordingUrlExists) {
    if (isPlaying) {
      // It's playing, so show the pause button
      return (
        <ActionButton
          onClick={onClickPlayPause}
          disabled={disabled}
          ariaLabel="Pause"
          iconContent={Pause}
          color={theme.colors.fadedText60}
        />
      )
    }
    // It's paused, so show the play button
    return (
      <ActionButton
        onClick={onClickPlayPause}
        disabled={disabled}
        ariaLabel="Play"
        iconContent={PlayArrow}
        color={theme.colors.fadedText60}
      />
    )
  }
  // Press the button to record
  return (
    <ActionButton
      onClick={startRecording}
      disabled={disabled}
      ariaLabel="Record"
      iconContent={Mic}
      color={disabled ? theme.colors.fadedText40 : theme.colors.fadedText60}
    />
  )
}

export default AudioInputActionButton
