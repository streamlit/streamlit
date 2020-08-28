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
import { Map as ImmutableMap } from "immutable"
import { Kind } from "components/shared/AlertContainer"
import { Alert as AlertProto } from "autogen/proto"
import Alert, { AlertProps } from "./Alert"

const getProps = (elementProps: Record<string, unknown> = {}): AlertProps => ({
  element: ImmutableMap({
    body: "Something happened!",
    ...elementProps,
  }),
  width: 100,
})

describe("Alert element", () => {
  it("renders an ERROR box as expected", () => {
    const format = AlertProto.Format.ERROR
    const props = getProps({
      format,
      body: "#what in the world?",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.ERROR)
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "#what in the world?"
    )
  })

  it("renders a WARNING box as expected", () => {
    const format = AlertProto.Format.WARNING
    const props = getProps({
      format,
      body: "Are you *sure*?",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.WARNING)
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "Are you *sure*?"
    )
  })

  it("renders a SUCCESS box as expected", () => {
    const format = AlertProto.Format.SUCCESS
    const props = getProps({
      format,
      body: "But our princess was in another castle!",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.SUCCESS)
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "But our princess was in another castle!"
    )
  })

  it("renders an INFO box as expected", () => {
    const format = AlertProto.Format.INFO
    const props = getProps({
      format,
      body: "It's dangerous to go alone.",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.INFO)
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "It's dangerous to go alone."
    )
  })

  it("should throw an error when the format is invalid", () => {
    const props = getProps({
      format: "test",
      body: "It's dangerous to go alone.",
    })

    expect(() => {
      shallow(<Alert {...props} />)
    }).toThrow("Unexpected alert type: test")
  })
})
