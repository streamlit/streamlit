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
import { shallow } from "src/lib/test_util"
import Button from "src/components/shared/Button"
import { Small } from "src/components/shared/TextElements"
import Pagination, { Props } from "./Pagination"

const getProps = (props: Partial<Props> = {}): Props => ({
  className: "",
  currentPage: 1,
  totalPages: 2,
  pageSize: 3,
  onNext: jest.fn(),
  onPrevious: jest.fn(),
  ...props,
})

describe("Pagination widget", () => {
  const props = getProps()
  const wrapper = shallow(<Pagination {...props} />)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("should show current and total pages", () => {
    const defaultProps = getProps({
      currentPage: 1,
      totalPages: 10,
    })
    const pagination = shallow(<Pagination {...defaultProps} />)
    expect(pagination.find(Small).text()).toBe(`Showing page 1 of 10`)
  })

  it("should be able to go to previous page", () => {
    const wrapper = shallow(<Pagination {...props} />)
    wrapper
      .find(Button)
      .at(0)
      .simulate("click")
    expect(props.onPrevious).toHaveBeenCalledTimes(1)
  })

  it("should be able to go to next page", () => {
    const wrapper = shallow(<Pagination {...props} />)
    wrapper
      .find(Button)
      .at(1)
      .simulate("click")
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })
})
