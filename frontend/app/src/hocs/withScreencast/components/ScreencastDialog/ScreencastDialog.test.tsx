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
import { BaseProvider, LightTheme } from "baseui"

import { render } from "@streamlit/lib"

import ScreencastDialog, { Props } from "./ScreencastDialog"

const getProps = (props: Partial<Props> = {}): Props => ({
  onClose: vi.fn(),
  startRecording: vi.fn(),
  toggleRecordAudio: vi.fn(),
  recordAudio: false,
  ...props,
})

describe("ScreencastDialog", () => {
  const props = getProps()

  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <ScreencastDialog {...props} />
      </BaseProvider>
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("should render a header", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <ScreencastDialog {...props} />
      </BaseProvider>
    )
    expect(screen.getByText("Record a screencast")).toBeInTheDocument()
  })

  describe("Modal body", () => {
    it("should have a record audio option to be selected", async () => {
      const user = userEvent.setup()
      render(
        <BaseProvider theme={LightTheme}>
          <ScreencastDialog {...props} />
        </BaseProvider>
      )
      expect(
        screen.getByTestId("stScreencastAudioCheckbox")
      ).toHaveTextContent("Also record audio")
      const audioCheckbox = screen.getByRole("checkbox")
      await user.click(audioCheckbox)
      expect(audioCheckbox).toBeChecked()
      expect(props.toggleRecordAudio).toHaveBeenCalled()
    })

    it("should have the stop recording explanation message", () => {
      render(
        <BaseProvider theme={LightTheme}>
          <ScreencastDialog {...props} />
        </BaseProvider>
      )
      const instruction = screen.getByTestId("stScreencastInstruction")
      expect(instruction).toHaveTextContent(
        "Press Esc any time to stop recording."
      )
    })
  })

  describe("Modal footer", () => {
    it("should have an start button", async () => {
      const user = userEvent.setup()
      render(
        <BaseProvider theme={LightTheme}>
          <ScreencastDialog {...props} />
        </BaseProvider>
      )
      const startButton = screen.getByText("Start recording!")
      expect(startButton).toBeInTheDocument()
      await user.click(startButton)
      expect(props.startRecording).toHaveBeenCalled()
      expect(props.onClose).toHaveBeenCalled()
    })
  })
})
