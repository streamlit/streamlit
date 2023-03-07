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

import React, { ReactElement } from "react"
import { shallow, mount } from "src/lib/test_util"

import VirtualDropdown from "./VirtualDropdown"

interface OptionProps {
  item?: { value: string }
}

function Option(props: OptionProps): ReactElement {
  return <span className={props.item ? props.item.value : "nothing"} />
}

describe("VirtualDropdown element", () => {
  it("renders a StyledEmptyState when it has no children", () => {
    const wrapper = shallow(<VirtualDropdown />)

    expect(wrapper.find("StyledEmptyState").exists()).toBeTruthy()
  })

  it("renders a StyledEmptyState when it has children with no item", () => {
    const wrapper = shallow(
      <VirtualDropdown>
        <Option />
      </VirtualDropdown>
    )

    expect(wrapper.find("StyledEmptyState").exists()).toBeTruthy()
  })

  it("renders a FixedSizeList when it has children", () => {
    const wrapper = mount(
      <VirtualDropdown>
        <Option item={{ value: "abc" }} />
      </VirtualDropdown>
    )

    expect(wrapper.find("FixedSizeListItem").exists()).toBeTruthy()
  })
})
