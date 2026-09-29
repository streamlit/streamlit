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

import { screen, waitFor } from "@testing-library/react"

import { render } from "~lib/test_util"

import StatisticsChart from "./StatisticsChart"
import type {
  BooleanStatistics,
  DateTimeStatistics,
  NumericStatistics,
  TextStatistics,
} from "./statisticsUtils"

const mockFinalize = vi.fn()
const mockEmbed = vi.fn()

vi.mock("vega-embed", () => ({
  default: (
    ...args: unknown[]
  ): Promise<{ finalize: typeof mockFinalize }> => {
    mockEmbed(...args)
    return Promise.resolve({ finalize: mockFinalize })
  },
}))

describe("StatisticsChart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const numericStats: NumericStatistics = {
    type: "numeric",
    count: 100,
    nullCount: 5,
    unique: 50,
    sum: 5000,
    mean: 50,
    q25: 25,
    median: 50,
    q75: 75,
    stdDev: 15,
    variance: 225,
    min: 0,
    max: 100,
    histogram: [
      { binStart: 0, binEnd: 20, count: 20 },
      { binStart: 20, binEnd: 40, count: 30 },
      { binStart: 40, binEnd: 60, count: 25 },
      { binStart: 60, binEnd: 80, count: 15 },
      { binStart: 80, binEnd: 100, count: 10 },
    ],
    isSampled: false,
  }

  const textStats: TextStatistics = {
    type: "text",
    count: 100,
    empty: 5,
    unique: 20,
    minLength: 1,
    maxLength: 50,
    avgLength: 10,
    topValues: [
      { value: "apple", count: 30, percentage: 30 },
      { value: "banana", count: 25, percentage: 25 },
      { value: "cherry", count: 20, percentage: 20 },
    ],
    isSampled: false,
  }

  const datetimeStats: DateTimeStatistics = {
    type: "datetime",
    isDateOnly: false,
    count: 100,
    nullCount: 2,
    mean: Date.parse("2023-06-15"),
    q25: Date.parse("2023-03-15"),
    median: Date.parse("2023-06-15"),
    q75: Date.parse("2023-09-15"),
    min: Date.parse("2023-01-01"),
    max: Date.parse("2023-12-31"),
    range: "1 year",
    histogram: [
      {
        binStart: Date.parse("2023-01-01"),
        binEnd: Date.parse("2023-04-01"),
        count: 30,
      },
      {
        binStart: Date.parse("2023-04-01"),
        binEnd: Date.parse("2023-07-01"),
        count: 35,
      },
      {
        binStart: Date.parse("2023-07-01"),
        binEnd: Date.parse("2023-10-01"),
        count: 25,
      },
      {
        binStart: Date.parse("2023-10-01"),
        binEnd: Date.parse("2023-12-31"),
        count: 10,
      },
    ],
    isSampled: false,
  }

  const booleanStats: BooleanStatistics = {
    type: "boolean",
    count: 100,
    nullCount: 3,
    trueCount: 60,
    falseCount: 40,
    truePercentage: 60,
    falsePercentage: 40,
    isSampled: false,
  }

  it("renders histogram for numeric statistics", async () => {
    render(<StatisticsChart statistics={numericStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Distribution histogram"
    )
  })

  it("encodes histogram bars across the bin width down to a zero baseline", async () => {
    render(<StatisticsChart statistics={numericStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    const spec = mockEmbed.mock.calls[0][1] as {
      encoding: {
        x: { field: string }
        x2: { field: string }
        y: { field: string }
        y2: { datum: number }
      }
    }
    expect(spec.encoding.x.field).toBe("binStart")
    expect(spec.encoding.x2.field).toBe("binEnd")
    expect(spec.encoding.y.field).toBe("count")
    expect(spec.encoding.y2).toEqual({ datum: 0 })
  })

  it("pads the bin range for a single-value histogram so the bar stays visible", async () => {
    const singleValueStats: NumericStatistics = {
      ...numericStats,
      histogram: [{ binStart: 5, binEnd: 5, count: 100 }],
    }
    render(<StatisticsChart statistics={singleValueStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    const spec = mockEmbed.mock.calls[0][1] as {
      data: { values: { binStart: number; binEnd: number; range: string }[] }
    }
    const datum = spec.data.values[0]
    // Zero-width bin is padded ±0.5 so the lone bar renders...
    expect(datum.binStart).toBe(4.5)
    expect(datum.binEnd).toBe(5.5)
    // ...but the tooltip range still reflects the unpadded value.
    expect(datum.range).toContain("5")
  })

  it("renders histogram for datetime statistics", async () => {
    render(<StatisticsChart statistics={datetimeStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Distribution histogram"
    )
  })

  it("formats the tooltip range with dates for datetime histograms", async () => {
    render(<StatisticsChart statistics={datetimeStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    const spec = mockEmbed.mock.calls[0][1] as {
      data: { values: { range: string }[] }
    }
    const ranges = spec.data.values.map(value => value.range)
    // The datetime formatRange callback renders each bin as "<start> – <end>"
    // using formatted dates. Assertions stay locale-agnostic (year + en dash).
    expect(ranges[0]).toContain("2023")
    expect(ranges[0]).toContain("–")
    // Distinct date bins produce distinct range labels.
    expect(new Set(ranges).size).toBe(ranges.length)
  })

  it("renders labeled bar chart for text statistics", () => {
    render(<StatisticsChart statistics={textStats} />)

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    // The aria-label enumerates each bar (label, count, percentage) so the
    // breakdown is announced despite role="img" making descendants presentational.
    const textAriaLabel = screen.getByRole("img").getAttribute("aria-label")
    expect(textAriaLabel).toContain("Top values frequency chart")
    expect(textAriaLabel).toContain("apple: 30 (30%)")
    expect(screen.getByText("apple")).toBeVisible()
    expect(screen.getByText("banana")).toBeVisible()
    // Bars are labeled with each value's share of the total (not the raw count).
    expect(screen.getByText("30%")).toBeVisible()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("renders labeled bar chart for boolean statistics", () => {
    render(<StatisticsChart statistics={booleanStats} />)

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    // The True/false split is exposed to assistive tech via the aria-label.
    const boolAriaLabel = screen.getByRole("img").getAttribute("aria-label")
    expect(boolAriaLabel).toContain("True/false distribution chart")
    expect(boolAriaLabel).toContain("True: 60 (60%)")
    expect(boolAriaLabel).toContain("False: 40 (40%)")
    expect(screen.getByText("True")).toBeVisible()
    expect(screen.getByText("False")).toBeVisible()
    expect(screen.getByText("60%")).toBeVisible()
    expect(screen.getByText("40%")).toBeVisible()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("returns null for numeric stats with empty histogram", () => {
    const emptyNumericStats: NumericStatistics = {
      ...numericStats,
      histogram: [],
    }

    const { container } = render(
      <StatisticsChart statistics={emptyNumericStats} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("returns null for text stats with no top values", () => {
    const emptyTextStats: TextStatistics = {
      ...textStats,
      topValues: [],
    }

    const { container } = render(
      <StatisticsChart statistics={emptyTextStats} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("returns null for boolean stats with zero count", () => {
    const emptyBooleanStats: BooleanStatistics = {
      ...booleanStats,
      count: 0,
      trueCount: 0,
      falseCount: 0,
    }

    const { container } = render(
      <StatisticsChart statistics={emptyBooleanStats} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("calls finalize on unmount", async () => {
    const { unmount } = render(<StatisticsChart statistics={numericStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    unmount()

    await waitFor(() => {
      expect(mockFinalize).toHaveBeenCalled()
    })
  })

  it("preserves full text labels in row title", () => {
    const longTextStats: TextStatistics = {
      ...textStats,
      topValues: [
        {
          value: "this is a very long value that should be preserved",
          count: 50,
          percentage: 50,
        },
      ],
    }

    render(<StatisticsChart statistics={longTextStats} />)

    expect(
      screen.getByTitle(
        "this is a very long value that should be preserved: 50 (50%)"
      )
    ).toBeVisible()
    expect(
      screen.getByText("this is a very long value that should be preserved")
    ).toBeVisible()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it("does not render a visible bar for zero values", () => {
    render(
      <StatisticsChart
        statistics={{
          ...booleanStats,
          trueCount: 0,
          falseCount: 100,
          truePercentage: 0,
          falsePercentage: 100,
        }}
      />
    )

    const trueRow = screen.getByTitle("True: 0 (0%)")
    const trueBar = trueRow.querySelector("div[style]")
    expect(trueBar).toHaveStyle({ width: "0%" })
  })
})
