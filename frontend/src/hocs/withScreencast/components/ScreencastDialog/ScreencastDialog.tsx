import React, { ChangeEvent, PureComponent, ReactNode } from "react"
import { Kind } from "src/components/shared/Button"
import Modal, {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from "src/components/shared/Modal"
import { StyledInstruction, StyledRecordAudioLabel } from "./styled-components"

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

  public render(): ReactNode {
    const { recordAudio } = this.state
    const { onClose } = this.props

    return (
      <Modal isOpen onClose={onClose}>
        <ModalHeader>Record a screencast</ModalHeader>
        <ModalBody>
          <p>
            This will record a video with the contents of your screen, so you
            can easily share what you're seeing with others.
          </p>
          <p>
            <StyledRecordAudioLabel>
              <input
                type="checkbox"
                name="recordAudio"
                checked={recordAudio}
                onChange={this.handleRecordAudioCheckbox}
              />{" "}
              Also record audio
            </StyledRecordAudioLabel>
          </p>
          <StyledInstruction>
            Press <kbd>Esc</kbd> any time to stop recording.
          </StyledInstruction>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={Kind.PRIMARY} onClick={this.handleStartButton}>
            Start recording!
          </ModalButton>
        </ModalFooter>
      </Modal>
    )
  }
}

export default ScreencastDialog
