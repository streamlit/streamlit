/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { MultiGrid } from "react-virtualized"

import mockDataFrame from "./mock"
import { DataFrame, Props, MIN_CELL_WIDTH_PX } from "./DataFrame"

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    ...mockDataFrame,
    ...elementProps,
  }),
  width: 400,
  height: 400,
})

describe("DataFrame Element", () => {
  const props = getProps()
  const wrapper = shallow(<DataFrame {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(MultiGrid).length).toBe(1)
  })

  it("should have correct className", () => {
    expect(
      wrapper
        .find("div")
        .first()
        .prop("className")
    ).toContain("stDataFrame")
  })

  it("multigrid should be rendered correctly", () => {
    const multiGridProps = wrapper.find(MultiGrid).props()

    expect(multiGridProps.fixedColumnCount).toBe(1)
    expect(multiGridProps.fixedRowCount).toBe(1)
    expect(multiGridProps.columnCount).toBe(11)
    expect(multiGridProps).toHaveProperty("enableFixedColumnScroll")
    expect(multiGridProps).toHaveProperty("enableFixedRowScroll")
    expect(multiGridProps.height).toBe(275)
    expect(multiGridProps.rowHeight).toBe(25)
    expect(multiGridProps.rowCount).toBe(11)
    expect(multiGridProps.width).toBe(398)
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
    expect(multiGridProps.height).toBe(MIN_CELL_WIDTH_PX)
    expect(multiGridProps.rowHeight).toBe(MIN_CELL_WIDTH_PX)
    expect(multiGridProps.rowCount).toBe(1)
    expect(multiGridProps.width).toBe(60)
  })
})
