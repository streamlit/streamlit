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
import { DataEditor as GlideDataEditor } from "@glideapps/glide-data-grid"

import { TEN_BY_TEN } from "src/lib/mocks/arrow"
import { mount } from "src/lib/test_util"
import { Quiver } from "src/lib/Quiver"

import DataGridContainer from "./DataGridContainer"
import DataGrid, { DataGridProps } from "./DataGrid"

const getProps = (data: Quiver): DataGridProps => ({
  element: data,
  width: 400,
  height: 400,
})

describe("DataGrid widget", () => {
  const props = getProps(new Quiver({ data: TEN_BY_TEN }))
  const wrapper = mount(<DataGrid {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(GlideDataEditor).length).toBe(1)
  })

  it("should have correct className", () => {
    expect(wrapper.find(DataGridContainer).prop("className")).toContain(
      "stDataGrid"
    )
  })

  it("grid container should render with specific size", () => {
    const dataGridContainer = wrapper.find(DataGridContainer).props() as any
    expect(dataGridContainer.width).toBe(400)
    expect(dataGridContainer.height).toBe(400)
  })

  // TODO(lukasmasuch): Unit tests for a few methods, such as fillCellTemplate, getColumn, useDataLoader, getCellTemplate, etc.
  //                    will be added in a later PR once support for different data types is added.
})
