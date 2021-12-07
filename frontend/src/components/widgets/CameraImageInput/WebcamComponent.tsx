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

  const [deviceId, setDeviceId] = React.useState({})
  const [devices, setDevices] = React.useState([])

  const handleDevices = useCallback(
    mediaDevices =>
      // @ts-ignore
      setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput")),
    [setDevices]
  )

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices)
  }, [handleDevices])

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
      <h1>AAAAA</h1>
      <ul>
        {devices.map((device, key) => (
          <li key={key}>
            <code key={key}>{JSON.stringify(device, null, 2)}</code>
          </li>
        ))}
      </ul>
      {webcamRequestState === "error" && (
        <div>Please allow access to Webcam</div>
      )}
      {webcamRequestState === "pending" && (
        <div>
          <Webcam
            hidden={true}
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            onUserMediaError={() => setWebcamRequestState("error")}
            onUserMedia={() => {
              setWebcamRequestState("success")
              setMountedState("ZZZZZZZZZ")
            }}
            width={Math.min(1080, width)}
            height={(Math.min(1080, width) * 9) / 16}
            videoConstraints={{
              // Make sure that we don't go over the width on wide mode
              width: Math.min(1080, width),
            }}
          />
          Please allow access to Webcam
        </div>
      )}
      {webcamRequestState === "success" && (
        <StyledCameraImageInput
          width={width}
          className="row-widget stCameraInput"
        >
          <Webcam
            audio={false}
            ref={videoRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            onUserMediaError={() => setWebcamRequestState("error")}
            onUserMedia={() => {
              setWebcamRequestState("success")
              setMountedState("DDDDDDDDDD")
            }}
            width={Math.min(1080, width)}
            height={(Math.min(1080, width) * 9) / 16}
            videoConstraints={{
              // Make sure that we don't go over the width on wide mode
              width: Math.min(1080, width),
            }}
          />
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
