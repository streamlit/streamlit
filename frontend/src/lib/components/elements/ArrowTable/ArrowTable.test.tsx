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
import { mount } from "src/lib/test_util"

import { UNICODE, EMPTY } from "src/lib/mocks/arrow"
import { Quiver } from "src/lib/dataframes/Quiver"
import { ArrowTable, TableProps } from "./ArrowTable"

const getProps = (data: Uint8Array): TableProps => ({
  element: new Quiver({ data }),
})

describe("st._arrow_table", () => {
  it("renders without crashing", () => {
    const props = getProps(UNICODE)
    const wrapper = mount(<ArrowTable {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeFalsy()
  })

  it("renders an empty row", () => {
    const props = getProps(EMPTY)
    const wrapper = mount(<ArrowTable {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeTruthy()
  })
})
