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

import { DownloadButton as DownloadButtonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import { mockEndpoints } from "~lib/mocks/mocks"
import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"

import DownloadButton, { Props } from "./DownloadButton"

vi.mock("~lib/WidgetStateManager")
vi.mock("~lib/StreamlitEndpoints")

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
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
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

  it("has correct className", () => {
    const props = getProps()
    render(<DownloadButton {...props} />)

    const downloadButton = screen.getByTestId("stDownloadButton")

    expect(downloadButton).toHaveClass("stDownloadButton")
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<DownloadButton {...props} />)

    const downloadButton = screen.getByRole("button", {
      name: `${props.element.label}`,
    })

    expect(downloadButton).toBeInTheDocument()
  })

  it("renders with help properly", async () => {
    const user = userEvent.setup()
    render(<DownloadButton {...getProps({ help: "mockHelpText" })} />)

    // Ensure both the button and the tooltip target have the correct width.
    // These will be 100% and the ElementContainer will have styles to determine
    // the button width.
    const downloadButton = screen.getByRole("button")
    expect(downloadButton).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  describe("wrapped BaseButton", () => {
    it("sets widget triggerValue and creates a download URL on click", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        undefined
      )

      expect(props.endpoints.buildDownloadUrl).toHaveBeenCalledWith(
        "/media/mockDownloadURL"
      )
    })

    it("has a correct new tab behaviour download link", () => {
      const props = getProps()
      const sameTabLink = createDownloadLinkElement({
        enforceDownloadInNewTab: false,
        url: props.element.url,
        filename: "",
      })
      expect(sameTabLink.getAttribute("target")).toBe("_self")

      const newTabLink = createDownloadLinkElement({
        enforceDownloadInNewTab: true,
        url: props.element.url,
        filename: "",
      })
      expect(newTabLink.getAttribute("target")).toBe("_blank")
    })

    describe("download attribute", () => {
      it("sets download attribute with empty filename", () => {
        const props = getProps()
        const link = createDownloadLinkElement({
          enforceDownloadInNewTab: false,
          url: props.element.url,
          filename: "",
        })
        expect(link.getAttribute("download")).toBe("")
      })

      it("sets download attribute with filename", () => {
        const props = getProps()
        const link = createDownloadLinkElement({
          enforceDownloadInNewTab: false,
          url: props.element.url,
          filename: "test.pdf",
        })
        expect(link.getAttribute("download")).toBe("test.pdf")
      })

      it("omits download attribute for service worker compatibility in Chromium browsers", () => {
        // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
        const originalStreamlit = window.__streamlit
        window.__streamlit = {
          ...window.__streamlit,
          DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
        }

        // Mock user agent to be a Chromium-based browser (not Firefox)
        const originalUserAgent = Object.getOwnPropertyDescriptor(
          window.navigator,
          "userAgent"
        )
        Object.defineProperty(window.navigator, "userAgent", {
          value:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          configurable: true,
        })

        try {
          const link = createDownloadLinkElement({
            enforceDownloadInNewTab: false,
            url: "https://download.streamlit.app/file.pdf",
            filename: "test.pdf",
          })
          expect(link.getAttribute("download")).toBeNull()
        } finally {
          // Cleanup
          window.__streamlit = originalStreamlit
          if (originalUserAgent) {
            Object.defineProperty(
              window.navigator,
              "userAgent",
              originalUserAgent
            )
          }
        }
      })

      it("sets download attribute in Firefox even with DOWNLOAD_ASSETS_BASE_URL", () => {
        // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
        const originalStreamlit = window.__streamlit
        window.__streamlit = {
          ...window.__streamlit,
          DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
        }

        // Mock user agent to be Firefox
        const originalUserAgent = Object.getOwnPropertyDescriptor(
          window.navigator,
          "userAgent"
        )
        Object.defineProperty(window.navigator, "userAgent", {
          value:
            "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
          configurable: true,
        })

        try {
          const link = createDownloadLinkElement({
            enforceDownloadInNewTab: false,
            url: "https://download.streamlit.app/file.pdf",
            filename: "test.pdf",
          })
          expect(link.getAttribute("download")).toBe("test.pdf")
        } finally {
          // Cleanup
          window.__streamlit = originalStreamlit
          if (originalUserAgent) {
            Object.defineProperty(
              window.navigator,
              "userAgent",
              originalUserAgent
            )
          }
        }
      })

      it("sets download attribute when URL does not match DOWNLOAD_ASSETS_BASE_URL", () => {
        // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
        const originalStreamlit = window.__streamlit
        window.__streamlit = {
          ...window.__streamlit,
          DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
        }

        try {
          const link = createDownloadLinkElement({
            enforceDownloadInNewTab: false,
            url: "https://different-domain.com/file.pdf",
            filename: "test.pdf",
          })
          expect(link.getAttribute("download")).toBe("test.pdf")
        } finally {
          // Cleanup
          window.__streamlit = originalStreamlit
        }
      })

      it("can set fragmentId on click", async () => {
        const user = userEvent.setup()
        const props = getProps(undefined, { fragmentId: "myFragmentId" })
        render(<DownloadButton {...props} />)

        const downloadButton = screen.getByRole("button")
        await user.click(downloadButton)

        expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
          props.element,
          { fromUi: true },
          "myFragmentId"
        )
      })
    })

    it("handles the disabled prop", () => {
      const props = getProps({}, { disabled: true })
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toBeDisabled()
    })
  })

  it("triggers checkSourceUrlResponse to check download url", () => {
    const props = getProps()
    props.endpoints.buildDownloadUrl = vi.fn(url => url)
    render(<DownloadButton {...props} />)

    expect(props.endpoints.checkSourceUrlResponse).toHaveBeenCalledWith(
      props.element.url,
      "Download Button"
    )
  })
})
