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

import React, { ReactElement } from "react"
import { shallow } from "enzyme"
import { Map as ImmutableMap } from "immutable"

import { StreamlitMarkdown } from "../../shared/StreamlitMarkdown"
import Alert, { getAlertCSSClass } from "./Alert"
import { Props as AlertProps } from "./Alert"
import { Alert as AlertProto } from "autogen/proto"

const getProps = (elementProps: object = {}): AlertProps => ({
  element: ImmutableMap({
    body: "Something happened!",
    ...elementProps,
  }),
  width: 100,
})

function elementClassIsCorrect(
  element: ReactElement,
  format: number
): boolean {
  return element.props.className.includes(getAlertCSSClass(format))
}

describe("Alert element", () => {
  it("renders an ERROR box as expected", () => {
    const format = AlertProto.Format.ERROR
    const props = getProps({
      format: format,
      body: "#what in the world?",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(elementClassIsCorrect(elem, format)).toBeTruthy()
    expect(wrap.find(StreamlitMarkdown).props().source).toBe(
      "#what in the world?"
    )
  })

  it("renders a WARNING box as expected", () => {
    const format = AlertProto.Format.WARNING
    const props = getProps({
      format: format,
      body: "Are you *sure*?",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(elementClassIsCorrect(elem, format)).toBeTruthy()
    expect(wrap.find(StreamlitMarkdown).props().source).toBe("Are you *sure*?")
  })

  it("renders a SUCCESS box as expected", () => {
    const format = AlertProto.Format.SUCCESS
    const props = getProps({
      format: format,
      body: "But our princess was in another castle!",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(elementClassIsCorrect(elem, format)).toBeTruthy()
    expect(wrap.find(StreamlitMarkdown).props().source).toBe(
      "But our princess was in another castle!"
    )
  })

  it("renders an INFO box as expected", () => {
    const format = AlertProto.Format.INFO
    const props = getProps({
      format: format,
      body: "It's dangerous to go alone.",
    })
    const wrap = shallow(<Alert {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(elementClassIsCorrect(elem, format)).toBeTruthy()
    expect(wrap.find(StreamlitMarkdown).props().source).toBe(
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
