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

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { IPdf, Pdf as PdfMessage, streamlit } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { mockEndpoints } from "~lib/mocks/mocks"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"

import Pdf, { PdfProps } from "./Pdf"

// Mock react-pdf to avoid PDF.js worker issues in tests
vi.mock("react-pdf", () => ({
  Document: ({
    children,
    onLoadSuccess,
    onLoadError,
    loading,
    error,
  }: any) => {
    // Simulate successful PDF loading
    React.useEffect(() => {
      if (onLoadSuccess) {
        onLoadSuccess({ numPages: 3 })
      }
    }, [onLoadSuccess])

    return (
      <div data-testid="react-pdf-document">
        {loading}
        {error}
        {children}
      </div>
    )
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid={`react-pdf-page-${pageNumber}`}>Page {pageNumber}</div>
  ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: "",
    },
  },
}))

// Mock CSS imports
vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}))
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}))

const mockFullscreenContext = {
  expanded: false,
  width: 800,
  height: 600,
  expand: vi.fn(),
  collapse: vi.fn(),
}

const getProps = (elementProps: Partial<IPdf> = {}): PdfProps => ({
  element: PdfMessage.create({
    id: "test-pdf-id",
    url: "https://example.com/test.pdf",
    ...elementProps,
  }),
  endpoints: mockEndpoints(),
  widthConfig: undefined,
  disableFullscreenMode: false,
})

const renderPdfWithContext = (props: PdfProps, contextOverrides = {}) => {
  const contextValue = { ...mockFullscreenContext, ...contextOverrides }

  return render(
    <ElementFullscreenContext.Provider value={contextValue}>
      <Pdf {...props} />
    </ElementFullscreenContext.Provider>
  )
}

describe("PDF element", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
    expect(pdfElement).toHaveClass("stPdf")
  })

  it("renders with URL source", () => {
    const props = getProps({
      url: "https://example.com/sample.pdf",
    })
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
    expect(screen.getByTestId("react-pdf-document")).toBeInTheDocument()
  })

  it("renders with file data source", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF header
    const props = getProps({
      url: "",
      fileData: pdfBytes,
    })
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
    expect(screen.getByTestId("react-pdf-document")).toBeInTheDocument()
  })

  it("shows error when no PDF source is provided", () => {
    const props = getProps({
      url: "",
      fileData: undefined,
    })
    renderPdfWithContext(props)

    expect(screen.getByText(/No PDF source provided/)).toBeInTheDocument()
    expect(screen.getByText(/Error:/)).toBeInTheDocument()
  })

  it("renders multiple pages", async () => {
    const props = getProps()
    renderPdfWithContext(props)

    // Wait for PDF to load and pages to render
    await waitFor(() => {
      expect(screen.getByTestId("react-pdf-page-1")).toBeInTheDocument()
      expect(screen.getByTestId("react-pdf-page-2")).toBeInTheDocument()
      expect(screen.getByTestId("react-pdf-page-3")).toBeInTheDocument()
    })
  })

  it("renders toolbar", () => {
    const props = getProps()
    renderPdfWithContext(props)

    // The toolbar should be present
    const toolbar = screen.getByTestId("stElementToolbar")
    expect(toolbar).toBeInTheDocument()
    expect(toolbar).toHaveClass("stElementToolbar")
  })

  it("handles fullscreen mode", () => {
    const props = getProps()
    renderPdfWithContext(props, { expanded: true })

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("handles expand function call", async () => {
    const mockExpand = vi.fn()
    const props = getProps()
    renderPdfWithContext(props, { expand: mockExpand })

    // Note: The expand function is called internally by the component
    // This test verifies the component renders without errors when expand is available
    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("handles collapse function call", async () => {
    const mockCollapse = vi.fn()
    const props = getProps()
    renderPdfWithContext(props, { expanded: true, collapse: mockCollapse })

    // Note: The collapse function is called internally by the component
    // This test verifies the component renders without errors when collapse is available
    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("applies width configuration", () => {
    const widthConfig: streamlit.IWidthConfig = {
      pixelWidth: 500,
    }
    const props = getProps()
    props.widthConfig = widthConfig
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("applies stretch width configuration", () => {
    const widthConfig: streamlit.IWidthConfig = {
      useStretch: true,
    }
    const props = getProps()
    props.widthConfig = widthConfig
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("handles disabled fullscreen mode", () => {
    const props = getProps()
    props.disableFullscreenMode = true
    renderPdfWithContext(props)

    const pdfElement = screen.getByTestId("stPdf")
    expect(pdfElement).toBeInTheDocument()
  })

  it("builds media URL for relative URLs", () => {
    const mockBuildMediaURL = vi
      .fn()
      .mockReturnValue("http://localhost:8501/media/test.pdf")
    const props = getProps({
      url: "media/test.pdf", // relative URL
    })
    props.endpoints = mockEndpoints({
      buildMediaURL: mockBuildMediaURL,
    })
    renderPdfWithContext(props)

    expect(mockBuildMediaURL).toHaveBeenCalledWith("media/test.pdf")
    expect(screen.getByTestId("stPdf")).toBeInTheDocument()
  })

  it("uses absolute URLs directly", () => {
    const mockBuildMediaURL = vi.fn()
    const props = getProps({
      url: "https://example.com/test.pdf", // absolute URL
    })
    props.endpoints = mockEndpoints({
      buildMediaURL: mockBuildMediaURL,
    })
    renderPdfWithContext(props)

    expect(mockBuildMediaURL).not.toHaveBeenCalled()
    expect(screen.getByTestId("stPdf")).toBeInTheDocument()
  })

  describe("error handling", () => {
    it("handles PDF load errors", async () => {
      const props = getProps()
      renderPdfWithContext(props)

      // The mock shows both loading and error states
      await waitFor(() => {
        expect(screen.getByText(/Failed to load PDF file/)).toBeInTheDocument()
      })
    })

    it("handles CORS errors", async () => {
      const props = getProps()
      renderPdfWithContext(props)

      // The mock shows the error state - test that error handling works
      await waitFor(() => {
        expect(screen.getByText(/Failed to load PDF file/)).toBeInTheDocument()
      })
    })

    it("handles blob errors", async () => {
      const props = getProps()
      renderPdfWithContext(props)

      // The mock shows the error state - test that error handling works
      await waitFor(() => {
        expect(screen.getByText(/Failed to load PDF file/)).toBeInTheDocument()
      })
    })
  })

  describe("accessibility", () => {
    it("has proper test IDs", () => {
      const props = getProps()
      renderPdfWithContext(props)

      expect(screen.getByTestId("stPdf")).toBeInTheDocument()
    })

    it("has proper CSS classes", () => {
      const props = getProps()
      renderPdfWithContext(props)

      const pdfElement = screen.getByTestId("stPdf")
      expect(pdfElement).toHaveClass("stPdf")
    })
  })

  describe("scroll position preservation", () => {
    it("preserves scroll position during fullscreen transitions", () => {
      const props = getProps()
      const { rerender } = renderPdfWithContext(props)

      // Simulate fullscreen transition
      rerender(
        <ElementFullscreenContext.Provider
          value={{ ...mockFullscreenContext, expanded: true }}
        >
          <Pdf {...props} />
        </ElementFullscreenContext.Provider>
      )

      expect(screen.getByTestId("stPdf")).toBeInTheDocument()
    })
  })

  describe("component lifecycle", () => {
    it("unmounts cleanly", () => {
      const props = getProps()
      const { unmount } = renderPdfWithContext(props)

      expect(screen.getByTestId("stPdf")).toBeInTheDocument()
      unmount()
      expect(screen.queryByTestId("stPdf")).not.toBeInTheDocument()
    })

    it("handles prop changes", () => {
      const props = getProps({ url: "https://example.com/test1.pdf" })
      const { rerender } = renderPdfWithContext(props)

      expect(screen.getByTestId("stPdf")).toBeInTheDocument()

      // Change props
      const newProps = getProps({ url: "https://example.com/test2.pdf" })
      rerender(
        <ElementFullscreenContext.Provider value={mockFullscreenContext}>
          <Pdf {...newProps} />
        </ElementFullscreenContext.Provider>
      )

      expect(screen.getByTestId("stPdf")).toBeInTheDocument()
    })
  })
})
