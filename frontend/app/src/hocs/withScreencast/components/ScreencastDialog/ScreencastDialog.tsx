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

import React, { ChangeEvent, useCallback, useState } from "react"

import {
  BaseButtonKind,
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  StreamlitMarkdown,
} from "@streamlit/lib"

import { StyledInstruction, StyledRecordAudioLabel } from "./styled-components"

export interface Props {
  /** Callback to close the dialog */
  onClose: () => void
  toggleRecordAudio: () => void
  recordAudio: boolean
  startRecording: () => void
}

const ScreencastDialog: React.FC<Props> = ({
  onClose,
  toggleRecordAudio,
  recordAudio: initialRecordAudio,
  startRecording,
}) => {
  const [recordAudio, setRecordAudio] = useState(initialRecordAudio)

  const handleRecordAudioCheckbox = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const { checked } = e.target
      if (checked !== recordAudio) {
        setRecordAudio(checked)
        toggleRecordAudio()
      }
    },
    [recordAudio, toggleRecordAudio]
  )

  const handleStartButton = useCallback((): void => {
    startRecording()
    onClose()
  }, [startRecording, onClose])

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader>Record a screencast</ModalHeader>
      <ModalBody>
        <p>
          This will record a video with the contents of your screen, so you can
          easily share what you're seeing with others.
        </p>
        <p>
          <StyledRecordAudioLabel data-testid="stScreencastAudioCheckbox">
            <input
              type="checkbox"
              name="recordAudio"
              checked={recordAudio}
              onChange={handleRecordAudioCheckbox}
            />{" "}
            Also record audio
          </StyledRecordAudioLabel>
        </p>
        <StyledInstruction data-testid="stScreencastInstruction">
          <StreamlitMarkdown
            source="Press `Esc` any time to stop recording."
            allowHTML={false}
          />
        </StyledInstruction>
      </ModalBody>
      <ModalFooter>
        <ModalButton
          kind={BaseButtonKind.SECONDARY}
          onClick={handleStartButton}
        >
          Start recording!
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

export default ScreencastDialog
