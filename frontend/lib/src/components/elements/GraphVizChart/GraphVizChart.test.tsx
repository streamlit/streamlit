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

import { screen } from "@testing-library/react"
import { graphviz } from "d3-graphviz"
import { Mock, MockInstance } from "vitest"

import { GraphVizChart as GraphVizChartProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"

import GraphVizChart, {
  GraphVizChartProps,
  LOG,
  sanitizeGraphVizLinkUris,
} from "./GraphVizChart"

interface MockGraphvizChain {
  zoom: () => MockGraphvizChain
  width: () => MockGraphvizChain
  height: () => MockGraphvizChain
  fit: () => MockGraphvizChain
  scale: () => MockGraphvizChain
  engine: () => MockGraphvizChain
  renderDot: Mock
}

const createChainableMethods = (renderDotImpl?: Mock): MockGraphvizChain => {
  const chainable = {
    zoom: () => chainable,
    width: () => chainable,
    height: () => chainable,
    fit: () => chainable,
    scale: () => chainable,
    engine: () => chainable,
    renderDot:
      renderDotImpl ||
      vi.fn((_spec: string, callback?: () => void) => {
        callback?.()

        return {
          on: vi.fn(),
        }
      }),
  }
  return chainable
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"

const appendSvgLink = (
  container: Element,
  attributes: Record<string, string>
): SVGElement => {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg")
  const link = document.createElementNS(SVG_NAMESPACE, "a")

  Object.entries(attributes).forEach(([attributeName, attributeValue]) => {
    if (attributeName === "xlink:href") {
      link.setAttributeNS(XLINK_NAMESPACE, attributeName, attributeValue)
    } else {
      link.setAttribute(attributeName, attributeValue)
    }
  })

  svg.appendChild(link)
  container.appendChild(svg)

  return link
}

const setupMockRenderDot = (renderDotImpl: Mock): void => {
  ;(graphviz as Mock).mockReturnValue(createChainableMethods(renderDotImpl))
}

vi.mock("d3-graphviz", () => ({
  graphviz: vi.fn(() => createChainableMethods()),
}))

const getProps = (
  elementProps: Partial<GraphVizChartProto> = {}
): GraphVizChartProps => ({
  element: GraphVizChartProto.create({
    spec: `digraph "Hello World" {Hello -> World}`,
    elementId: "1",
    ...elementProps,
  }),
})

describe("GraphVizChart Element", () => {
  let logErrorSpy: MockInstance

  beforeEach(() => {
    logErrorSpy = vi.spyOn(LOG, "error").mockImplementation(() => {})

    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    // @ts-expect-error
    graphviz.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<GraphVizChart {...props} />)

    const graphvizElement = screen.getByTestId("stGraphVizChart")
    expect(graphvizElement).toBeInTheDocument()
    expect(graphvizElement).toHaveClass("stGraphVizChart")

    expect(logErrorSpy).not.toHaveBeenCalled()
    expect(graphviz).toHaveBeenCalled()
  })

  it("should update chart and log error when crashes", () => {
    // Mock graphviz().renderDot() to throw an error for the "crash" spec
    const mockRenderDot = vi.fn().mockImplementation(spec => {
      if (spec === "crash") {
        throw new Error("Simulated GraphViz crash")
      }
      return {
        on: vi.fn(),
      }
    })

    setupMockRenderDot(mockRenderDot)

    const props = getProps({
      spec: "crash",
    })

    render(<GraphVizChart {...props} />)

    expect(logErrorSpy).toHaveBeenCalledTimes(1)
    expect(mockRenderDot).toHaveBeenCalledWith("crash", expect.any(Function))
    expect(graphviz).toHaveBeenCalledTimes(1)
  })

  it("should render with height and width set to auto", () => {
    const props = {
      ...getProps(),
    }
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toHaveStyle(
      "height: auto; width: auto"
    )
  })

  const renderWithSvgLink = (
    attributes: Record<string, string>
  ): Element | null => {
    const mockRenderDot = vi.fn((_spec: string, callback?: () => void) => {
      appendSvgLink(screen.getByTestId("stGraphVizChart"), attributes)

      callback?.()

      return {
        on: vi.fn(),
      }
    })
    setupMockRenderDot(mockRenderDot)

    render(<GraphVizChart {...getProps()} />)

    return screen.getByTestId("stGraphVizChart").querySelector("a")
  }

  it("sanitizes dangerous Graphviz link URLs after rendering", () => {
    const link = renderWithSvgLink({
      href: "vbscript:alert(1)",
      "xlink:href": "\u0001java\nscript:alert(1)",
    })

    expect(link).not.toBeNull()
    expect(link?.getAttribute("href")).toBe("#")
    expect(link?.getAttributeNS(XLINK_NAMESPACE, "href")).toBe("#")
  })

  it("preserves safe Graphviz link URLs", () => {
    const link = renderWithSvgLink({
      href: "#details",
      "xlink:href": "https://streamlit.io",
    })

    expect(link).not.toBeNull()
    expect(link?.getAttribute("href")).toBe("#details")
    expect(link?.getAttributeNS(XLINK_NAMESPACE, "href")).toBe(
      "https://streamlit.io"
    )
  })

  it("sanitizes rendered SVG links directly", () => {
    const container = document.createElement("div")
    const link = appendSvgLink(container, {
      "xlink:href": "JAVASCRIPT:alert(1)",
    })

    sanitizeGraphVizLinkUris(container)

    expect(link.getAttributeNS(XLINK_NAMESPACE, "href")).toBe("#")
  })

  it("sanitizes xlink:href set as a plain qualified attribute", () => {
    const container = document.createElement("div")
    const svg = document.createElementNS(SVG_NAMESPACE, "svg")
    const link = document.createElementNS(SVG_NAMESPACE, "a")
    // Set xlink:href by qualified name (no namespace) to exercise the
    // getAttribute("xlink:href") branch.
    link.setAttribute("xlink:href", "javascript:alert(1)")
    svg.appendChild(link)
    container.appendChild(svg)

    sanitizeGraphVizLinkUris(container)

    expect(link.getAttribute("xlink:href")).toBe("#")
  })
})
