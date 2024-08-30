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

import { fireEvent, screen } from "@testing-library/react"

import "@testing-library/jest-dom"
import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { DownloadButton as DownloadButtonProto } from "@streamlit/lib/src/proto"
import { mockEndpoints } from "@streamlit/lib/src/mocks/mocks"

import DownloadButton, { createDownloadLink, Props } from "./DownloadButton"

jest.mock("@streamlit/lib/src/WidgetStateManager")
jest.mock("@streamlit/lib/src/StreamlitEndpoints")

const getProps = (
  elementProps: Partial<DownloadButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: DownloadButtonProto.create({
    id: "1",
    label: "Label",
    url: "/media/mockDownloadURL",
    ...elementProps,
  }),
  width: 250,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  endpoints: mockEndpoints(),
  ...widgetProps,
})

describe("DownloadButton widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<DownloadButton {...props} />)

    const downloadButton = screen.getByRole("button")
    expect(downloadButton).toBeInTheDocument()
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<DownloadButton {...props} />)

    const downloadButton = screen.getByTestId("stDownloadButton")

    expect(downloadButton).toHaveClass("stDownloadButton")
    expect(downloadButton).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<DownloadButton {...props} />)

    const downloadButton = screen.getByRole("button", {
      name: `${props.element.label}`,
    })

    expect(downloadButton).toBeInTheDocument()
  })

  describe("wrapped BaseButton", () => {
    it("sets widget triggerValue and creates a download URL on click", () => {
      const props = getProps()
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")

      fireEvent.click(downloadButton)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        undefined
      )

      expect(props.endpoints.buildMediaURL).toHaveBeenCalledWith(
        "/media/mockDownloadURL"
      )
    })

    it("has a correct new tab behaviour download link", () => {
      const props = getProps()
      const sameTabLink = createDownloadLink(
        props.endpoints,
        props.element.url,
        false
      )
      expect(sameTabLink.getAttribute("target")).toBe("_self")

      const newTabLink = createDownloadLink(
        props.endpoints,
        props.element.url,
        true
      )
      expect(newTabLink.getAttribute("target")).toBe("_blank")
    })

    it("can set fragmentId on click", () => {
      const props = getProps(undefined, { fragmentId: "myFragmentId" })
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      fireEvent.click(downloadButton)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        "myFragmentId"
      )
    })

    it("handles the disabled prop", () => {
      const props = getProps({}, { disabled: true })
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toBeDisabled()
    })

    it("does not use container width by default", () => {
      const props = getProps()
      render(<DownloadButton {...props}>Hello</DownloadButton>)

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toHaveStyle("width: auto")
    })

    it("passes useContainerWidth property with help correctly", () => {
      render(
        <DownloadButton
          {...getProps({ useContainerWidth: true, help: "mockHelpText" })}
        >
          Hello
        </DownloadButton>
      )

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toHaveStyle(`width: ${250}px`)
    })

    it("passes useContainerWidth property without help correctly", () => {
      render(
        <DownloadButton {...getProps({ useContainerWidth: true })}>
          Hello
        </DownloadButton>
      )

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toHaveStyle("width: 100%")
    })
  })

  it("renders an emoji icon if provided", () => {
    render(<DownloadButton {...getProps({ icon: "😀" })} />)

    const icon = screen.getByTestId("stIconEmoji")
    expect(icon).toHaveTextContent("😀")
  })

  it("renders a material icon if provided", () => {
    render(<DownloadButton {...getProps({ icon: ":material/thumb_up:" })} />)

    const icon = screen.getByTestId("stIconMaterial")
    expect(icon).toHaveTextContent("thumb_up")
  })

  it("renders an icon with no margin, if there is no label", () => {
    render(<DownloadButton {...getProps({ label: "", icon: "😀" })} />)

    expect(screen.getByTestId("stIconEmoji")).toHaveStyle("margin: 0")
  })
})
