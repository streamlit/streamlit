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

import React, { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { Aperture } from "@emotion-icons/open-iconic"
import Icon from "src/components/shared/Icon"
import Button, { Kind } from "src/components/shared/Button"
import {
  StyledBox,
  StyledCameraImageInput,
  StyledSwitchFacingModeButton,
} from "./styled-components"
import CameraInputButton from "./CameraInputButton"

export interface Props {
  width: number
  handleCapture: (capturedPhoto: string) => void
}

const FACING_MODE_USER = "user"
const FACING_MODE_ENVIRONMENT = "environment"

const WebcamComponent = ({
  width,
  handleCapture,
}: Props): React.ReactElement => {
  const [webcamRequestState, setWebcamRequestState] = useState("pending")
  const videoRef = useRef<any>(null) // SPECIFY MORE SPECIFIC TYPE
  const [mounted, setMountedState] = useState("notMounted")
  const [facingMode, setFacingMode] = useState("user")

  const capture = useCallback(() => {
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

  const switchCamera = useCallback(() => {
    setFacingMode(prevState =>
      prevState === FACING_MODE_USER
        ? FACING_MODE_ENVIRONMENT
        : FACING_MODE_USER
    )
  }, [])

  return (
    <div>
      {webcamRequestState === "error" && (
        <StyledBox width={width}>
          <div>This app would like to use your camera.</div>
          <div>Learn how to allow it.</div>
        </StyledBox>
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
            <StyledSwitchFacingModeButton>
              <Button kind={Kind.ICON} onClick={switchCamera}>
                <Icon content={Aperture} />
              </Button>
            </StyledSwitchFacingModeButton>
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
                facingMode,
              }}
            />
          </StyledBox>
          <CameraInputButton
            onClick={() => {
              capture()
            }}
          >
            Take Photo
          </CameraInputButton>
        </StyledCameraImageInput>
      )}
    </div>
  )
}

export default WebcamComponent
