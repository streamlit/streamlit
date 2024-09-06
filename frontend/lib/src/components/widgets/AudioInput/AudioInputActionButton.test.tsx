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
import { render } from "@streamlit/lib/src/test_util"
import AudioInputActionButton from "./AudioInputActionButton"
import { fireEvent } from "@testing-library/react"

describe("AudioInputActionButton", () => {
  it("should render without crashing", () => {
    render(
      <AudioInputActionButton
        disabled={false}
        isRecording={false}
        isPlaying={false}
        recordingUrlExists={false}
        startRecording={jest.fn()}
        stopRecording={jest.fn()}
        onClickPlayPause={jest.fn()}
      />
    )
  })

  it("should start recording when recording button is pressed", () => {
    const startRecording = jest.fn()
    const { getByLabelText } = render(
      <AudioInputActionButton
        disabled={false}
        isRecording={false}
        isPlaying={false}
        recordingUrlExists={false}
        startRecording={startRecording}
        stopRecording={jest.fn()}
        onClickPlayPause={jest.fn()}
      />
    )

    expect(getByLabelText("Record")).toBeInTheDocument()
    fireEvent.click(getByLabelText("Record"))
    expect(startRecording).toHaveBeenCalled()
  })

  it("should stop recording when recording button is pressed", () => {
    const stopRecording = jest.fn()
    const { getByLabelText } = render(
      <AudioInputActionButton
        disabled={false}
        isRecording={true}
        isPlaying={false}
        recordingUrlExists={false}
        startRecording={jest.fn()}
        stopRecording={stopRecording}
        onClickPlayPause={jest.fn()}
      />
    )

    expect(getByLabelText("Stop recording")).toBeInTheDocument()
    fireEvent.click(getByLabelText("Stop recording"))
    expect(stopRecording).toHaveBeenCalled()
  })

  it("should play when play button is pressed", () => {
    const onClickPlayPause = jest.fn()
    const { getByLabelText } = render(
      <AudioInputActionButton
        disabled={false}
        isRecording={false}
        isPlaying={false}
        recordingUrlExists={true}
        startRecording={jest.fn()}
        stopRecording={jest.fn()}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(getByLabelText("Play")).toBeInTheDocument()
    fireEvent.click(getByLabelText("Play"))
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  it("should pause when pause button is pressed", () => {
    const onClickPlayPause = jest.fn()
    const { getByLabelText } = render(
      <AudioInputActionButton
        disabled={false}
        isRecording={false}
        isPlaying={true}
        recordingUrlExists={true}
        startRecording={jest.fn()}
        stopRecording={jest.fn()}
        onClickPlayPause={onClickPlayPause}
      />
    )

    expect(getByLabelText("Pause")).toBeInTheDocument()
    fireEvent.click(getByLabelText("Pause"))
    expect(onClickPlayPause).toHaveBeenCalled()
  })

  describe("when disabled", () => {
    it("should not start recording when recording button is pressed", () => {
      const startRecording = jest.fn()
      const { getByLabelText } = render(
        <AudioInputActionButton
          disabled={true}
          isRecording={false}
          isPlaying={false}
          recordingUrlExists={false}
          startRecording={startRecording}
          stopRecording={jest.fn()}
          onClickPlayPause={jest.fn()}
        />
      )

      expect(getByLabelText("Record")).toBeInTheDocument()
      fireEvent.click(getByLabelText("Record"))
      expect(startRecording).not.toHaveBeenCalled()
    })
  })
})
