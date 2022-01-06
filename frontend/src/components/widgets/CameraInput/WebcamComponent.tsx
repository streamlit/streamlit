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

import { SwitchCamera } from "@emotion-icons/material-rounded"
import { Video } from "@emotion-icons/open-iconic"
import { useTheme } from "emotion-theming"
import React, { ReactElement, useRef, useState } from "react"
import { isMobile } from "react-device-detect"
import Webcam from "react-webcam"

import Button, { Kind } from "src/components/shared/Button"
import Icon from "src/components/shared/Icon"
import Tooltip, { Placement } from "src/components/shared/Tooltip"
import { Theme } from "src/theme"
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
  clearPhotoInProgress: boolean
  setClearPhotoInProgress: (clearPhotoInProgress: boolean) => void
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
        <StyledLink
          href="https://support.google.com/chrome/answer/2693767"
          rel="noopener noreferrer"
          target="_blank"
        >
          Learn how to allow access.
        </StyledLink>
      </StyledDescription>
    </StyledBox>
  )
}

interface SwitchFacingModeButtonProps {
  switchFacingMode: () => void
}

export const SwitchFacingModeButton = ({
  switchFacingMode,
}: SwitchFacingModeButtonProps): ReactElement => {
  return (
    <StyledSwitchFacingModeButton>
      <Tooltip content={"Switch camera"} placement={Placement.TOP_RIGHT}>
        <Button kind={Kind.MINIMAL} onClick={switchFacingMode}>
          <Icon
            content={SwitchCamera}
            size="twoXL"
            color={themeColors.white}
          />
        </Button>
      </Tooltip>
    </StyledSwitchFacingModeButton>
  )
}

const WebcamComponent = ({
  handleCapture,
  width,
  disabled,
  clearPhotoInProgress,
  setClearPhotoInProgress,
}: Props): ReactElement => {
  const [webcamPermission, setWebcamPermissionState] = useState(
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

  function switchFacingMode(): void {
    setFacingMode(prevState =>
      prevState === FacingMode.USER ? FacingMode.ENVIRONMENT : FacingMode.USER
    )
  }

  const theme: Theme = useTheme()

  return (
    <StyledCameraInput width={width}>
      {webcamPermission !== WebcamPermission.SUCCESS &&
      !disabled &&
      !clearPhotoInProgress ? (
        <AskForCameraPermission width={width} />
      ) : (
        isMobile && (
          <SwitchFacingModeButton switchFacingMode={switchFacingMode} />
        )
      )}
      <StyledBox
        hidden={
          webcamPermission !== WebcamPermission.SUCCESS &&
          !disabled &&
          !clearPhotoInProgress
        }
        width={width}
      >
        {!disabled && (
          <Webcam
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            width={width}
            // We keep Aspect ratio of container always equal 16 / 9.
            // The aspect ration of video stream may be different depending on a camera.
            height={(width * 9) / 16}
            style={{
              borderRadius: `${theme.radii.md} ${theme.radii.md} 0 0`,
            }}
            onUserMediaError={() => {
              setWebcamPermissionState(WebcamPermission.ERROR)
            }}
            onUserMedia={() => {
              setWebcamPermissionState(WebcamPermission.SUCCESS)
              setClearPhotoInProgress(false)
            }}
            videoConstraints={{
              width: { ideal: width },
              facingMode,
            }}
          />
        )}
      </StyledBox>
      <CameraInputButton
        onClick={capture}
        disabled={
          webcamPermission !== WebcamPermission.SUCCESS ||
          disabled ||
          clearPhotoInProgress
        }
      >
        Take Photo
      </CameraInputButton>
    </StyledCameraInput>
  )
}

export default WebcamComponent
