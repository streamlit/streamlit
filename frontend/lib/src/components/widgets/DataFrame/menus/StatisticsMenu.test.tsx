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

import { screen, waitFor, within } from "@testing-library/react"
import { Field, Int64 } from "apache-arrow"

import { NumberColumn } from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { render } from "~lib/test_util"

import StatisticsMenu, { StatisticsMenuProps } from "./StatisticsMenu"
import {
  BooleanStatistics,
  computeStatistics,
  DateTimeStatistics,
  NumericStatistics,
  TextStatistics,
} from "./statisticsUtils"

// Mock only the computeStatistics dispatcher so we can drive the component's
// rendering branches (per-type metrics, empty/no-data states) without building
// real Arrow columns for every type. The pure compute functions are covered
// directly in statisticsUtils.test.ts.
vi.mock("./statisticsUtils", async importOriginal => {
  const actual = await importOriginal<typeof import("./statisticsUtils")>()
  return {
    ...actual,
    computeStatistics: vi.fn(),
  }
})

const NUMERIC_STATS: NumericStatistics = {
  type: "numeric",
  count: 10,
  nullCount: 0,
  unique: 10,
  sum: 55,
  mean: 5.5,
  q25: 3.25,
  median: 5.5,
  q75: 7.75,
  stdDev: 2.87,
  variance: 8.25,
  min: 1,
  max: 10,
  histogram: [
    { binStart: 1, binEnd: 5.5, count: 5 },
    { binStart: 5.5, binEnd: 10, count: 5 },
  ],
  isSampled: false,
}

describe("StatisticsMenu", () => {
  const mockQuiver = new Quiver({ data: TEN_BY_TEN })

  const numberColumn = NumberColumn({
    title: "testColumn",
    id: "col-1",
    indexNumber: 0,
    isEditable: false,
    name: "testColumn",
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("int_column", new Int64(), true),
      pandasType: {
        field_name: "int_column",
        name: "int_column",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  })

  const defaultProps: Omit<StatisticsMenuProps, "children"> = {
    column: numberColumn,
    data: mockQuiver,
    isOpen: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to numeric stats; individual tests override as needed.
    vi.mocked(computeStatistics).mockReturnValue(NUMERIC_STATS)
  })

  it("renders the trigger element", () => {
    render(
      <StatisticsMenu {...defaultProps} isOpen={false}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    expect(screen.getByTestId("trigger")).toBeVisible()
  })

  it("shows statistics content when isOpen is true", async () => {
    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })
  })

  it("renders numeric statistics metrics", async () => {
    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    // Numeric stats should have these labels
    expect(screen.getByText("Values")).toBeVisible()
    expect(screen.getByText("Empty")).toBeVisible()
    expect(screen.getByText("Distinct")).toBeVisible()
    expect(screen.getByText("Sum")).toBeVisible()
    expect(screen.getByText("Minimum")).toBeVisible()
    expect(screen.getByText("25th percentile")).toBeVisible()
    expect(screen.getByText("Median")).toBeVisible()
    expect(screen.getByText("75th percentile")).toBeVisible()
    expect(screen.getByText("Maximum")).toBeVisible()
    expect(screen.getByText("Average")).toBeVisible()
    expect(screen.getByText("Standard deviation")).toBeVisible()
    // Variance is intentionally omitted (redundant with standard deviation).
    expect(screen.queryByText("Variance")).not.toBeInTheDocument()
  })

  it("uses semantic markup for statistics metrics", async () => {
    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    // Check that we have a description list with terms and definitions
    const metricsContainer = screen.getByTestId("stDataFrameStatisticsMetrics")
    expect(metricsContainer).toBeVisible()
    expect(metricsContainer.tagName).toBe("DL")

    // Check for term (dt) and definition (dd) elements via getAllByRole is not possible
    // as dt/dd don't have implicit roles, so verify via text content presence
    const metricsScope = within(metricsContainer)
    expect(metricsScope.getByText("Values")).toBeVisible()
    expect(metricsScope.getByText("Average")).toBeVisible()
  })

  it("does not compute statistics when isOpen is false", () => {
    render(
      <StatisticsMenu {...defaultProps} isOpen={false}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    // When closed, the statistics content should not be rendered
    expect(
      screen.queryByTestId("stDataFrameStatisticsContent")
    ).not.toBeInTheDocument()
  })

  it("renders text statistics metrics", async () => {
    const textStats: TextStatistics = {
      type: "text",
      count: 6,
      empty: 1,
      unique: 3,
      minLength: 3,
      maxLength: 8,
      avgLength: 5.5,
      topValues: [
        { value: "apple", count: 3, percentage: 50 },
        { value: "banana", count: 2, percentage: 33.3 },
      ],
      isSampled: false,
    }
    vi.mocked(computeStatistics).mockReturnValue(textStats)

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    expect(screen.getByText("Minimum length")).toBeVisible()
    expect(screen.getByText("Maximum length")).toBeVisible()
    expect(screen.getByText("Average length")).toBeVisible()
    // Numeric-only metrics must not appear for text columns.
    expect(screen.queryByText("Sum")).not.toBeInTheDocument()
    expect(screen.queryByText("Variance")).not.toBeInTheDocument()
  })

  it("renders datetime statistics metrics", async () => {
    const ts = new Date("2023-01-01T00:00:00Z").getTime()
    const ts2 = new Date("2023-01-05T00:00:00Z").getTime()
    const datetimeStats: DateTimeStatistics = {
      type: "datetime",
      isDateOnly: false,
      count: 5,
      nullCount: 1,
      mean: ts,
      q25: ts,
      median: ts,
      q75: ts2,
      min: ts,
      max: ts2,
      range: "4 days",
      histogram: [{ binStart: ts, binEnd: ts2, count: 5 }],
      isSampled: false,
    }
    vi.mocked(computeStatistics).mockReturnValue(datetimeStats)

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    expect(screen.getByText("Range")).toBeVisible()
    expect(screen.getByText("4 days")).toBeVisible()
    // Numeric-only metrics must not appear for datetime columns.
    expect(screen.queryByText("Sum")).not.toBeInTheDocument()
    expect(screen.queryByText("Variance")).not.toBeInTheDocument()
  })

  it("renders boolean statistics metrics", async () => {
    const booleanStats: BooleanStatistics = {
      type: "boolean",
      count: 5,
      nullCount: 0,
      trueCount: 3,
      falseCount: 2,
      truePercentage: 60,
      falsePercentage: 40,
      isSampled: false,
    }
    vi.mocked(computeStatistics).mockReturnValue(booleanStats)

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    // The metrics list shows only the totals...
    const metrics = screen.getByTestId("stDataFrameStatisticsMetrics")
    expect(within(metrics).getByText("Values")).toBeVisible()
    expect(within(metrics).getByText("Empty")).toBeVisible()
    // ...while the true/false split is delegated to the chart and not
    // duplicated in the metrics list.
    expect(within(metrics).queryByText("True")).not.toBeInTheDocument()
    expect(within(metrics).queryByText("False")).not.toBeInTheDocument()
    const chart = screen.getByTestId("stDataFrameStatisticsChart")
    expect(within(chart).getByText("True")).toBeVisible()
    expect(within(chart).getByText("False")).toBeVisible()
    // Numeric-only metrics must not appear for boolean columns.
    expect(screen.queryByText("Sum")).not.toBeInTheDocument()
  })

  it("shows a sample note when statistics are sampled", async () => {
    vi.mocked(computeStatistics).mockReturnValue({
      ...NUMERIC_STATS,
      isSampled: true,
    })

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByText("Based on sample")).toBeVisible()
    })
  })

  it("shows the 'No data' state when statistics cannot be computed", async () => {
    vi.mocked(computeStatistics).mockReturnValue(null)

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByText("No data")).toBeVisible()
    })
    // No metrics or chart should be rendered for the empty state.
    expect(
      screen.queryByTestId("stDataFrameStatisticsContent")
    ).not.toBeInTheDocument()
  })

  it("shows reduced metrics for all-empty columns", async () => {
    vi.mocked(computeStatistics).mockReturnValue({
      ...NUMERIC_STATS,
      count: 0,
      nullCount: 5,
      unique: 0,
      sum: 0,
      mean: 0,
      q25: 0,
      median: 0,
      q75: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      histogram: [],
    })

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    // Reduced view only shows Values and Empty (no distribution metrics/chart).
    expect(screen.getByText("Values")).toBeVisible()
    expect(screen.getByText("Empty")).toBeVisible()
    expect(screen.queryByText("Sum")).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stDataFrameStatisticsChart")
    ).not.toBeInTheDocument()
    // Not sampled, so the sample note must not appear.
    expect(screen.queryByText("Based on sample")).not.toBeInTheDocument()
  })

  it("shows a sample note for reduced (all-empty) metrics when sampled", async () => {
    vi.mocked(computeStatistics).mockReturnValue({
      ...NUMERIC_STATS,
      count: 0,
      nullCount: 5,
      unique: 0,
      sum: 0,
      mean: 0,
      q25: 0,
      median: 0,
      q75: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      histogram: [],
      isSampled: true,
    })

    render(
      <StatisticsMenu {...defaultProps} isOpen={true}>
        <div data-testid="trigger">Trigger</div>
      </StatisticsMenu>
    )

    await waitFor(() => {
      expect(screen.getByTestId("stDataFrameStatisticsContent")).toBeVisible()
    })

    // The reduced Empty count comes from a sample, so the note must be shown.
    expect(screen.getByText("Empty")).toBeVisible()
    expect(screen.getByText("Based on sample")).toBeVisible()
  })

  it("renders children directly for unsupported column kinds", () => {
    const unsupportedColumn = {
      ...numberColumn,
      kind: "image",
    }

    render(
      <StatisticsMenu
        column={unsupportedColumn}
        data={mockQuiver}
        isOpen={true}
        onOpenChange={vi.fn()}
      >
        <div data-testid="unsupported-trigger">Unsupported</div>
      </StatisticsMenu>
    )

    // Should render just the children without the popover wrapper
    expect(screen.getByTestId("unsupported-trigger")).toBeVisible()
    expect(
      screen.queryByTestId("stDataFrameStatisticsMenu")
    ).not.toBeInTheDocument()
  })
})
