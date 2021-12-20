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

import { Video } from "@emotion-icons/open-iconic"
import { SwitchCamera } from "@emotion-icons/material-rounded"
import React, { ReactElement, useState, useRef } from "react"
import { isMobile } from "react-device-detect"
import Webcam from "react-webcam"
import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"

import Button, { Kind } from "src/components/shared/Button"
import Tooltip, { Placement } from "src/components/shared/Tooltip"
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
  disabled: boolean
}

export enum FacingMode {
  USER = "user",
  ENVIRONMENT = "environment",
}

export enum WebcamPermission {
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

interface AskForCameraPermissionProps {
  width: number
}

export const AskForCameraPermission = ({
  width,
}: AskForCameraPermissionProps): ReactElement => {
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

const WebcamComponent = ({
  handleCapture,
  width,
  disabled,
}: Props): ReactElement => {
  const [webcamPermission, setWebcamRequestState] = useState(
    WebcamPermission.PENDING
  )
  const videoRef = useRef<Webcam>(null)
  const [facingMode, setFacingMode] = useState(FacingMode.USER)

  function capture(): void {
    if (videoRef.current !== null) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    }
  }

  function switchCamera(): void {
    setFacingMode(prevState =>
      prevState === FacingMode.USER ? FacingMode.ENVIRONMENT : FacingMode.USER
    )
  }

  const theme: Theme = useTheme()

  return (
    <StyledCameraInput width={width}>
      {webcamPermission !== WebcamPermission.SUCCESS || disabled ? (
        <AskForCameraPermission width={width} />
      ) : (
        isMobile && (
          <StyledSwitchFacingModeButton>
            <Tooltip content={"Switch camera"} placement={Placement.TOP_RIGHT}>
              <Button kind={Kind.MINIMAL} onClick={switchCamera}>
                <Icon
                  content={SwitchCamera}
                  size="twoXL"
                  color={themeColors.white}
                />
              </Button>
            </Tooltip>
          </StyledSwitchFacingModeButton>
        )
      )}
      <StyledBox
        hidden={webcamPermission !== WebcamPermission.SUCCESS}
        width={width}
      >
        {!disabled && (
          <Webcam
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            width={width}
            style={{
              borderRadius: `.25rem .25rem 0 0`,
            }}
            height={(width * 9) / 16}
            onUserMediaError={() =>
              setWebcamRequestState(WebcamPermission.ERROR)
            }
            onUserMedia={() => setWebcamRequestState(WebcamPermission.SUCCESS)}
            videoConstraints={{
              width: { ideal: width },
              facingMode,
            }}
          />
        )}
      </StyledBox>
      <CameraInputButton
        data-testid="st-CameraInputButton"
        onClick={capture}
        disabled={webcamPermission !== WebcamPermission.SUCCESS || disabled}
      >
        Take Photo
      </CameraInputButton>
    </StyledCameraInput>
  )
}

export default WebcamComponent
