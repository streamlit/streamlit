/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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
import { chunk, random, range, times } from "lodash"

import { mount } from "src/lib/test_util"
import { Quiver } from "src/lib/Quiver"
import { UNICODE } from "src/lib/mocks/arrow"

import DataGrid, { DataGridProps } from "./DataGrid"

const getProps = (data: Quiver): DataGridProps => ({
  element: data,
  width: 400,
  height: 400,
})

const fakeData = (
  numRows: number,
  numCols: number,
  randomize = true
): Quiver => {
  // Create a sample Quiver object.
  const q = new Quiver({ data: UNICODE })

  // Modify the private members directly.
  // NOTE: Only do this for tests!

  // @ts-ignore
  q._index = range(0, numRows).map(item => [item])

  // @ts-ignore
  q._columns = [range(0, numCols)]

  // @ts-ignore
  q._data = randomize
    ? times(numRows, () => times(numCols, () => random(0, 9)))
    : chunk(range(0, numRows * numCols), numCols)

  return q
}

describe("DataGrid widget", () => {
  const props = getProps(fakeData(10, 10, false))
  const wrapper = mount(<DataGrid {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find("GlideDataEditor").length).toBe(1)
    fakeData(2, 5)
  })

  it("should have correct className", () => {
    expect(wrapper.find("DataGridContainer").prop("className")).toContain(
      "stDataGrid"
    )
  })

  it("grid container should render with specific size", () => {
    const dataGridContainer = wrapper.find("DataGridContainer").props() as any
    expect(dataGridContainer.width).toBe(400)
    expect(dataGridContainer.height).toBe(400)
  })

  it("glide table should render with specific size", () => {
    const glideDataEditor = wrapper.find("GlideDataEditor").props() as any
    expect(glideDataEditor.width).toBe(400)
    expect(glideDataEditor.height).toBe(400)
  })

  it("should render an dnv-scroller container", () => {
    expect(wrapper.find("div").prop("className")).toContain("dvn-scroller")
  })
})
