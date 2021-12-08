/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { useState, useRef, useEffect } from "react"
import Webcam from "react-webcam"
import { StyledBox, StyledCameraImageInput } from "./styled-components"
import CameraInputButton from "./CameraInputButton"

export interface Props {
  width: number
  handleCapture: (capturedPhoto: string) => void
}

const WebcamComponent = ({
  width,
  handleCapture,
}: Props): React.ReactElement => {
  const [webcamRequestState, setWebcamRequestState] = useState("pending")
  const videoRef = useRef<any>(null) // SPECIFY MORE SPECIFIC TYPE
  const [mounted, setMountedState] = useState("notMounted")

  const capture = React.useCallback(() => {
    if (videoRef.current !== null) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    }
  }, [videoRef])

  useEffect(() => {
    if (videoRef.current !== null) {
      setMountedState("MOUNTED!!!!")
    }
  }, [videoRef])

  return (
    <div>
      {webcamRequestState === "error" && (
        <div>Please allow access to Webcam</div>
      )}
      {webcamRequestState === "pending" && (
        <StyledBox width={width}>
          <div hidden>
            <Webcam
              hidden={true}
              audio={false}
              ref={videoRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={1}
              onUserMediaError={() => setWebcamRequestState("error")}
              onUserMedia={() => {
                setWebcamRequestState("success")
              }}
              videoConstraints={{
                // Make sure that we don't go over the width on wide mode
                width: Math.min(1080, width),
              }}
            />
            Please allow access to Webcam
          </div>
        </StyledBox>
      )}
      {webcamRequestState === "success" && (
        <StyledCameraImageInput
          width={width}
          className="row-widget stCameraInput"
        >
          <StyledBox width={width}>
            <Webcam
              audio={false}
              ref={videoRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={1}
              width={width}
              height={(width * 9) / 16}
              onUserMediaError={() => setWebcamRequestState("error")}
              onUserMedia={() => {
                setWebcamRequestState("success")
              }}
              videoConstraints={{
                // Make sure that we don't go over the width on wide mode
                width,
              }}
            />
          </StyledBox>
          <CameraInputButton
            onClick={() => {
              capture()
            }}
          >
            Take Photo New {mounted}
          </CameraInputButton>
        </StyledCameraImageInput>
      )}
    </div>
  )
}

export default WebcamComponent
