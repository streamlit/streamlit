/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ChangeEvent, PureComponent, ReactNode } from "react"
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "reactstrap"

export interface Props {
  /** Callback to close the dialog */
  onClose: () => void

  toggleRecordAudio: () => void

  recordAudio: boolean

  startRecording: () => void
}

interface State {
  recordAudio: boolean
}

/**
 * A dialog that allows a screencast to be configured and recorded.
 */
class ScreencastDialog extends PureComponent<Props, State> {
  state = {
    recordAudio: this.props.recordAudio,
  }

  handleRecordAudioCheckbox = (e: ChangeEvent<HTMLInputElement>): void => {
    const { checked } = e.target
    const { recordAudio } = this.state
    const { toggleRecordAudio } = this.props

    if (checked !== recordAudio) {
      this.setState({ recordAudio: checked }, toggleRecordAudio)
    }
  }

  handleStartButton = (): void => {
    const { startRecording, onClose } = this.props

    startRecording()
    onClose()
  }

  public render = (): ReactNode => {
    const { recordAudio } = this.state
    const { onClose } = this.props

    return (
      <Modal isOpen={true} toggle={onClose} className="streamlit-dialog">
        <ModalHeader toggle={onClose}>Record a screencast</ModalHeader>
        <ModalBody>
          <p>
            This will record a video with the contents of your screen, so you
            can easily share what you're seeing with others.
          </p>
          <p>
            <label style={{ margin: 0 }}>
              <input
                type="checkbox"
                name="recordAudio"
                checked={recordAudio}
                onChange={this.handleRecordAudioCheckbox}
              />{" "}
              Also record audio
            </label>
          </p>
          <p style={{ margin: 0 }}>
            Press <kbd>Esc</kbd> any time to stop recording.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button outline color="primary" onClick={this.handleStartButton}>
            Start recording!
          </Button>
        </ModalFooter>
      </Modal>
    )
  }
}

export default ScreencastDialog
