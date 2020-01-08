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
import { FileUploader as FileUploaderBaseui } from "baseui/file-uploader"
import { fromJS } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

import FileUploader, { Props } from "./FileUploader"

jest.mock("lib/WidgetStateManager")

const blolbFile = new File([""], "filename.txt", {
  type: "text/plain",
  lastModified: 0,
})
const sendBackMsg = jest.fn()
const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    type: [],
    progress: 0,
    maxUploadSizeMb: 50,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetStateManager: new WidgetStateManager(sendBackMsg),
})

describe("FileUploader widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.state("status")).toBe("READY")
  })

  it("should show a label", () => {
    const props = getProps({
      label: "Test label",
    })
    const wrapper = shallow(<FileUploader {...props} />)

    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should change the status drop a File", () => {
    const props = getProps()
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)

    const promise = internalFileUploader
      .props()
      .onDrop([blolbFile], [], null)
      .then(() => {
        expect(wrapper.state("status")).toBe("UPLOADING")
        expect(wrapper.find("div.uploadProgress").length).toBe(1)
      })
    expect(wrapper.state("status")).toBe("READING")
    return promise
  })

  it("should fail when File extension is not allowed", () => {
    const props = getProps({
      type: ["png"],
    })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)

    internalFileUploader.props().onDrop([], [blolbFile], null)
    expect(wrapper.state("status")).toBe("ERROR")
    expect(wrapper.state("errorMessage")).toBe(
      "text/plain files are not allowed"
    )
    expect(wrapper.find("div.uploadError").length).toBe(1)
  })

  it("should fail when maxUploadSizeMb = 0", () => {
    const props = getProps({
      maxUploadSizeMb: 0,
    })
    const wrapper = shallow(<FileUploader {...props} />)
    const internalFileUploader = wrapper.find(FileUploaderBaseui)

    internalFileUploader.props().onDrop([blolbFile], [], null)
    expect(wrapper.state("status")).toBe("ERROR")
    expect(wrapper.state("errorMessage")).toBe(
      "The max file size allowed is 0MB"
    )
    expect(wrapper.find("div.uploadError").length).toBe(1)
  })
})
