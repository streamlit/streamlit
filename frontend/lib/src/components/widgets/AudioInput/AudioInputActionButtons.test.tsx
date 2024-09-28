/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"

import AudioInputActionButtons, {
  AudioInputActionButtonProps,
} from "./AudioInputActionButtons"

const getProps = (): AudioInputActionButtonProps => ({
  disabled: false,
  isRecording: false,
  isPlaying: false,
  isUploading: false,
  recordingUrlExists: false,
  isError: false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  onClickPlayPause: jest.fn(),
  onClear: jest.fn(),
})

describe("AudioInputActionButton", () => {
  it("should render without crashing", () => {
    render(<AudioInputActionButtons {...getProps()} />)

    expect(screen.getByTestId("stAudioInputActionButton")).toBeInTheDocument()
  })

  it("should start recording when recording button is pressed", () => {
    const startRecording = jest.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        startRecording={startRecording}
      />
    )

    expect(screen.getByLabelText("Record")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Record"))
    expect(startRecording).toHaveBeenCalled()
  })

  it("should stop recording when recording button is pressed", () => {
    const stopRecording = jest.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        isRecording={true}
        stopRecording={stopRecording}
      />
    )

    expect(screen.getByLabelText("Stop recording")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Stop recording"))
    expect(stopRecording).toHaveBeenCalled()
  })

  it("should play when play button is pressed", () => {
    const onClickPlayPause = jest.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        recordingUrlExists={true}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(screen.getByLabelText("Record")).toBeInTheDocument()
    expect(screen.getByLabelText("Play")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Play"))
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  it("should pause when pause button is pressed", () => {
    const onClickPlayPause = jest.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        isPlaying={true}
        recordingUrlExists={true}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(screen.getByLabelText("Record")).toBeInTheDocument()
    expect(screen.getByLabelText("Pause")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Pause"))
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  describe("when disabled", () => {
    it("should not start recording when recording button is pressed", () => {
      const startRecording = jest.fn()
      render(
        <AudioInputActionButtons
          {...getProps()}
          disabled={true}
          startRecording={startRecording}
        />
      )

      expect(screen.getByLabelText("Record")).toBeInTheDocument()
      fireEvent.click(screen.getByLabelText("Record"))
      expect(startRecording).not.toHaveBeenCalled()
    })
  })

  describe("when uploading", () => {
    it("should render the uploading spinner", () => {
      render(<AudioInputActionButtons {...getProps()} isUploading={true} />)

      expect(screen.getByLabelText("Uploading")).toBeInTheDocument()
    })
  })

  describe("when error", () => {
    it("should render the error message", () => {
      render(<AudioInputActionButtons {...getProps()} isError={true} />)

      expect(screen.getByLabelText("Reset")).toBeInTheDocument()
    })
  })
})
