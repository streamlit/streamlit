/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { Video } from "@emotion-icons/open-iconic"
import { useTheme } from "@emotion/react"
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { isMobile } from "react-device-detect"
import Webcam from "react-webcam"
import { debounce } from "src/lib/utils"

import Icon from "src/components/shared/Icon"
import { Theme } from "src/theme"
import themeColors from "src/theme/baseTheme/themeColors"
import { CAMERA_PERMISSION_URL } from "src/urls"

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
  width: number
  disabled: boolean
  clearPhotoInProgress: boolean
  setClearPhotoInProgress: (clearPhotoInProgress: boolean) => void
  facingMode: FacingMode
  setFacingMode: () => void
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
  width,
  disabled,
  clearPhotoInProgress,
  setClearPhotoInProgress,
  facingMode,
  setFacingMode,
}: Props): ReactElement => {
  const [webcamPermission, setWebcamPermissionState] = useState(
    WebcamPermission.PENDING
  )
  const videoRef = useRef<Webcam>(null)

  const [debouncedWidth, setDebouncedWidth] = useState(width)
  const memoizedSetDebouncedCallback = useCallback(
    debounce(1000, setDebouncedWidth),
    []
  )

  useEffect(() => {
    memoizedSetDebouncedCallback(width)
  }, [width])

  function capture(): void {
    if (videoRef.current !== null) {
      const imageSrc = videoRef.current.getScreenshot()
      handleCapture(imageSrc)
    }
  }

  const theme: Theme = useTheme()

  return (
    <StyledCameraInput width={debouncedWidth}>
      {webcamPermission !== WebcamPermission.SUCCESS &&
      !disabled &&
      !clearPhotoInProgress ? (
        <AskForCameraPermission width={debouncedWidth} />
      ) : (
        isMobile && <SwitchFacingModeButton switchFacingMode={setFacingMode} />
      )}
      <StyledBox
        hidden={
          webcamPermission !== WebcamPermission.SUCCESS &&
          !disabled &&
          !clearPhotoInProgress
        }
        width={debouncedWidth}
      >
        {!disabled && (
          <Webcam
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            width={debouncedWidth}
            // We keep Aspect ratio of container always equal 16 / 9.
            // The aspect ration of video stream may be different depending on a camera.
            height={(debouncedWidth * 9) / 16}
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
              width: { ideal: debouncedWidth },
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
