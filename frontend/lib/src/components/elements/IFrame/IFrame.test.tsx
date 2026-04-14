/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { act, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest"

import { IFrame as IFrameProto, streamlit } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"

import IFrame, { IFrameProps } from "./IFrame"

const getProps = ({
  elementProps = {},
  widthConfig,
  heightConfig,
}: {
  elementProps?: Partial<IFrameProto>
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
} = {}): IFrameProps => ({
  element: IFrameProto.create({
    ...elementProps,
  }),
  widthConfig,
  heightConfig,
})

/** Helper to get the iframe element with correct type for accessing contentWindow. */
const getIFrameElement = (): HTMLIFrameElement =>
  screen.getByTestId("stIFrame")

describe("st.iframe", () => {
  it("should render an iframe", () => {
    const props = getProps({})
    render(<IFrame {...props} />)
    const iframeElement = screen.getByTestId("stIFrame")
    expect(iframeElement).toBeVisible()
    expect(iframeElement).toHaveClass("stIFrame")
  })

  describe("tabIndex attribute", () => {
    it("should not have tabIndex attribute when not provided", () => {
      const props = getProps({})
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).not.toHaveAttribute("tabindex")
    })

    it.each([
      { value: 5, expected: "5", description: "positive" },
      { value: -1, expected: "-1", description: "negative" },
      { value: 0, expected: "0", description: "zero" },
    ])(
      "should set tabIndex to $description value when provided",
      ({ value, expected }) => {
        const props = getProps({ elementProps: { tabIndex: value } })
        render(<IFrame {...props} />)
        expect(screen.getByTestId("stIFrame")).toHaveAttribute(
          "tabindex",
          expected
        )
      }
    )
  })

  describe("Render iframe with `src` parameter", () => {
    const props = getProps({
      elementProps: {
        src: "foo",
        srcdoc: "bar",
      },
    })

    it("should set `srcDoc` to undefined if src is defined", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).not.toHaveAttribute("srcdoc")
    })

    it("should set `src`", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute("src", "foo")
    })
  })

  describe("Render iframe with `srcDoc` parameter", () => {
    it("should set `srcDoc`", () => {
      const props = getProps({ elementProps: { srcdoc: "bar" } })
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute("srcdoc", "bar")
    })
  })

  describe("default policies", () => {
    it("should use default feature and sandbox policies", () => {
      const props = getProps({ elementProps: { src: "foo" } })
      render(<IFrame {...props} />)
      const iframe = screen.getByTestId("stIFrame")
      expect(iframe).toHaveAttribute("allow", DEFAULT_IFRAME_FEATURE_POLICY)
      expect(iframe).toHaveAttribute("sandbox", DEFAULT_IFRAME_SANDBOX_POLICY)
    })
  })

  describe("Render iframe with scrolling", () => {
    it("should set scrolling to auto", () => {
      const props = getProps({
        elementProps: { scrolling: true },
      })
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute(
        "scrolling",
        "auto"
      )
      expect(screen.getByTestId("stIFrame")).not.toHaveStyle(
        "overflow: hidden"
      )
    })

    it("should set `overflow` to hidden", () => {
      const props = getProps({})
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveStyle("overflow: hidden")
      expect(screen.getByTestId("stIFrame")).toHaveAttribute("scrolling", "no")
    })
  })

  describe("content-based auto-sizing behavior", () => {
    let addEventListenerSpy: Mock
    let removeEventListenerSpy: Mock
    let originalAddEventListener: typeof window.addEventListener
    let originalRemoveEventListener: typeof window.removeEventListener

    beforeEach(() => {
      originalAddEventListener = window.addEventListener
      originalRemoveEventListener = window.removeEventListener
      addEventListenerSpy = vi.fn(originalAddEventListener.bind(window))
      removeEventListenerSpy = vi.fn(originalRemoveEventListener.bind(window))
      window.addEventListener = addEventListenerSpy
      window.removeEventListener = removeEventListenerSpy
    })

    afterEach(() => {
      window.addEventListener = originalAddEventListener
      window.removeEventListener = originalRemoveEventListener
    })

    it("should inject auto-size script into srcdoc when heightConfig.useContent is true", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()
      const srcDoc = iframe.getAttribute("srcdoc")
      expect(srcDoc).toContain("<p>test</p>")
      expect(srcDoc).toContain("streamlit:iframe:setSize")
      expect(srcDoc).toContain("<script>")
    })

    it("should inject auto-size script into srcdoc when widthConfig.useContent is true", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        widthConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()
      const srcDoc = iframe.getAttribute("srcdoc")
      expect(srcDoc).toContain("streamlit:iframe:setSize")
    })

    it("should not inject script when useContent is false", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useStretch: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()
      const srcDoc = iframe.getAttribute("srcdoc")
      expect(srcDoc).toBe("<p>test</p>")
      expect(srcDoc).not.toContain("streamlit:iframe:setSize")
    })

    it("should register message event listener when heightConfig.useContent is true", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      )
    })

    it("should register message event listener when widthConfig.useContent is true", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        widthConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      )
    })

    it("should not register message event listener when useContent is false", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useStretch: true },
        widthConfig: { useStretch: true },
      })
      render(<IFrame {...props} />)

      const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === "message"
      )
      expect(messageListenerCalls).toHaveLength(0)
    })

    it("should not register message event listener for URL sources", () => {
      const props = getProps({
        elementProps: { src: "https://example.com" },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === "message"
      )
      expect(messageListenerCalls).toHaveLength(0)
    })

    it("should update height style when valid size message is received", async () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      // Simulate a postMessage from the iframe's contentWindow
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 300, height: 250 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ height: "250px" })
      })
    })

    it("should update width style when valid size message is received", async () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        widthConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 300, height: 250 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ width: "300px" })
      })
    })

    it("should update both width and height when both useContent are true", async () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        widthConfig: { useContent: true },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 300, height: 250 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ width: "300px", height: "250px" })
      })
    })

    it("should handle dimensions of 0 correctly", async () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        widthConfig: { useContent: true },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 0, height: 0 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ width: "0px", height: "0px" })
      })
    })

    it("should ignore messages from non-matching source", async () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
      })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      // Dispatch message with null source (not from our iframe)
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 300, height: 500 },
        source: null,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      // Height should not be set
      await waitFor(
        () => {
          expect(iframe).not.toHaveAttribute("style")
        },
        { timeout: 100 }
      )
    })

    it.each([
      { width: NaN, height: 100, description: "NaN width" },
      { width: 100, height: NaN, description: "NaN height" },
      { width: Infinity, height: 100, description: "Infinity width" },
      { width: 100, height: -100, description: "negative height" },
      { width: -100, height: 100, description: "negative width" },
    ])(
      "should ignore invalid dimension values ($description)",
      async ({ width, height }) => {
        const props = getProps({
          elementProps: { srcdoc: "<p>test</p>" },
          heightConfig: { useContent: true },
          widthConfig: { useContent: true },
        })
        render(<IFrame {...props} />)

        const iframe = getIFrameElement()

        const messageEvent = new MessageEvent("message", {
          data: { type: "streamlit:iframe:setSize", width, height },
          source: iframe.contentWindow,
        })
        act(() => {
          window.dispatchEvent(messageEvent)
        })

        await waitFor(
          () => {
            expect(iframe).not.toHaveAttribute("style")
          },
          { timeout: 100 }
        )
      }
    )

    it("should clean up event listener on unmount", () => {
      const props = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
      })
      const { unmount } = render(<IFrame {...props} />)

      // Get the handler that was registered
      const messageHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === "message"
      )?.[1]

      expect(messageHandler).toBeDefined()

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        messageHandler
      )
    })

    it("should not apply dimension styles when configs change to not use content", async () => {
      const initialProps = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useContent: true },
        widthConfig: { useContent: true },
      })
      const { rerender } = render(<IFrame {...initialProps} />)

      const iframe = getIFrameElement()

      // Set dimensions first
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setSize", width: 200, height: 300 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ width: "200px", height: "300px" })
      })

      // Now rerender with useContent = false
      const updatedProps = getProps({
        elementProps: { srcdoc: "<p>test</p>" },
        heightConfig: { useStretch: true },
        widthConfig: { useStretch: true },
      })
      rerender(<IFrame {...updatedProps} />)

      // Dimension styles should not be applied when useContent is false
      expect(iframe).not.toHaveStyle({ width: "200px" })
      expect(iframe).not.toHaveStyle({ height: "300px" })
    })
  })
})
