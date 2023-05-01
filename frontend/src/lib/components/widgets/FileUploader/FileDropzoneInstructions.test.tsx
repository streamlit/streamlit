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
import { mount, shallow } from "src/lib/test_util"

import { Small } from "src/lib/components/shared/TextElements"
import FileDropzoneInstructions, { Props } from "./FileDropzoneInstructions"

const getProps = (props: Partial<Props> = {}): Props => ({
  multiple: true,
  acceptedExtensions: [],
  maxSizeBytes: 2000,
  ...props,
})

describe("FileDropzoneInstructions widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileDropzoneInstructions {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("shows file size limit", () => {
    const props = getProps({ maxSizeBytes: 2000 })
    const wrapper = mount(<FileDropzoneInstructions {...props} />)
    const smallWrapper = wrapper.find(Small)

    expect(smallWrapper.text()).toBe("Limit 2KB per file")
  })

  it("renders without extensions", () => {
    const props = getProps({
      acceptedExtensions: [],
    })
    const wrapper = mount(<FileDropzoneInstructions {...props} />)
    const smallWrapper = wrapper.find(Small)
    expect(smallWrapper.text()).toMatch(/per file$/)
  })

  it("renders with extensions", () => {
    const props = getProps({
      acceptedExtensions: ["jpg"],
    })
    const wrapper = mount(<FileDropzoneInstructions {...props} />)
    const smallWrapper = wrapper.find(Small)
    expect(smallWrapper.text()).toMatch(/•/)
  })
})
