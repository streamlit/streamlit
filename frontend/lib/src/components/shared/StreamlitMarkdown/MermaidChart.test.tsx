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

import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { render } from "~lib/test_util"

import { MermaidChart } from "./MermaidChart"

const SAMPLE_SOURCE = "flowchart TD\nA-->B"

const SAMPLE_SVG_WITH_VIEWBOX =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>'

const SAMPLE_SVG_WITH_DIMENSIONS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="80"><rect width="150" height="80"/></svg>'

const mockWriteText = vi.fn().mockResolvedValue(undefined)

function mockMermaidSuccess(svg = SAMPLE_SVG_WITH_VIEWBOX): {
  initialize: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
} {
  const initialize = vi.fn()
  const renderFn = vi.fn().mockResolvedValue({ svg })

  vi.doMock("mermaid", () => ({
    default: {
      initialize,
      render: renderFn,
    },
  }))

  return { initialize, render: renderFn }
}

async function waitForChartImage(): Promise<HTMLElement> {
  return waitFor(
    () => {
      const img = screen.getByRole("img")
      expect(img).toBeVisible()
      return img
    },
    { timeout: 5000 }
  )
}

async function waitForMermaidError(): Promise<HTMLElement> {
  return waitFor(
    () => {
      const error = screen.getByTestId("stMermaidError")
      expect(error).toBeVisible()
      return error
    },
    { timeout: 5000 }
  )
}

function stubImageLoad(mode: "load" | "error"): void {
  class MockImage {
    onload: ((this: MockImage, ev: Event) => void) | null = null
    onerror: ((this: MockImage, ev: Event) => void) | null = null
    naturalWidth = mode === "load" ? 200 : 0
    naturalHeight = mode === "load" ? 100 : 0
    set src(_value: string) {
      if (mode === "load") {
        this.onload?.(new Event("load"))
      } else {
        this.onerror?.(new Event("error"))
      }
    }
  }
  vi.stubGlobal("Image", MockImage)
}

describe("MermaidChart", () => {
  // Capture the original clipboard descriptor (if any) so the mock installed
  // below can be fully restored in afterEach and does not leak across tests.
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  )

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => "blob:mermaid-test")
    global.URL.revokeObjectURL = vi.fn()
    mockWriteText.mockClear()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockWriteText },
    })
  })

  afterEach(() => {
    vi.doUnmock("mermaid")
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (originalClipboardDescriptor) {
      Object.defineProperty(
        navigator,
        "clipboard",
        originalClipboardDescriptor
      )
    } else {
      Reflect.deleteProperty(navigator, "clipboard")
    }
  })

  it("renders loading skeleton initially and error element is not present", () => {
    // Keep mermaid pending so loading UI stays visible for this assertion.
    vi.doMock("mermaid", () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    }))

    render(<MermaidChart source="graph TD\nA-->B" />)
    expect(screen.getByTestId("stMermaidChart")).toBeVisible()
    // Verify loading state is indicated via aria-busy
    expect(screen.getByTestId("stMermaidChart")).toHaveAttribute(
      "aria-busy",
      "true"
    )
    // The loading placeholder uses the internal "stSkeleton" test ID (tracked
    // by the app-loaded gate), not the public "stSkeletonElement" element.
    expect(screen.getByTestId("stSkeleton")).toBeVisible()
    expect(screen.queryByTestId("stSkeletonElement")).not.toBeInTheDocument()
    // Negative assertion: error element should not be present during loading
    expect(screen.queryByTestId("stMermaidError")).not.toBeInTheDocument()
  })

  it("shows error state when mermaid import fails", async () => {
    // Mock the dynamic import to reject
    vi.doMock("mermaid", () => {
      throw new Error("Failed to load mermaid")
    })

    render(<MermaidChart source="graph TD\nA-->B" />)

    const error = await waitForMermaidError()
    expect(error).toHaveTextContent("Mermaid diagram error")
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows a generic error message when render rejects with a non-Error", async () => {
    vi.doMock("mermaid", () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn().mockRejectedValue("boom"),
      },
    }))

    render(<MermaidChart source="graph TD\nA-->B" />)

    await waitForMermaidError()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Mermaid diagram error: Failed to render diagram"
    )
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("locks security-sensitive config keys against %%{init}%% directive overrides", async () => {
    const { initialize } = mockMermaidSuccess()

    render(<MermaidChart source="graph TD\nA-->B" />)

    await waitFor(
      () => {
        expect(initialize).toHaveBeenCalled()
      },
      { timeout: 5000 }
    )

    const config = initialize.mock.calls[0][0]
    expect(config.securityLevel).toBe("strict")
    // Locked set must include Mermaid defaults plus Streamlit hardening keys.
    expect(config.secure).toEqual([
      // Mermaid defaults
      "secure",
      "securityLevel",
      "startOnLoad",
      "maxTextSize",
      "suppressErrorRendering",
      "maxEdges",
      // Streamlit hardening
      "htmlLabels",
      "themeCSS",
      "fontFamily",
      "altFontFamily",
      "dompurifyConfig",
    ])
  })

  it.each([
    {
      name: "a successful mermaid render",
      svg: SAMPLE_SVG_WITH_VIEWBOX,
      assertExtra: () => {
        expect(screen.queryByTestId("stMermaidError")).not.toBeInTheDocument()
        expect(screen.queryByTestId("stSkeleton")).not.toBeInTheDocument()
      },
    },
    {
      name: "SVG with width/height but no viewBox",
      svg: SAMPLE_SVG_WITH_DIMENSIONS,
      assertExtra: () => {
        expect(global.URL.createObjectURL).toHaveBeenCalled()
      },
    },
    {
      name: "markup without an svg root",
      svg: "<div>not an svg</div>",
      assertExtra: undefined,
    },
  ])("renders the diagram image for $name", async ({ svg, assertExtra }) => {
    mockMermaidSuccess(svg)

    render(<MermaidChart source={SAMPLE_SOURCE} />)

    const img = await waitForChartImage()
    expect(img).toHaveAttribute("src", "blob:mermaid-test")
    assertExtra?.()
  })

  describe("accessible alt text", () => {
    beforeEach(() => {
      mockMermaidSuccess()
    })

    it.each([
      {
        name: "title and description",
        source: [
          "flowchart TD",
          "accTitle: Checkout flow",
          "accDescr: Steps from cart to payment",
          "A-->B",
        ].join("\n"),
        expectedAlt: "Checkout flow: Steps from cart to payment",
      },
      {
        name: "title only",
        source: ["flowchart TD", "accTitle: Order status", "A-->B"].join("\n"),
        expectedAlt: "Order status",
      },
      {
        name: "single-line description only",
        source: [
          "flowchart TD",
          "accDescr: User authentication path",
          "A-->B",
        ].join("\n"),
        expectedAlt: "User authentication path",
      },
      {
        name: "multi-line brace description only",
        source: [
          "flowchart TD",
          "accDescr {",
          "  First line",
          "  Second line",
          "}",
          "A-->B",
        ].join("\n"),
        expectedAlt: "First line Second line",
      },
    ])(
      "uses $name from accessibility directives",
      async ({ source, expectedAlt }) => {
        render(<MermaidChart source={source} />)

        const img = await waitForChartImage()
        expect(img).toHaveAttribute("alt", expectedAlt)
      }
    )

    it.each([
      {
        keyword: "flowchart",
        source: "flowchart TD\nA-->B",
        expectedAlt: "Mermaid flowchart",
      },
      {
        keyword: "graph",
        source: "graph TD\nA-->B",
        expectedAlt: "Mermaid flowchart",
      },
      {
        keyword: "sequenceDiagram",
        source: "sequenceDiagram\nA->>B: Hi",
        expectedAlt: "Mermaid sequence diagram",
      },
      {
        keyword: "classDiagram",
        source: "classDiagram\nAnimal <|-- Duck",
        expectedAlt: "Mermaid class diagram",
      },
      {
        keyword: "pie",
        source: 'pie\ntitle Pets\n"Dogs": 386',
        expectedAlt: "Mermaid pie chart",
      },
      {
        keyword: "unknown",
        source: "notARealDiagram\nA-->B",
        expectedAlt: "Mermaid diagram",
      },
    ])(
      "falls back to diagram-type alt text for $keyword",
      async ({ source, expectedAlt }) => {
        render(<MermaidChart source={source} />)

        const img = await waitForChartImage()
        expect(img).toHaveAttribute("alt", expectedAlt)
      }
    )
  })

  describe("toolbar actions", () => {
    beforeEach(() => {
      mockMermaidSuccess()
    })

    it("copies the mermaid source when the copy toolbar action is clicked", async () => {
      render(<MermaidChart source={SAMPLE_SOURCE} />)
      await waitForChartImage()

      // Toolbar is opacity:0 until hover; fireEvent avoids userEvent visibility checks.
      // eslint-disable-next-line testing-library/prefer-user-event -- opacity:0 toolbar blocks userEvent
      fireEvent.click(
        screen.getByRole("button", { name: "Copy to clipboard" })
      )

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(SAMPLE_SOURCE)
      })
    })

    it("exposes download and copy toolbar actions after render", async () => {
      render(<MermaidChart source={SAMPLE_SOURCE} />)
      await waitForChartImage()

      // Toolbar is opacity:0 until hover — presence in the DOM is enough.
      expect(
        screen.getByRole("button", { name: "Download as PNG" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Copy to clipboard" })
      ).toBeInTheDocument()
    })

    it("downloads a PNG when the download toolbar action succeeds", async () => {
      stubImageLoad("load")

      const drawImage = vi.fn()
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        fillStyle: "",
        fillRect: vi.fn(),
        scale: vi.fn(),
        drawImage,
      } as unknown as CanvasRenderingContext2D)
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
        "data:image/png;base64,abc"
      )
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined)

      render(<MermaidChart source={SAMPLE_SOURCE} />)
      await waitForChartImage()

      // eslint-disable-next-line testing-library/prefer-user-event -- opacity:0 toolbar blocks userEvent
      fireEvent.click(screen.getByRole("button", { name: "Download as PNG" }))

      await waitFor(() => {
        expect(anchorClick).toHaveBeenCalled()
      })
      expect(drawImage).toHaveBeenCalled()
      expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
        "image/png"
      )
    })

    it("handles PNG download image load failures without throwing", async () => {
      stubImageLoad("error")
      const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click")

      render(<MermaidChart source={SAMPLE_SOURCE} />)
      await waitForChartImage()

      // eslint-disable-next-line testing-library/prefer-user-event -- opacity:0 toolbar blocks userEvent
      fireEvent.click(screen.getByRole("button", { name: "Download as PNG" }))

      // onerror is synchronous via the MockImage setter; no download link click.
      expect(anchorClick).not.toHaveBeenCalled()
    })
  })
})
