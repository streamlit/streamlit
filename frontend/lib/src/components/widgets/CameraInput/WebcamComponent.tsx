/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { memo, ReactElement, useRef, useState } from "react"

import { Video } from "@emotion-icons/open-iconic"
import { isMobile } from "react-device-detect"
import Webcam from "react-webcam"

import Icon from "~lib/components/shared/Icon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import themeColors from "~lib/theme/emotionBaseTheme/themeColors"
import { CAMERA_PERMISSION_URL } from "~lib/urls"

import CameraInputButton from "./CameraInputButton"
import SwitchFacingModeButton, { FacingMode } from "./SwitchFacingModeButton"
import {
  StyledBox,
  StyledCameraInput,
  StyledDescription,
  StyledLink,
} from "./styled-components"

export interface Props {
  handleCapture: (capturedPhoto: string | null) => void
  disabled: boolean
  clearPhotoInProgress: boolean
  setClearPhotoInProgress: (clearPhotoInProgress: boolean) => void
  facingMode: FacingMode
  setFacingMode: () => void
  // Allow for unit testing
  testOverride?: WebcamPermission
}

export enum WebcamPermission {
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

export const AskForCameraPermission = (): ReactElement => {
  return (
    <StyledBox>
      <Icon size="threeXL" color={themeColors.gray60} content={Video} />
      <StyledDescription>
        This app would like to use your camera.
        <StyledLink
          href={CAMERA_PERMISSION_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Learn how to allow access.
        </StyledLink>
      </StyledDescription>
    </StyledBox>
  )
}

const WebcamComponent = ({
  handleCapture,
  disabled,
  clearPhotoInProgress,
  setClearPhotoInProgress,
  facingMode,
  setFacingMode,
  testOverride,
}: Props): ReactElement => {
  const [webcamPermission, setWebcamPermissionState] = useState(
    testOverride || WebcamPermission.PENDING
  )
  const videoRef = useRef<Webcam>(null)

  function capture(): void {
    if (videoRef.current !== null) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    }
  }

  const theme = useEmotionTheme()

  return (
    <StyledCameraInput data-testid="stCameraInputWebcamComponent">
      {webcamPermission !== WebcamPermission.SUCCESS &&
      !disabled &&
      !clearPhotoInProgress ? (
        <AskForCameraPermission />
      ) : (
        isMobile && <SwitchFacingModeButton switchFacingMode={setFacingMode} />
      )}
      <StyledBox
        data-testid="stCameraInputWebcamStyledBox"
        hidden={
          webcamPermission !== WebcamPermission.SUCCESS &&
          !disabled &&
          !clearPhotoInProgress
        }
      >
        {!disabled && (
          <Webcam
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            style={{
              borderRadius: `${theme.radii.default} ${theme.radii.default} 0 0`,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onUserMediaError={() => {
              setWebcamPermissionState(WebcamPermission.ERROR)
            }}
            onUserMedia={() => {
              setWebcamPermissionState(WebcamPermission.SUCCESS)
              setClearPhotoInProgress(false)
            }}
            videoConstraints={{
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

export default memo(WebcamComponent)
