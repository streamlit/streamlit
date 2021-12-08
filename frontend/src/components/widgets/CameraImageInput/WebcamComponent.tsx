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

import { Aperture, Video } from "@emotion-icons/open-iconic"
import React, { useState, useRef } from "react"
import Webcam from "react-webcam"

import Button, { Kind } from "src/components/shared/Button"
import Icon from "src/components/shared/Icon"
import themeColors from "src/theme/baseTheme/themeColors"
import CameraInputButton from "./CameraInputButton"
import {
  StyledBox,
  StyledCameraInput,
  StyledDescription,
  StyledLink,
  StyledSwitchFacingModeButton,
} from "./styled-components"

export interface Props {
  handleCapture: (capturedPhoto: string | null) => void
  width: number
}

enum FACING_MODE {
  USER = "user",
  ENVIRONMENT = "environment",
}

enum WEBCAM_PERMISSION {
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

const WebcamComponent = ({ handleCapture, width }: Props) => {
  const [webcamPermission, setWebcamRequestState] = useState(
    WEBCAM_PERMISSION.PENDING
  )
  const videoRef = useRef<Webcam>(null)
  const [facingMode, setFacingMode] = useState(FACING_MODE.USER)

  function capture() {
    if (videoRef.current !== null) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    }
  }

  function switchCamera() {
    setFacingMode(prevState =>
      prevState === FACING_MODE.USER
        ? FACING_MODE.ENVIRONMENT
        : FACING_MODE.USER
    )
  }

  return (
    <StyledCameraInput className="row-widget stCameraInput" width={width}>
      {webcamPermission !== WEBCAM_PERMISSION.SUCCESS ? (
        <AskForCameraPermission width={width} />
      ) : (
        <StyledSwitchFacingModeButton>
          <Button kind={Kind.ICON} onClick={switchCamera}>
            <Icon content={Aperture} />
          </Button>
        </StyledSwitchFacingModeButton>
      )}
      <StyledBox
        hidden={webcamPermission !== WEBCAM_PERMISSION.SUCCESS}
        width={width}
      >
        <Webcam
          audio={false}
          ref={videoRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          width={width}
          height={(width * 9) / 16}
          onUserMediaError={() =>
            setWebcamRequestState(WEBCAM_PERMISSION.ERROR)
          }
          onUserMedia={() => {
            setWebcamRequestState(WEBCAM_PERMISSION.SUCCESS)
          }}
          videoConstraints={{
            // (KJ) TODO: Find optimal values for these constraints.
            height: { ideal: 1080 },
            width: { ideal: 1920 },
            facingMode,
          }}
        />
      </StyledBox>
      <CameraInputButton
        onClick={capture}
        disabled={webcamPermission !== WEBCAM_PERMISSION.SUCCESS}
      >
        Take Photo
      </CameraInputButton>
    </StyledCameraInput>
  )
}

interface AskForCameraPermissionProps {
  width: number
}

function AskForCameraPermission({ width }: AskForCameraPermissionProps) {
  return (
    <StyledBox width={width}>
      <Icon size="threeXL" color={themeColors.gray60} content={Video} />
      <StyledDescription>
        This app would like to use your camera.
        <StyledLink href="https://streamlit.io">
          Learn how to allow access.
        </StyledLink>
      </StyledDescription>
    </StyledBox>
  )
}

export default WebcamComponent
