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
import React, { ReactElement, useState, useRef } from "react"
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

enum FacingMode {
  USER = "user",
  ENVIRONMENT = "environment",
}

enum WebcamPermission {
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

const WebcamComponent = ({ handleCapture, width }: Props): ReactElement => {
  const [webcamPermission, setWebcamRequestState] = useState(
    WebcamPermission.PENDING
  )
  const videoRef = useRef<Webcam>(null)
  const [facingMode, setFacingMode] = useState(FacingMode.USER)

  const [loading, setLoading] = useState(true)
  const display = loading ? "none" : "block"

  function capture(): void {
    if (videoRef.current !== null && !loading) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    } else {
      alert("Please wait... The webcam is loading.")
    }
  }

  function switchCamera(): void {
    setFacingMode(prevState =>
      prevState === FacingMode.USER ? FacingMode.ENVIRONMENT : FacingMode.USER
    )
  }

  const onUserMedia = (): void => {
    setWebcamRequestState(WebcamPermission.SUCCESS)
    setLoading(false)
  }

  console.log(loading)

  return (
    <StyledCameraInput className="row-widget stCameraInput" width={width}>
      {webcamPermission !== WebcamPermission.SUCCESS ? (
        <AskForCameraPermission width={width} />
      ) : (
        <StyledSwitchFacingModeButton>
          <Button kind={Kind.ICON} onClick={switchCamera}>
            <Icon content={Aperture} />
          </Button>
        </StyledSwitchFacingModeButton>
      )}
      <StyledBox
        hidden={webcamPermission !== WebcamPermission.SUCCESS}
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
            setWebcamRequestState(WebcamPermission.ERROR)
          }
          onUserMedia={onUserMedia}
          videoConstraints={{
            // (KJ) TODO: Find optimal values for these constraints.
            height: { ideal: 1080 },
            width: { ideal: 1920 },
            facingMode,
          }}
          style={{ display }}
        />
      </StyledBox>
      {!loading && (
        <CameraInputButton
          onClick={capture}
          disabled={webcamPermission !== WebcamPermission.SUCCESS}
        >
          Take Photo
        </CameraInputButton>
      )}
    </StyledCameraInput>
  )
}

interface AskForCameraPermissionProps {
  width: number
}

function AskForCameraPermission({
  width,
}: AskForCameraPermissionProps): ReactElement {
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
