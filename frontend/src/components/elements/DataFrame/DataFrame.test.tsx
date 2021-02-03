/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { shallow } from "enzyme"
import { fromJS } from "immutable"
import { random, times } from "lodash"

import mockDataFrame from "./mock"
import { DataFrame, DataFrameProps } from "./DataFrame"
import { MIN_CELL_WIDTH_PX } from "./DataFrameUtil"

const SCROLLBAR_SIZE = 10
jest.mock("vendor/dom-helpers", () => ({
  scrollbarSize: () => SCROLLBAR_SIZE,
}))

const getProps = (
  elementProps: Record<string, unknown> = {}
): DataFrameProps => ({
  element: fromJS({
    ...mockDataFrame,
    ...elementProps,
  }),
  width: 400,
  height: 400,
})

const fakeData = (
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

describe("DataFrame Element", () => {
  const props = getProps()
  const wrapper = shallow(<DataFrame {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find("MultiGrid").length).toBe(1)
  })

  it("should have correct className", () => {
    expect(
      wrapper.find("StyledDataFrameContainer").prop("className")
    ).toContain("stDataFrame")
  })

  it("multigrid should be rendered correctly", () => {
    const multiGridProps = wrapper.find("MultiGrid").props()

    expect(multiGridProps.fixedColumnCount).toBe(1)
    expect(multiGridProps.fixedRowCount).toBe(1)
    expect(multiGridProps.columnCount).toBe(11)
    expect(multiGridProps).toHaveProperty("enableFixedColumnScroll")
    expect(multiGridProps).toHaveProperty("enableFixedRowScroll")
    // 275px for the dataframe itself + 10px for the horizontal scrollbar
    expect(multiGridProps.height).toBe(285)
    expect(multiGridProps.rowHeight).toBe(25)
    expect(multiGridProps.rowCount).toBe(11)
    // 400px full container width - 12px for border and vertical scrollbar
    expect(multiGridProps.width).toBe(388)
  })

  it("should render as empty if there's no data", () => {
    const props = getProps({
      data: {},
    })
    const wrapper = shallow(<DataFrame {...props} />)
    const multiGridProps = wrapper.find("MultiGrid").props()

    expect(wrapper.text()).toBe("<MultiGrid />empty")

    expect(multiGridProps.fixedColumnCount).toBe(1)
    expect(multiGridProps.fixedRowCount).toBe(1)
    expect(multiGridProps.columnCount).toBe(1)
    expect(multiGridProps).toHaveProperty("enableFixedColumnScroll")
    expect(multiGridProps).toHaveProperty("enableFixedRowScroll")
    expect(multiGridProps.height).toBe(MIN_CELL_WIDTH_PX)
    expect(multiGridProps.rowHeight).toBe(MIN_CELL_WIDTH_PX)
    expect(multiGridProps.rowCount).toBe(1)
    expect(multiGridProps.width).toBe(60)
  })

  it("adds extra height for horizontal scrollbar when wide but not tall", () => {
    let props = getProps({ ...fakeData(1, 1) })
    let wrapper = shallow(<DataFrame {...props} />)
    const normalHeight = wrapper.find("MultiGrid").props().height

    props = getProps({ ...fakeData(1, 20) })
    wrapper = shallow(<DataFrame {...props} />)
    const heightWithScrollbar = wrapper.find("MultiGrid").props().height

    expect(heightWithScrollbar).toBe(normalHeight + SCROLLBAR_SIZE)
  })

  it("adds extra width for vertical scrollbar when tall but not wide", () => {
    // Be careful to ensure that the number of digits needed to display the
    // largest row number is the same for the two DataFrames.
    let props = getProps({ ...fakeData(11, 1) })
    let wrapper = shallow(<DataFrame {...props} />)
    const normalWidth = wrapper.find("MultiGrid").props().width

    props = getProps({ ...fakeData(99, 1) })
    wrapper = shallow(<DataFrame {...props} />)
    const widthWithScrollbar = wrapper.find("MultiGrid").props().width

    expect(widthWithScrollbar).toBe(normalWidth + SCROLLBAR_SIZE)
  })
})
