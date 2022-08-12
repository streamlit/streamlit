import React, { PureComponent, ReactNode } from "react"
import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import {
  StyledScreenCastWarningDialog,
  StyledUnsupportedScreenCastExplanation,
  StyledUnsupportedScreenCastIcon,
} from "./styled-components"

export interface Props {
  /** Callback to close the dialog */
  onClose: () => void
}

class UnsupportedBrowserDialog extends PureComponent<Props> {
  public render(): ReactNode {
    const { onClose } = this.props

    return (
      <Modal isOpen onClose={onClose}>
        <ModalHeader>Record a screencast</ModalHeader>
        <ModalBody>
          <StyledScreenCastWarningDialog>
            <StyledUnsupportedScreenCastIcon>
              <span role="img" aria-label="Alien Monster">
                👾
              </span>
            </StyledUnsupportedScreenCastIcon>
            <StyledUnsupportedScreenCastExplanation>
              Due to limitations with some browsers, this feature is only
              supported on recent desktop versions of Chrome, Firefox, and
              Edge.
            </StyledUnsupportedScreenCastExplanation>
          </StyledScreenCastWarningDialog>
        </ModalBody>
      </Modal>
    )
  }
}

export default UnsupportedBrowserDialog
