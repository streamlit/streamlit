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

import { IFrame as IFrameProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"

import IFrame, { IFrameProps } from "./IFrame"

const getProps = (elementProps: Partial<IFrameProto> = {}): IFrameProps => ({
  element: IFrameProto.create({
    ...elementProps,
  }),
})

/** Helper to get the iframe element with correct type for accessing contentWindow. */
const getIFrameElement = (): HTMLIFrameElement =>
  screen.getByTestId("stIFrame")

describe("st.iframe", () => {
  it("should render an iframe", () => {
    const props = getProps({})
    render(<IFrame {...props} />)
    const iframeElement = screen.getByTestId("stIFrame")
    expect(iframeElement).toBeInTheDocument()
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
        const props = getProps({ tabIndex: value })
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
      src: "foo",
      srcdoc: "bar",
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
      const props = getProps({ srcdoc: "bar" })
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute("srcdoc", "bar")
    })
  })

  describe("default policies", () => {
    it("should use default feature and sandbox policies", () => {
      const props = getProps({ src: "foo" })
      render(<IFrame {...props} />)
      const iframe = screen.getByTestId("stIFrame")
      expect(iframe).toHaveAttribute("allow", DEFAULT_IFRAME_FEATURE_POLICY)
      expect(iframe).toHaveAttribute("sandbox", DEFAULT_IFRAME_SANDBOX_POLICY)
    })
  })

  describe("Render iframe with scrolling", () => {
    it("should set scrolling to auto", () => {
      const props = getProps({
        scrolling: true,
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

  describe("useContentHeight auto-sizing behavior", () => {
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

    it("should register message event listener when useContentHeight is true", () => {
      const props = getProps({ useContentHeight: true, srcdoc: "<p>test</p>" })
      render(<IFrame {...props} />)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      )
    })

    it("should not register message event listener when useContentHeight is false", () => {
      const props = getProps({
        useContentHeight: false,
        srcdoc: "<p>test</p>",
      })
      render(<IFrame {...props} />)

      const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === "message"
      )
      expect(messageListenerCalls).toHaveLength(0)
    })

    it("should update height style when valid height message is received", async () => {
      const props = getProps({ useContentHeight: true, srcdoc: "<p>test</p>" })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      // Simulate a postMessage from the iframe's contentWindow
      // We need to dispatch a message event with the correct source
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setHeight", height: 250 },
        // Use the actual iframe's contentWindow as source, or mock it
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ height: "250px" })
      })
    })

    it("should handle height of 0 correctly", async () => {
      const props = getProps({ useContentHeight: true, srcdoc: "<p>test</p>" })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setHeight", height: 0 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ height: "0px" })
      })
    })

    it("should ignore messages from non-matching source", async () => {
      const props = getProps({ useContentHeight: true, srcdoc: "<p>test</p>" })
      render(<IFrame {...props} />)

      const iframe = getIFrameElement()

      // Dispatch message with null source (not from our iframe)
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setHeight", height: 500 },
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
      { value: NaN, description: "NaN" },
      { value: Infinity, description: "Infinity" },
      { value: -100, description: "negative" },
    ])(
      "should ignore invalid height values ($description)",
      async ({ value }) => {
        const props = getProps({
          useContentHeight: true,
          srcdoc: "<p>test</p>",
        })
        render(<IFrame {...props} />)

        const iframe = getIFrameElement()

        const messageEvent = new MessageEvent("message", {
          data: { type: "streamlit:iframe:setHeight", height: value },
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
      const props = getProps({ useContentHeight: true, srcdoc: "<p>test</p>" })
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

    it("should not apply height style when useContentHeight changes to false", async () => {
      const initialProps = getProps({
        useContentHeight: true,
        srcdoc: "<p>test</p>",
      })
      const { rerender } = render(<IFrame {...initialProps} />)

      const iframe = getIFrameElement()

      // Set a height first
      const messageEvent = new MessageEvent("message", {
        data: { type: "streamlit:iframe:setHeight", height: 300 },
        source: iframe.contentWindow,
      })
      act(() => {
        window.dispatchEvent(messageEvent)
      })

      await waitFor(() => {
        expect(iframe).toHaveStyle({ height: "300px" })
      })

      // Now rerender with useContentHeight = false
      const updatedProps = getProps({
        useContentHeight: false,
        srcdoc: "<p>test</p>",
      })
      rerender(<IFrame {...updatedProps} />)

      // Height style should not be applied when useContentHeight is false
      // The heightStyle becomes {} so height should not be set
      expect(iframe).not.toHaveStyle({ height: "300px" })
    })
  })
})
