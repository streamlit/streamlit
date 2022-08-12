import React from "react"
import { mount, shallow } from "src/lib/test_util"

import { Small } from "src/components/shared/TextElements"
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
