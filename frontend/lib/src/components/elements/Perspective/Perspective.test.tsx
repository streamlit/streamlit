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

import { Perspective as PerspectiveProto } from "@streamlit/protobuf"

import { render } from "~lib/components/shared/ElementFullscreen/testUtils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Perspective, { PerspectiveProps } from "./Perspective"
import { usePerspective } from "./usePerspective"

// Mock the usePerspective hook to avoid WASM initialization in tests
vi.mock("./usePerspective", () => ({
  usePerspective: vi.fn(() => ({
    viewerRef: { current: null },
    isInitialized: false,
    error: null,
  })),
}))

const mockWidgetMgr = new WidgetStateManager({
  sendRerunBackMsg: vi.fn(),
  formsDataChanged: vi.fn(),
})

const createArrowData = (): Uint8Array => {
  // Minimal Arrow IPC data (empty but valid header)
  return new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00])
}

const getProps = (
  elementProps: Partial<PerspectiveProto> = {}
): PerspectiveProps => ({
  element: PerspectiveProto.create({
    data: {
      data: createArrowData(),
    },
    id: "test-element-id",
    schemaDigest: "test-schema-digest",
    theme: "streamlit",
    ...elementProps,
  }),
  widgetMgr: mockWidgetMgr,
})

describe("Perspective Element", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to default state
    vi.mocked(usePerspective).mockReturnValue({
      viewerRef: { current: null },
      isInitialized: false,
      error: null,
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Perspective {...props} />)

    const container = screen.getByTestId("stPerspective")
    expect(container).toBeInTheDocument()
    expect(container).toHaveClass("stPerspective")
  })

  it("renders perspective-viewer element", () => {
    const props = getProps()
    render(<Perspective {...props} />)

    // The perspective-viewer custom element should be rendered
    const viewer = document.querySelector("perspective-viewer")
    expect(viewer).toBeInTheDocument()
  })

  it("displays error message when initialization fails", () => {
    vi.mocked(usePerspective).mockReturnValue({
      viewerRef: { current: null },
      isInitialized: false,
      error: new Error("Test error message"),
    })

    const props = getProps()
    render(<Perspective {...props} />)

    const errorElement = screen.getByTestId("stPerspectiveError")
    expect(errorElement).toBeInTheDocument()
    expect(errorElement).toHaveTextContent("Test error message")
  })

  it("passes correct props to usePerspective hook", () => {
    const props = getProps({
      id: "custom-id",
      schemaDigest: "custom-digest",
      theme: "Pro Dark",
      defaultConfigJson: '{"columns": ["a", "b"]}',
    })
    render(<Perspective {...props} />)

    expect(usePerspective).toHaveBeenCalledWith(
      expect.objectContaining({
        elementId: "custom-id",
        schemaDigest: "custom-digest",
        theme: "Pro Dark",
        defaultConfigJson: '{"columns": ["a", "b"]}',
        widgetMgr: mockWidgetMgr,
      })
    )
  })

  it("applies default height of 500px when no height config provided", () => {
    const props = getProps()
    render(<Perspective {...props} />)

    const container = screen.getByTestId("stPerspective")
    // The container should have the default height
    expect(container).toHaveStyle({ minHeight: "500px" })
  })

  it("applies custom pixel height when provided", () => {
    const props = {
      ...getProps(),
      heightConfig: { pixelHeight: 300 },
    }
    render(<Perspective {...props} />)

    const container = screen.getByTestId("stPerspective")
    expect(container).toHaveStyle({ minHeight: "300px" })
  })

  it("does not show error when initialization succeeds", () => {
    vi.mocked(usePerspective).mockReturnValue({
      viewerRef: { current: null },
      isInitialized: true,
      error: null,
    })

    const props = getProps()
    render(<Perspective {...props} />)

    const errorElement = screen.queryByTestId("stPerspectiveError")
    expect(errorElement).not.toBeInTheDocument()
  })

  it("handles empty data gracefully", () => {
    const props = getProps({
      data: { data: new Uint8Array(0) },
    })
    render(<Perspective {...props} />)

    // Should render without crashing
    const container = screen.getByTestId("stPerspective")
    expect(container).toBeInTheDocument()
  })
})
