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

import { fireEvent, screen } from "@testing-library/react"

import { IFrame as IFrameProto, streamlit } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"

import IFrame, { IFrameProps } from "./IFrame"

let resizeObserverCallback: ResizeObserverCallback | undefined

class MockResizeObserver {
  observe = vi.fn()

  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }
}

const getProps = ({
  elementProps = {},
  heightConfig,
  widthConfig,
}: {
  elementProps?: Partial<IFrameProto>
  heightConfig?: streamlit.IHeightConfig | null
  widthConfig?: streamlit.IWidthConfig | null
} = {}): IFrameProps => ({
  element: IFrameProto.create({
    ...elementProps,
  }),
  heightConfig,
  widthConfig,
})

const mockIframeDocument = (
  iframeElement: HTMLElement,
  {
    height = 180,
    width = 320,
  }: {
    height?: number
    width?: number
  } = {}
): void => {
  const documentElement = {
    clientHeight: height,
    clientWidth: width,
    offsetHeight: height,
    offsetWidth: width,
    scrollHeight: height,
    scrollWidth: width,
  } as unknown as HTMLElement

  const body = {
    clientHeight: height,
    clientWidth: width,
    offsetHeight: height,
    offsetWidth: width,
    scrollHeight: height,
    scrollWidth: width,
  } as unknown as HTMLBodyElement

  const document = {
    body,
    documentElement,
    readyState: "complete",
  } as unknown as Document

  Object.defineProperty(iframeElement, "contentDocument", {
    configurable: true,
    value: document,
  })
  Object.defineProperty(iframeElement, "contentWindow", {
    configurable: true,
    value: { document },
  })
}

describe("st.iframe", () => {
  beforeEach(() => {
    resizeObserverCallback = undefined
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should render an iframe", () => {
    const props = getProps()
    render(<IFrame {...props} />)
    const iframeElement = screen.getByTestId("stIFrame")
    expect(iframeElement).toBeInTheDocument()
    expect(iframeElement).toHaveClass("stIFrame")
  })

  describe("tabIndex attribute", () => {
    it("should not have tabIndex attribute when not provided", () => {
      const props = getProps()
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
        const props = getProps({
          elementProps: {
            tabIndex: value,
          },
        })
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

    it("should use our default feature policy", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute(
        "allow",
        DEFAULT_IFRAME_FEATURE_POLICY
      )
    })

    it("should use our default sandbox policy", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute(
        "sandbox",
        DEFAULT_IFRAME_SANDBOX_POLICY
      )
    })
  })

  describe("Render iframe with `srcDoc` parameter", () => {
    const props = getProps({
      elementProps: {
        srcdoc: "bar",
      },
    })

    it("should set `srcDoc`", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute("srcdoc", "bar")
    })

    it("should use our default feature policy", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute(
        "allow",
        DEFAULT_IFRAME_FEATURE_POLICY
      )
    })

    it("should use our default sandbox policy", () => {
      render(<IFrame {...props} />)
      expect(screen.getByTestId("stIFrame")).toHaveAttribute(
        "sandbox",
        DEFAULT_IFRAME_SANDBOX_POLICY
      )
    })
  })

  describe("Render iframe with scrolling", () => {
    it("should set scrolling to auto", () => {
      const props = getProps({
        elementProps: {
          scrolling: true,
        },
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

  describe("content sizing", () => {
    it("measures srcdoc height when height uses content sizing", () => {
      const props = getProps({
        elementProps: {
          srcdoc: "<p>Hello</p>",
        },
        heightConfig: new streamlit.HeightConfig({ useContent: true }),
      })

      render(<IFrame {...props} />)

      const iframeElement = screen.getByTestId("stIFrame")
      mockIframeDocument(iframeElement, { height: 222 })

      fireEvent.load(iframeElement)

      expect(iframeElement).toHaveStyle("height: 222px")
      expect(iframeElement).not.toHaveStyle("height: 100%")
    })

    it("updates measured width and height when iframe content resizes", () => {
      const props = getProps({
        elementProps: {
          srcdoc: "<p>Hello</p>",
        },
        heightConfig: new streamlit.HeightConfig({ useContent: true }),
        widthConfig: new streamlit.WidthConfig({ useContent: true }),
      })

      render(<IFrame {...props} />)

      const iframeElement = screen.getByTestId("stIFrame")
      mockIframeDocument(iframeElement, { height: 180, width: 280 })
      fireEvent.load(iframeElement)

      expect(iframeElement).toHaveStyle("height: 180px")
      expect(iframeElement).toHaveStyle("width: 280px")

      mockIframeDocument(iframeElement, { height: 360, width: 420 })
      resizeObserverCallback?.([], {} as ResizeObserver)

      expect(iframeElement).toHaveStyle("height: 360px")
      expect(iframeElement).toHaveStyle("width: 420px")
      expect(iframeElement).not.toHaveStyle("width: 100%")
    })
  })
})
