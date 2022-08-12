import React from "react"
import { shallow } from "src/lib/test_util"
import Dropzone from "react-dropzone"
import FileDropzone, { Props } from "./FileDropzone"

const getProps = (props: Partial<Props> = {}): Props => ({
  disabled: false,
  label: "LABEL",
  onDrop: jest.fn(),
  multiple: true,
  acceptedExtensions: [],
  maxSizeBytes: 200,
  ...props,
})

describe("FileDropzone widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileDropzone {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("renders dropzone without extensions", () => {
    const props = getProps({
      acceptedExtensions: [],
    })
    const wrapper = shallow(<FileDropzone {...props} />)
    const dropzoneWrapper = wrapper.find(Dropzone)
    expect(dropzoneWrapper.props().accept).toBe(undefined)
  })

  it("renders dropzone with extensions", () => {
    const props = getProps({
      acceptedExtensions: [".jpg"],
    })
    const wrapper = shallow(<FileDropzone {...props} />)
    const dropzoneWrapper = wrapper.find(Dropzone)
    expect(dropzoneWrapper.props().accept).toEqual([".jpg"])
  })
})
