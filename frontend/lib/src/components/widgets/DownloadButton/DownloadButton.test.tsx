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

import {
  DeferredFileResponse,
  DownloadButton as DownloadButtonProto,
} from "@streamlit/protobuf"

import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"
import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DownloadButton, { Props } from "./DownloadButton"

vi.mock("~lib/WidgetStateManager")
vi.mock("~lib/StreamlitEndpoints")

const anchorClickSpy = vi
  .spyOn(HTMLAnchorElement.prototype, "click")
  .mockImplementation(() => {})

afterAll(() => {
  anchorClickSpy.mockRestore()
})

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

  describe("Deferred downloads", () => {
    it("renders deferred download button", () => {
      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      expect(downloadButton).toBeInTheDocument()
    })

    it("checks URL once deferred download URL resolves", async () => {
      const user = userEvent.setup()
      const mockRequestDeferredFile = vi.fn().mockResolvedValue(
        DeferredFileResponse.create({
          url: "/media/generated_file",
          errorMsg: "",
        })
      ) as (fileId: string) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      props.endpoints.buildDownloadUrl = vi.fn(url => `resolved${url}`)

      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      // Should not check before the download starts.
      expect(props.endpoints.checkSourceUrlResponse).not.toHaveBeenCalled()

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should request deferred file
      expect(mockRequestDeferredFile).toHaveBeenCalledWith("test_file_id")

      await vi.waitFor(() => {
        expect(props.endpoints.checkSourceUrlResponse).toHaveBeenCalledWith(
          "resolved/media/generated_file",
          "Download Button"
        )
      })
    })

    it("handles successful deferred download", async () => {
      const user = userEvent.setup()
      const mockRequestDeferredFile = vi.fn().mockResolvedValue(
        DeferredFileResponse.create({
          url: "/media/generated_file",
          errorMsg: "",
        })
      ) as (fileId: string) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should request deferred file
      expect(mockRequestDeferredFile).toHaveBeenCalledWith("test_file_id")

      // Should build download URL with returned URL
      await vi.waitFor(() => {
        expect(props.endpoints.buildDownloadUrl).toHaveBeenCalledWith(
          "/media/generated_file"
        )
      })
    })

    it("shows loading state during deferred download", async () => {
      const user = userEvent.setup()
      const mockRequestDeferredFile = vi.fn().mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve(
                  DeferredFileResponse.create({
                    url: "/media/generated_file",
                    errorMsg: "",
                  })
                ),
              100
            )
          )
      ) as (fileId: string) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
        label: "Download File",
      })
      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should show spinner and keep original label
      await screen.findByTestId("stSpinnerIcon")
      expect(screen.getByText("Download File")).toBeInTheDocument()

      // Button should be disabled during loading
      expect(downloadButton).toBeDisabled()

      // Wait for completion
      await vi.waitFor(() => {
        expect(mockRequestDeferredFile).toHaveBeenCalled()
      })
    })

    it("displays error message when deferred download fails", async () => {
      const user = userEvent.setup()
      const mockRequestDeferredFile = vi.fn().mockResolvedValue(
        DeferredFileResponse.create({
          url: "",
          errorMsg: "Callable execution failed: Test error",
        })
      ) as (fileId: string) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should display error message
      await vi.waitFor(() => {
        const error = screen.getByTestId("stDownloadButtonError")
        expect(error).toHaveTextContent(
          "Callable execution failed: Test error"
        )
      })
    })

    it("displays error when request promise rejects", async () => {
      const user = userEvent.setup()
      const mockRequestDeferredFile = vi
        .fn()
        .mockRejectedValue(new Error("Network error")) as (
        fileId: string
      ) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should display error message
      await vi.waitFor(() => {
        const error = screen.getByTestId("stDownloadButtonError")
        expect(error).toHaveTextContent("Network error")
      })
    })

    it("clears error after 5 seconds", async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({ delay: null })
      const mockRequestDeferredFile = vi.fn().mockResolvedValue(
        DeferredFileResponse.create({
          url: "",
          errorMsg: "Test error",
        })
      ) as (fileId: string) => Promise<DeferredFileResponse>

      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
        label: "Download File",
      })
      renderWithContexts(<DownloadButton {...props} />, {
        downloadContext: { requestDeferredFile: mockRequestDeferredFile },
      })

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Wait for error to appear
      await vi.waitFor(() => {
        expect(screen.getByTestId("stDownloadButtonError")).toBeInTheDocument()
      })

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000)

      // Error should be cleared
      await vi.waitFor(() => {
        expect(
          screen.queryByTestId("stDownloadButtonError")
        ).not.toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it("shows error when requestDeferredFile is not provided", async () => {
      const user = userEvent.setup()
      const props = getProps({
        deferredFileId: "test_file_id",
        url: "",
      })
      // Don't provide requestDeferredFile prop
      render(<DownloadButton {...props} />)

      const downloadButton = screen.getByRole("button")
      await user.click(downloadButton)

      // Should display configuration error
      await vi.waitFor(() => {
        const error = screen.getByTestId("stDownloadButtonError")
        expect(error).toHaveTextContent(
          "Deferred download not properly configured"
        )
      })
    })
  })
})
