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

import React, { FunctionComponent } from "react"
import Button, { Kind } from "components/shared/Button"
import Modal, { ModalHeader, ModalBody } from "components/shared/Modal"

import "./style.scss"

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
        <div className="screencast-dialog">
          <div className="first-column first-step">Step 1</div>
          <div className="second-column first-step">
            <p>Preview your video below:</p>
            <video src={videoSource} controls />
          </div>
          <div className="third-column first-step" />

          <div className="first-column second-step">Step 2</div>
          <div className="second-column second-step">
            <Button kind={Kind.PRIMARY} onClick={handleDownloadClick}>
              Save video to disk
            </Button>
            <p>
              <small>
                This video is encoded in the{" "}
                <a href="https://www.webmproject.org/">WebM format</a>, which
                is only supported by newer video players. You can also play it
                by dragging the file directly into your browser.
              </small>
            </p>
          </div>

          <div className="first-column third-step">Step 3</div>
          <div className="second-column third-step">
            Share your video with the world on Twitter, LinkedIn, YouTube, or
            just plain email!{" "}
            <span role="img" aria-label="Happy">
              😀
            </span>
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}

export default VideoRecordedDialog
