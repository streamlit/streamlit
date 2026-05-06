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
import { Field, Int64 } from "apache-arrow"

import { NumberColumn } from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { render } from "~lib/test_util"

import StatisticsMenu, { StatisticsMenuProps } from "./StatisticsMenu"

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
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(screen.getByText("Variance")).toBeVisible()
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

    // Check that we have a description list (dl element)
    const dlElement = screen
      .getByTestId("stDataFrameStatisticsContent")
      .querySelector("dl")
    expect(dlElement).toBeInTheDocument()

    // Check for dt (term) and dd (definition) elements
    const dtElements = dlElement?.querySelectorAll("dt")
    const ddElements = dlElement?.querySelectorAll("dd")
    expect(dtElements?.length).toBeGreaterThan(0)
    expect(ddElements?.length).toBeGreaterThan(0)
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
    expect(
      screen.queryByTestId("stDataFrameStatisticsSkeleton")
    ).not.toBeInTheDocument()
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
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
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
