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
import { AspectRatioBox, AspectRatioBoxBody } from "baseui/aspect-ratio-box"
import { StyledCameraImageInput } from "./styled-components"
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
  const [selfieMode, setSelfieMode] = useState(true)

  const onUserMediaError = (): void => {
    setWebcamRequestState("error")
    console.error("Got a user media error!")
  }

  const onUserMedia = (): void => {
    setWebcamRequestState("success")
    setMountedState("Mounted!")
  }

  // Not sure if this is the algorithm we want.
  const switchCameras = (): void => {
    console.log("Got here")
    setSelfieMode(!selfieMode)
  }

  const successfulWebcam = (): React.ReactElement => {
    let videoConstraints = {
      // Make sure that we don't go over the width on wide mode
      height: (Math.min(1080, width) * 9) / 16,
      width: Math.min(1080, width),
      facingMode: "user",
    }
    if (!selfieMode) {
      videoConstraints = {
        // Make sure that we don't go over the width on wide mode
        height: (Math.min(1080, width) * 9) / 16,
        width: Math.min(1080, width),
        facingMode: "environment",
      }
    }
    return (
      <>
        <CameraInputButton onClick={switchCameras}>
          Switch Cameras!
        </CameraInputButton>
        <Webcam
          audio={false}
          ref={videoRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          onUserMediaError={onUserMediaError}
          onUserMedia={onUserMedia}
          videoConstraints={videoConstraints}
          style={{
            borderRadius: "30px",
          }}
        />
        <CameraInputButton
          onClick={() => {
            capture()
          }}
        >
          Take Photo New {mounted}
        </CameraInputButton>
      </>
    )
  }

  const getErrorScreen = (): React.ReactElement => {
    return (
      <>
        <AspectRatioBox
          aspectRatio={16 / 9}
          backgroundColor="#f0f2f6"
          overrides={{
            Block: {
              style: {
                width,
              },
            },
          }}
        >
          <AspectRatioBoxBody
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
            backgroundColor="#f0f2f6"
            overrides={{
              Block: {
                style: {
                  borderRadius: `30px`,
                },
              },
            }}
          >
            {
              // this image will need to be updated
            }
            <img
              src="https://www.clipartmax.com/png/middle/58-586156_video-camera-icons-clipart-font-awesome-video-camera.png"
              alt="camera_input"
              width={width / 8}
              height="35px"
            ></img>
            This App would like to use your Camera.
            <br />
            <a href="https://www.streamlit.io">Learn how to allow access.</a>
          </AspectRatioBoxBody>
        </AspectRatioBox>
      </>
    )
  }

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
    <>
      {webcamRequestState === "error" && getErrorScreen()}
      {webcamRequestState === "pending" && (
        <>
          {getErrorScreen()}
          <div hidden>
            <Webcam
              audio={false}
              ref={videoRef}
              onUserMediaError={onUserMediaError}
              onUserMedia={onUserMedia}
            />
          </div>
        </>
      )}
      {webcamRequestState === "success" && (
        <StyledCameraImageInput
          width={width}
          className="row-widget stCameraInput"
        >
          <AspectRatioBox aspectRatio={16 / 9}>
            <AspectRatioBoxBody
              as={successfulWebcam}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              backgroundColor="#f0f2f6"
              overrides={{
                Block: {
                  style: {
                    borderRadius: `30px`,
                  },
                },
              }}
            ></AspectRatioBoxBody>
          </AspectRatioBox>
        </StyledCameraImageInput>
      )}
    </>
  )
}

export default WebcamComponent
