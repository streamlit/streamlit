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

import React from "react"
import { BaseProvider, LightTheme } from "baseui"
import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"
import { render } from "@streamlit/lib"
import VideoRecordedDialog, { Props } from "./VideoRecordedDialog"

URL.createObjectURL = jest.fn()

const getProps = (props: Partial<Props> = {}): Props => ({
  fileName: "test",
  onClose: jest.fn(),
  videoBlob: new Blob(),
  ...props,
})

describe("VideoRecordedDialog", () => {
  const props = getProps()

  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <VideoRecordedDialog {...props} />
      </BaseProvider>
    )
    expect(screen.getByTestId("stModal")).toBeInTheDocument()
    expect(screen.getByTestId("stVideoRecordedDialog")).toBeInTheDocument()
  })

  it("should render a header", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <VideoRecordedDialog {...props} />
      </BaseProvider>
    )
    expect(screen.getByText("Next steps")).toHaveStyle("font-weight: 600")
  })

  it("should render a video", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <VideoRecordedDialog {...props} />
      </BaseProvider>
    )
    expect(screen.getByTestId("stVideoRecordedDialog")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://www.webmproject.org/"
    )
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it("should render a download button", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <VideoRecordedDialog {...props} />
      </BaseProvider>
    )
    const downloadButton = screen.getByRole("button", {
      name: "Save video to disk",
    })

    expect(downloadButton).toBeInTheDocument()
    fireEvent.click(downloadButton)
    expect(props.onClose).toHaveBeenCalled()
  })
})
