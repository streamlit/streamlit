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
import { shallow, mount } from "enzyme"
import Pagination from "./Pagination"

import withPagination, { Props as HocProps } from "./withPagination"

interface TestProps {
  items: any[]
}

const TestComponent: React.ComponentType = () => <div>test</div>

const getProps = (props: Partial<HocProps> = {}): HocProps => ({
  className: "",
  items: [{}, {}, {}, {}],
  pageSize: 2,
  resetOnAdd: true,
  ...props,
})

describe("withPagination HOC", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const WithHoc = withPagination(TestComponent)
    // @ts-ignore
    const wrapper = shallow(<WithHoc {...props} />)
    const pagination = wrapper.find(Pagination)

    expect(wrapper).toBeDefined()
  })

  it("should render a paginated component", () => {
    const props = getProps({
      pageSize: 3,
      items: [{}, {}, {}, {}],
    })
    const WithHoc = withPagination(TestComponent)
    const wrapper = mount(<WithHoc {...props} />)
    const pagination = wrapper.find(Pagination)
    const paginatedComponent = wrapper.find(TestComponent)

    // @ts-ignore
    expect(paginatedComponent.props().items.length).toBe(props.pageSize)
    expect(pagination.length).toBe(1)
    expect(wrapper.state("totalPages")).toBe(2)
  })

  it("should render component without pagination", () => {
    const props = getProps({
      pageSize: 5,
      items: [{}, {}, {}, {}],
    })
    const WithHoc = withPagination(TestComponent)
    const wrapper = mount(<WithHoc {...props} />)
    const pagination = wrapper.find(Pagination)
    const paginatedComponent = wrapper.find(TestComponent)

    expect(pagination.length).toBe(0)
    expect(wrapper.state("totalPages")).toBe(1)
    // @ts-ignore
    expect(paginatedComponent.props().items.length).toBe(props.items.length)
  })

  it("should reset on add", () => {
    const props = getProps()
    const WithHoc = withPagination(TestComponent)
    const wrapper = mount(<WithHoc {...props} />)
    wrapper.setProps(getProps({ items: props.items.concat([{}]) }))

    expect(wrapper.state("currentPage")).toBe(0)
  })
})
