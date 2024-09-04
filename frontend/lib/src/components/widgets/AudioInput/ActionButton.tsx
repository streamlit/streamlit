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
import RecordPlugin from "wavesurfer.js/dist/plugins/record"
import WaveSurfer from "wavesurfer.js"

import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import Icon from "@streamlit/lib/src/components/shared/Icon"

interface ActionButtonProps {
  recordPlugin: RecordPlugin | null
  recordingUrl: string | null
  wavesurfer: WaveSurfer | null
  hasNoMicPermissions: boolean
  startRecording(): void
  stopRecording(): void
  onClickPlayPause(): void
}

const ActionButton: React.FC<ActionButtonProps> = ({
  recordPlugin,
  recordingUrl,
  wavesurfer,
  hasNoMicPermissions,
  startRecording,
  stopRecording,
  onClickPlayPause,
}) => {
  const theme = useTheme()

  if (recordPlugin && recordPlugin.isRecording()) {
    // It's currently recording, so show the stop recording button
    return (
      <BaseButton
        kind={BaseButtonKind.BORDERLESS_ICON}
        onClick={stopRecording}
        data-testid="stAudioInputStopRecordingButton"
      >
        <Icon content={StopCircle} size="lg" color={theme.colors.primary} />
      </BaseButton>
    )
  } else if (recordingUrl) {
    if (wavesurfer && wavesurfer.isPlaying()) {
      // It's playing, so show the pause button
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={onClickPlayPause}
          data-testid="stAudioInputPauseButton"
        >
          <Icon content={Pause} size="lg" color={theme.colors.fadedText60} />
        </BaseButton>
      )
    }
    // It's paused, so show the play button
    return (
      <BaseButton
        kind={BaseButtonKind.BORDERLESS_ICON}
        onClick={onClickPlayPause}
        data-testid="stAudioInputPlayButton"
      >
        <Icon content={PlayArrow} size="lg" color={theme.colors.fadedText60} />
      </BaseButton>
    )
  }
  // Press the button to record
  return (
    <BaseButton
      kind={BaseButtonKind.BORDERLESS_ICON}
      onClick={startRecording}
      disabled={hasNoMicPermissions}
      data-testid="stAudioInputRecordButton"
    >
      <Icon
        content={Mic}
        size="lg"
        color={
          hasNoMicPermissions
            ? theme.colors.fadedText40
            : theme.colors.fadedText60
        }
      />
    </BaseButton>
  )
}

export default ActionButton
