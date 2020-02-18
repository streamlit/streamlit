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
import { Table as ReactTable } from "reactstrap"
import { fromJS } from "immutable"
import { Table, Props } from "./Table"

const getProps = (elementProps = {}): Props => ({
  element: fromJS({
    uuid: "custom_uuid",
    caption: "The caption",
    ...elementProps,
  }),
  width: 100,
})

describe("Table element", () => {
  const props = getProps()
  const wrapper = shallow(<Table {...props} />)
  const table = wrapper.find(ReactTable)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("checks empty table", () => {
    expect(table.find("td").text()).toBe("empty")
  })

  it("checks custom UUID", () => {
    expect(table.prop("id")).toBe("T_custom_uuid")
  })

  it("checks caption", () => {
    expect(table.find("caption").text()).toBe("The caption")
  })
})
