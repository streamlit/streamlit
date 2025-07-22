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

import React from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

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
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  onClickPlayPause: vi.fn(),
  onClear: vi.fn(),
})

describe("AudioInputActionButton", () => {
  it("should render without crashing", () => {
    render(<AudioInputActionButtons {...getProps()} />)

    expect(screen.getByTestId("stAudioInputActionButton")).toBeInTheDocument()
  })

  it("should start recording when recording button is pressed", async () => {
    const user = userEvent.setup()
    const startRecording = vi.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        startRecording={startRecording}
      />
    )

    const recordButton = screen.getByLabelText("Record")
    expect(recordButton).toHaveStyle("color: rgba(49, 51, 63, 0.6)")

    await user.click(recordButton)
    expect(startRecording).toHaveBeenCalled()
  })

  it("should stop recording when recording button is pressed", async () => {
    const user = userEvent.setup()
    const stopRecording = vi.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        isRecording={true}
        stopRecording={stopRecording}
      />
    )

    const stopRecordingButton = screen.getByLabelText("Stop recording")
    expect(stopRecordingButton).toHaveStyle("color: rgb(255, 75, 75)")

    await user.click(stopRecordingButton)
    expect(stopRecording).toHaveBeenCalled()
  })

  it("should play when play button is pressed", async () => {
    const user = userEvent.setup()
    const onClickPlayPause = vi.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        recordingUrlExists={true}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(screen.getByLabelText("Record")).toBeInTheDocument()
    const playButton = screen.getByLabelText("Play")
    expect(playButton).toHaveStyle("color: rgba(49, 51, 63, 0.6)")

    await user.click(playButton)
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  it("should pause when pause button is pressed", async () => {
    const user = userEvent.setup()
    const onClickPlayPause = vi.fn()
    render(
      <AudioInputActionButtons
        {...getProps()}
        isPlaying={true}
        recordingUrlExists={true}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(screen.getByLabelText("Record")).toBeInTheDocument()
    const pauseButton = screen.getByLabelText("Pause")
    expect(pauseButton).toHaveStyle("color: rgba(49, 51, 63, 0.6)")

    await user.click(pauseButton)
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  describe("when disabled", () => {
    it("should not start recording when recording button is pressed", async () => {
      const user = userEvent.setup()
      const startRecording = vi.fn()
      render(
        <AudioInputActionButtons
          {...getProps()}
          disabled={true}
          startRecording={startRecording}
        />
      )

      const recordButton = screen.getByLabelText("Record")
      expect(recordButton).toHaveStyle("color: rgba(49, 51, 63, 0.2)")

      await user.click(recordButton)
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
