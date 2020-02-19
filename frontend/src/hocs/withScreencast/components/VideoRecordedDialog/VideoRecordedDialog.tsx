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

import React, { PureComponent, ReactNode } from "react"
import { Button, Modal, ModalBody, ModalHeader } from "reactstrap"

import "./style.scss"

export interface Props {
  /** Callback to close the dialog */
  onClose: () => void

  videoBlob: Blob

  fileName: string
}

class VideoRecordedDialog extends PureComponent<Props> {
  handleDownloadButton = (): void => {
    const { onClose } = this.props

    onClose()
  }

  getVideoSource = (): string => {
    const { videoBlob } = this.props

    return URL.createObjectURL(videoBlob)
  }

  public render = (): ReactNode => {
    const { onClose, fileName } = this.props
    const videoSource = this.getVideoSource()

    return (
      <Modal size="lg" isOpen={true} className="streamlit-dialog screencast">
        <ModalHeader toggle={onClose}>Next steps</ModalHeader>
        <ModalBody>
          <div className="steps-container">
            <div className="first-column first-step">Step 1</div>
            <div className="second-column first-step">
              <p>Preview your video below:</p>
              <video src={videoSource} controls />
            </div>
            <div className="third-column first-step" />

            <div className="first-column second-step">Step 2</div>
            <div className="second-column second-step">
              <Button
                outline
                color="primary"
                href={videoSource}
                download={`${fileName}.webm.mp4`}
                onClick={this.handleDownloadButton}
                className="download-button"
              >
                Save video to disk
              </Button>
              <p>
                <small>
                  This video is encoded in the{" "}
                  <a href="https://www.webmproject.org/">WebM format</a>, which
                  is only supported by newer video players. You can also play
                  it by dragging the file directly into your browser.
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
}

export default VideoRecordedDialog
