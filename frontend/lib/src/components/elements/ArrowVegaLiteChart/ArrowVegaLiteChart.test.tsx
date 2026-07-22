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

import { useMemo } from "react"

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { VegaLiteChart as VegaLiteChartProto } from "@streamlit/protobuf"

const vegaEmbedMock = vi.hoisted(() => ({
  exportToPng: vi.fn(),
  isViewReady: false,
}))
const mockWriteText = vi.fn()

// Avoid real Vega embedding side-effects in tests
vi.mock("./useVegaEmbed", () => ({
  useVegaEmbed: () => {
    // Satisfy hooks rule by calling a React hook in this mock
    const _memo = useMemo(() => null, [])
    return {
      createView: () => Promise.resolve(null),
      updateView: () => Promise.resolve(null),
      finalizeView: () => {},
      resizeView: () => Promise.resolve(false),
      exportToPng: vegaEmbedMock.exportToPng,
      isViewReady: vegaEmbedMock.isViewReady,
    }
  },
}))

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"
import { mockWindowLocation, render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ArrowVegaLiteChart, {
  hasNestedComposition,
  isFacetChart,
  Props,
} from "./ArrowVegaLiteChart"

const getProps = (
  elementProps: Partial<VegaLiteChartProto> = {},
  props: Partial<Props> = {}
): Props => ({
  element: VegaLiteChartProto.create({
    id: "1",
    useContainerWidth: false,
    datasets: [],
    selectionMode: [],
    formId: "",
    spec: JSON.stringify({
      data: {
        values: [
          { category: "A", group: "x", value: 0.1 },
          { category: "A", group: "y", value: 0.6 },
          { category: "A", group: "z", value: 0.9 },
          { category: "B", group: "x", value: 0.7 },
          { category: "B", group: "y", value: 0.2 },
          { category: "B", group: "z", value: 1.1 },
          { category: "C", group: "x", value: 0.6 },
          { category: "C", group: "y", value: 0.1 },
          { category: "C", group: "z", value: 0.2 },
        ],
      },
      mark: "bar",
      encoding: {
        x: { field: "category" },
        y: { field: "value", type: "quantitative" },
      },
    }),
    theme: "streamlit",
    ...elementProps,
  }),
  elementHash: "test-hash",
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  widthConfig: null,
  heightConfig: null,
  ...props,
})

describe("ArrowVegaLiteChart", () => {
  beforeEach(() => {
    mockWindowLocation("localhost")
    vegaEmbedMock.exportToPng.mockResolvedValue("data:image/png;base64,mock")
    vegaEmbedMock.isViewReady = false
    mockWriteText.mockReset()
    mockWriteText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mockWriteText,
      },
    })
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
  })

  it("renders without crashing", () => {
    render(<ArrowVegaLiteChart {...getProps()} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    expect(vegaLiteChart).toBeInTheDocument()
    expect(vegaLiteChart).toHaveClass("stVegaLiteChart")
  })

  it("shows data grid when 'Show data' is clicked for inline data, and toggles back to chart", async () => {
    const user = userEvent.setup()

    render(
      <ArrowVegaLiteChart
        {...getProps({ data: { data: UNICODE }, datasets: [] })}
      />
    )

    // Initially, the chart container should be present
    expect(screen.getByTestId("stVegaLiteChart")).toBeVisible()

    // The toolbar action should be present when data exists
    const showDataButton = screen.getByRole("button", { name: "Show data" })

    // Click to show the data grid
    await user.click(showDataButton)

    // Should switch to grid view (Show chart action appears) and chart container hidden
    await screen.findByRole("button", { name: "Show chart" })
    expect(screen.queryByTestId("stVegaLiteChart")).toBeNull()

    // Click the custom toolbar action to show the chart again
    const showChartButton = await screen.findByRole("button", {
      name: "Show chart",
    })
    await user.click(showChartButton)

    // Chart should be shown again
    expect(await screen.findByTestId("stVegaLiteChart")).toBeInTheDocument()
    expect(screen.queryByTestId("stDataFrame")).toBeNull()
  })

  it("shows data grid when 'Show data' is clicked for first dataset", () => {
    render(
      <ArrowVegaLiteChart
        {...getProps({
          data: null,
          datasets: [
            {
              name: "dataset0",
              hasName: true,
              data: { data: UNICODE },
            },
          ],
        })}
      />
    )

    // Initially, the chart container should be present
    expect(screen.getByTestId("stVegaLiteChart")).toBeVisible()

    // The toolbar action should be present when data exists
    expect(
      screen.queryByRole("button", { name: "Show data" })
    ).toBeInTheDocument()
  })

  it("does not show 'Show data' when neither data nor datasets are provided", () => {
    render(<ArrowVegaLiteChart {...getProps({ data: null, datasets: [] })} />)

    expect(screen.queryByRole("button", { name: "Show data" })).toBeNull()
  })

  it("renders download and copy actions to the right of the show data action", () => {
    vegaEmbedMock.isViewReady = true

    render(
      <ArrowVegaLiteChart
        {...getProps({ data: { data: UNICODE }, datasets: [] })}
      />
    )

    // Selecting by accessible name also asserts each button exists.
    const showDataButton = screen.getByRole("button", { name: "Show data" })
    const downloadButton = screen.getByRole("button", {
      name: "Download as PNG",
    })
    const copyButton = screen.getByRole("button", {
      name: "Copy Vega-Lite spec",
    })

    // DOCUMENT_POSITION_FOLLOWING (4) means the argument node comes after the
    // reference node in the DOM, confirming left-to-right toolbar order.
    expect(
      showDataButton.compareDocumentPosition(downloadButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      downloadButton.compareDocumentPosition(copyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("hides CSV export in table view when data export is disabled, but keeps PNG download", async () => {
    const user = userEvent.setup()
    vegaEmbedMock.isViewReady = true

    renderWithContexts(
      <ArrowVegaLiteChart
        {...getProps({ data: { data: UNICODE }, datasets: [] })}
      />,
      {
        libConfigContext: { disableDataExport: true },
      }
    )

    // The toolbar is only shown (opacity > 0) on hover, so assert presence in
    // the DOM rather than visibility here.
    expect(
      screen.getByRole("button", { name: "Download as PNG" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show data" }))

    expect(
      await screen.findByRole("button", { name: "Show chart" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Download as CSV" })
    ).not.toBeInTheDocument()
  })

  it("downloads the chart as a PNG when the toolbar action is clicked", async () => {
    vi.useFakeTimers()
    // Construct the pinned time via local-time components (not a UTC ISO string)
    // so the expected filename below matches regardless of the runner's timezone.
    vi.setSystemTime(new Date(2026, 6, 2, 16, 1, 0))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    let downloadFilename: string | null = null
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadFilename = this.getAttribute("download")
      }
    )
    vegaEmbedMock.isViewReady = true

    render(<ArrowVegaLiteChart {...getProps()} />)

    await user.click(screen.getByRole("button", { name: "Download as PNG" }))

    await waitFor(() => expect(vegaEmbedMock.exportToPng).toHaveBeenCalled())
    expect(downloadFilename).toBe("2026-07-02T16-01_chart.png")
  })

  it("shows the copy spec toolbar action on localhost", () => {
    render(<ArrowVegaLiteChart {...getProps()} />)

    expect(
      screen.getByRole("button", { name: "Copy Vega-Lite spec" })
    ).toBeInTheDocument()
  })

  it("does not show the copy spec toolbar action away from localhost", () => {
    mockWindowLocation("example.com")

    render(<ArrowVegaLiteChart {...getProps()} />)

    expect(
      screen.queryByRole("button", { name: "Copy Vega-Lite spec" })
    ).toBeNull()
  })

  it("copies the rendered Vega-Lite spec to the clipboard", async () => {
    const user = userEvent.setup()
    // userEvent.setup() installs its own clipboard stub, so re-establish our
    // spy afterwards to assert the exact text written to the clipboard.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockWriteText },
    })
    render(<ArrowVegaLiteChart {...getProps()} />)

    const copyButton = screen.getByRole("button", {
      name: "Copy Vega-Lite spec",
    })
    const checkIconPath =
      "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"

    expect(copyButton.querySelector(`path[d="${checkIconPath}"]`)).toBeNull()

    await user.click(copyButton)

    await waitFor(() =>
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('"mark": "bar"')
      )
    )

    // After a successful copy the accessible name switches to "Copied!" so
    // assistive tech announces the state change (not just the icon swap).
    const copiedButton = await screen.findByRole("button", { name: "Copied!" })
    expect(
      copiedButton.querySelector(`path[d="${checkIconPath}"]`)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Copy Vega-Lite spec" })
    ).toBeNull()
  })
})

describe("isFacetChart", () => {
  it.each([
    {
      name: "spec with facet property",
      spec: { facet: { field: "category" }, spec: { mark: "bar" } },
      expected: true,
    },
    {
      name: "spec with encoding.row",
      spec: { mark: "bar", encoding: { row: { field: "category" } } },
      expected: true,
    },
    {
      name: "spec with encoding.column",
      spec: { mark: "bar", encoding: { column: { field: "category" } } },
      expected: true,
    },
    {
      name: "spec with encoding.facet",
      spec: { mark: "bar", encoding: { facet: { field: "category" } } },
      expected: true,
    },
    {
      name: "simple chart without facet",
      spec: {
        mark: "bar",
        encoding: { x: { field: "a" }, y: { field: "b" } },
      },
      expected: false,
    },
  ])("returns $expected for $name", ({ spec, expected }) => {
    expect(isFacetChart(spec)).toBe(expected)
    expect(isFacetChart(JSON.stringify(spec))).toBe(expected)
  })

  it("returns false for invalid JSON string", () => {
    expect(isFacetChart("invalid json")).toBe(false)
  })
})

describe("hasNestedComposition", () => {
  it.each([
    {
      name: "vconcat containing hconcat",
      spec: {
        vconcat: [
          { mark: "bar", encoding: { x: { field: "a" } } },
          { hconcat: [{ mark: "point" }, { mark: "line" }] },
        ],
      },
      expected: true,
    },
    {
      name: "vconcat containing nested vconcat",
      spec: {
        vconcat: [
          { vconcat: [{ mark: "bar" }, { mark: "point" }] },
          { mark: "line" },
        ],
      },
      expected: true,
    },
    {
      name: "vconcat containing concat",
      spec: {
        vconcat: [
          { concat: [{ mark: "bar" }, { mark: "point" }] },
          { mark: "line" },
        ],
      },
      expected: true,
    },
    {
      name: "vconcat containing layer",
      spec: {
        vconcat: [
          { layer: [{ mark: "line" }, { mark: "point" }] },
          { mark: "bar" },
        ],
      },
      expected: true,
    },
    {
      name: "vconcat containing facet",
      spec: {
        vconcat: [
          {
            facet: { column: { field: "group" } },
            spec: { mark: "line", encoding: { x: { field: "a" } } },
          },
          { mark: "bar" },
        ],
      },
      expected: true,
    },
    {
      name: "vconcat containing repeat",
      spec: {
        vconcat: [
          {
            repeat: { row: ["a", "b"] },
            spec: { mark: "line", encoding: { x: { field: "a" } } },
          },
          { mark: "bar" },
        ],
      },
      expected: true,
    },
    {
      name: "simple vconcat without nested compositions",
      spec: {
        vconcat: [
          { mark: "bar", encoding: { x: { field: "a" }, y: { field: "b" } } },
          {
            mark: "point",
            encoding: { x: { field: "a" }, y: { field: "b" } },
          },
        ],
      },
      expected: false,
    },
    {
      name: "spec without vconcat",
      spec: { mark: "bar", encoding: { x: { field: "a" } } },
      expected: false,
    },
    {
      name: "hconcat at top level (not nested)",
      spec: { hconcat: [{ mark: "bar" }, { mark: "point" }] },
      expected: false,
    },
    {
      name: "vconcat that is not an array",
      spec: { vconcat: "not an array" },
      expected: false,
    },
  ])("returns $expected for $name", ({ spec, expected }) => {
    expect(hasNestedComposition(spec)).toBe(expected)
    expect(hasNestedComposition(JSON.stringify(spec))).toBe(expected)
  })

  it("returns false for invalid JSON string", () => {
    expect(hasNestedComposition("invalid json")).toBe(false)
  })

  it("handles non-object children in vconcat gracefully", () => {
    // Edge case: vconcat with null/primitive children mixed with valid ones
    const specWithNull = { vconcat: [null, { hconcat: [{ mark: "bar" }] }] }
    expect(hasNestedComposition(specWithNull)).toBe(true)

    const specWithPrimitives = {
      vconcat: ["invalid", 123, { layer: [{ mark: "line" }] }],
    }
    expect(hasNestedComposition(specWithPrimitives)).toBe(true)

    // Should still return false if no valid nested compositions
    const specOnlyPrimitives = { vconcat: [null, "string", 123] }
    expect(hasNestedComposition(specOnlyPrimitives)).toBe(false)
  })
})
