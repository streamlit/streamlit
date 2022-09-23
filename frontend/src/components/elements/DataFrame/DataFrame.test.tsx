/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { shallow } from "enzyme"
import { fromJS, Map as ImmutableMap } from "immutable"
import { random, times } from "lodash"
import { MultiGrid } from "react-virtualized"

import { mockDataFrame, mockStringDataFrame } from "./mock"
import { DataFrame, DataFrameProps } from "./DataFrame"
import { ROW_HEIGHT } from "./DataFrameUtil"

const SCROLLBAR_SIZE = 10
jest.mock("src/vendor/dom-helpers", () => ({
  scrollbarSize: () => SCROLLBAR_SIZE,
}))

const getProps = (
  elementProps: Record<string, unknown> = {}
): DataFrameProps => ({
  element: fromJS({
    ...mockDataFrame,
    ...elementProps,
  }) as ImmutableMap<string, any>,
  width: 400,
  height: 400,
})

const fakeInt64Data = (
  numRows: number,
  numCols: number
): Partial<typeof mockDataFrame> => ({
  data: {
    cols: times(numCols, () => ({
      int64s: { data: times(numRows, () => random(0, 9)) },
      type: "int64s",
    })),
  },
  index: { rangeIndex: { start: 0, stop: numRows }, type: "rangeIndex" },
  columns: { rangeIndex: { start: 0, stop: numCols }, type: "rangeIndex" },
})

const fakeStringData = (
  numRows: number,
  numCols: number
): Partial<typeof mockStringDataFrame> => ({
  data: {
    cols: times(numCols, () => ({
      strings: { data: times(numRows, () => String(random(0, 9))) },
      type: "strings",
    })),
  },
  index: { rangeIndex: { start: 0, stop: numRows }, type: "rangeIndex" },
  columns: { rangeIndex: { start: 0, stop: numCols }, type: "rangeIndex" },
})

describe("DataFrame Element", () => {
  const props = getProps()
  const wrapper = shallow(<DataFrame {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(MultiGrid).length).toBe(1)
  })

  it("should have correct className", () => {
    expect(
      wrapper.find("StyledDataFrameContainer").prop("className")
    ).toContain("stDataFrame")
  })

  it("multigrid should be rendered correctly", () => {
    const multiGridProps = wrapper.find(MultiGrid).props()

    expect(multiGridProps.fixedColumnCount).toBe(1)
    expect(multiGridProps.fixedRowCount).toBe(1)
    expect(multiGridProps.columnCount).toBe(11)
    expect(multiGridProps).toHaveProperty("enableFixedColumnScroll")
    expect(multiGridProps).toHaveProperty("enableFixedRowScroll")
    expect(multiGridProps.rowHeight).toBe(ROW_HEIGHT)
    expect(multiGridProps.rowCount).toBe(11)
    expect(multiGridProps.height).toBe(ROW_HEIGHT * 11)
    // 2px is for borders
    expect(multiGridProps.width).toBe(400 - SCROLLBAR_SIZE - 2)
  })

  it("should render as empty if there's no data", () => {
    const props = getProps({
      data: {},
    })
    const wrapper = shallow(<DataFrame {...props} />)
    const multiGridProps = wrapper.find(MultiGrid).props()

    expect(wrapper.text()).toBe("<MultiGrid />empty")

    expect(multiGridProps.fixedColumnCount).toBe(1)
    expect(multiGridProps.fixedRowCount).toBe(1)
    expect(multiGridProps.columnCount).toBe(1)
    expect(multiGridProps).toHaveProperty("enableFixedColumnScroll")
    expect(multiGridProps).toHaveProperty("enableFixedRowScroll")
    expect(multiGridProps.height).toBe(ROW_HEIGHT)
    expect(multiGridProps.rowHeight).toBe(ROW_HEIGHT)
    expect(multiGridProps.rowCount).toBe(1)
    expect(multiGridProps.width).toBe(60)
  })

  it("adds extra height for horizontal scrollbar when wide but not tall", () => {
    let props = getProps({ ...fakeInt64Data(1, 1) })
    let wrapper = shallow(<DataFrame {...props} />)
    const normalHeight = wrapper.find(MultiGrid).props().height

    props = getProps({ ...fakeInt64Data(1, 20) })
    wrapper = shallow(<DataFrame {...props} />)
    const heightWithScrollbar = wrapper.find(MultiGrid).props().height

    expect(heightWithScrollbar).toBe(normalHeight)
  })

  it("adds extra width for vertical scrollbar when tall but not wide", () => {
    // Be careful to ensure that the number of digits needed to display the
    // largest row number is the same for the two DataFrames.
    let props = getProps({ ...fakeInt64Data(11, 1) })
    let wrapper = shallow(<DataFrame {...props} />)
    const normalWidth = wrapper.find(MultiGrid).props().width

    props = getProps({ ...fakeInt64Data(99, 1) })
    wrapper = shallow(<DataFrame {...props} />)
    const widthWithScrollbar = wrapper.find(MultiGrid).props().width

    expect(widthWithScrollbar).toBe(normalWidth + SCROLLBAR_SIZE)
  })

  it("should render numeric column with text-align set to right", () => {
    const props = getProps({ ...fakeInt64Data(10, 1) })
    const wrapper = shallow(<DataFrame {...props} />)

    const multiGrid = wrapper.find(MultiGrid)
    const Grids = multiGrid.dive().find("Grid")

    const headerRow = Grids.at(1)
    const headerCells = headerRow.dive().find("DataFrameCell")

    const dataRows = Grids.at(3)
    const dataCells = dataRows.dive().find("DataFrameCell")

    headerCells.forEach(node => {
      expect(node.props().style?.textAlign).toBeUndefined()
    })

    dataCells.forEach(node => {
      expect(node.props().style?.textAlign).toBeUndefined()
    })
  })

  it("should render string column with text-align set to left", () => {
    const props = getProps({ ...fakeStringData(10, 1) })
    const wrapper = shallow(<DataFrame {...props} />)

    const multiGrid = wrapper.find(MultiGrid)
    const Grids = multiGrid.dive().find("Grid")

    const headerRow = Grids.at(1)
    const headerCells = headerRow.dive().find("DataFrameCell")

    const dataRows = Grids.at(3)
    const dataCells = dataRows.dive().find("DataFrameCell")

    headerCells.forEach(node => {
      expect(node.props().style?.textAlign).toBe("left")
    })

    dataCells.forEach(node => {
      expect(node.props().style?.textAlign).toBe("left")
    })
  })
})
