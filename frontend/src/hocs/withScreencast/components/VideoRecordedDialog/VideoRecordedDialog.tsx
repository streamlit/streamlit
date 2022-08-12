import React, { FunctionComponent } from "react"
import Button, { Kind } from "src/components/shared/Button"
import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import {
  StyledDialogContainer,
  StyledRow,
  StyledFirstColumn,
  StyledSecondColumn,
  StyledVideo,
  StyledVideoFormatInstructions,
  StyledDownloadButtonContainer,
} from "./styled-components"

export interface Props {
  /** Callback to close the dialog */
  onClose: () => void
  videoBlob: Blob

  fileName: string
}
const VideoRecordedDialog: FunctionComponent<Props> = ({
  onClose,
  videoBlob,
  fileName,
}) => {
  const videoSource = URL.createObjectURL(videoBlob)
  const handleDownloadClick: () => void = () => {
    // Downloads are only done on links, so create a hidden one and click it
    // for the user.
    const link = document.createElement("a")
    link.setAttribute("href", videoSource)
    link.setAttribute("download", `${fileName}.webm`)
    link.click()

    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      overrides={{
        Dialog: {
          style: {
            width: "80vw",
          },
        },
      }}
    >
      <ModalHeader>Next steps</ModalHeader>
      <ModalBody>
        <StyledDialogContainer>
          <StyledRow>
            <StyledFirstColumn>Step 1</StyledFirstColumn>
            <StyledSecondColumn>
              <p>Preview your video below:</p>
              <StyledVideo src={videoSource} controls />
            </StyledSecondColumn>
          </StyledRow>

          <StyledRow>
            <StyledFirstColumn>Step 2</StyledFirstColumn>
            <StyledSecondColumn>
              <StyledDownloadButtonContainer>
                <Button kind={Kind.PRIMARY} onClick={handleDownloadClick}>
                  Save video to disk
                </Button>
              </StyledDownloadButtonContainer>
              <StyledVideoFormatInstructions>
                This video is encoded in the{" "}
                <a href="https://www.webmproject.org/">WebM format</a>, which
                is only supported by newer video players. You can also play it
                by dragging the file directly into your browser.
              </StyledVideoFormatInstructions>
            </StyledSecondColumn>
          </StyledRow>

          <StyledRow>
            <StyledFirstColumn>Step 3</StyledFirstColumn>
            <StyledSecondColumn>
              Share your video with the world on Twitter, LinkedIn, YouTube, or
              just plain email!{" "}
              <span role="img" aria-label="Happy">
                😀
              </span>
            </StyledSecondColumn>
          </StyledRow>
        </StyledDialogContainer>
      </ModalBody>
    </Modal>
  )
}

export default VideoRecordedDialog
