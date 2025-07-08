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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import { FacingMode } from "./SwitchFacingModeButton"
import WebcamComponent, { Props, WebcamPermission } from "./WebcamComponent"

vi.mock("react-webcam")

vi.mock("~lib/util/isMobile", () => {
  return {
    isMobile: () => true,
  }
})

const getProps = (props: Partial<Props> = {}): Props => {
  return {
    handleCapture: vi.fn(),
    width: 500,
    disabled: false,
    setClearPhotoInProgress: vi.fn(),
    clearPhotoInProgress: false,
    facingMode: FacingMode.USER,
    setFacingMode: vi.fn(),
    testOverride: WebcamPermission.PENDING,
    ...props,
  }
}

describe("Test Webcam Component", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()
  })

  it("renders ask permission screen when pending state", () => {
    const props = getProps()
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()
    expect(
      screen.getByText("This app would like to use your camera.")
    ).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveTextContent(
      "Learn how to allow access."
    )
    // hidden style should be there and webcam should not show
    expect(screen.getByTestId("stCameraInputWebcamStyledBox")).toHaveAttribute(
      "hidden"
    )
  })

  it("renders ask permission screen when error state", () => {
    const props = getProps({ testOverride: WebcamPermission.ERROR })
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()

    expect(
      screen.getByText("This app would like to use your camera.")
    ).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveTextContent(
      "Learn how to allow access."
    )
    // hidden style should be there and webcam should not show
    expect(screen.getByTestId("stCameraInputWebcamStyledBox")).toHaveAttribute(
      "hidden"
    )
  })

  it("does not render ask permission screen in success state", () => {
    const props = getProps({ testOverride: WebcamPermission.SUCCESS })
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()

    // hidden style should not be there and webcam should show
    expect(
      screen.getByTestId("stCameraInputWebcamStyledBox")
    ).not.toHaveAttribute("hidden")
  })

  it("shows a SwitchFacingMode button", () => {
    const props = getProps({ testOverride: WebcamPermission.SUCCESS })
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()
    expect(screen.getByTestId("stCameraInputSwitchButton")).toBeInTheDocument()
  })

  it("changes `facingMode` when SwitchFacingMode button clicked", async () => {
    const user = userEvent.setup()
    const props = getProps({ testOverride: WebcamPermission.SUCCESS })
    render(<WebcamComponent {...props} />)

    expect(screen.getByTestId("stCameraInputSwitchButton")).toBeInTheDocument()

    const switchButton = within(
      screen.getByTestId("stCameraInputSwitchButton")
    ).getByRole("button")

    await user.click(switchButton)

    expect(props.setFacingMode).toHaveBeenCalledTimes(1)
  })

  it("test handle capture function", async () => {
    const user = userEvent.setup()
    const props = getProps({ testOverride: WebcamPermission.SUCCESS })
    render(<WebcamComponent {...props} />)
    expect(
      screen.getByTestId("stCameraInputWebcamComponent")
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Take Photo" }))

    expect(props.handleCapture).toHaveBeenCalled()
  })
})
