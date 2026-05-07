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
import {
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
    unique: 80,
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

  it("renders bar chart for text statistics", async () => {
    render(<StatisticsChart statistics={textStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Top values frequency chart"
    )
  })

  it("renders bar chart for boolean statistics", async () => {
    render(<StatisticsChart statistics={booleanStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId("stDataFrameStatisticsChart")).toBeVisible()
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "True/false distribution chart"
    )
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

  it("truncates long text labels to 15 characters", async () => {
    const longTextStats: TextStatistics = {
      ...textStats,
      topValues: [
        {
          value: "this is a very long value that should be truncated",
          count: 50,
          percentage: 50,
        },
      ],
    }

    render(<StatisticsChart statistics={longTextStats} />)

    await waitFor(() => {
      expect(mockEmbed).toHaveBeenCalledTimes(1)
    })

    const [, spec] = mockEmbed.mock.calls[0] as [
      unknown,
      { data: { values: { label: string }[] } },
    ]
    const chartData = spec.data.values
    expect(chartData[0].label).toBe("this is a very …")
  })
})
