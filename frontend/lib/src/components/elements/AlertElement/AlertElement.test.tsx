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

import { shallow } from "@streamlit/lib/src/test_util"
import { Kind } from "@streamlit/lib/src/components/shared/AlertContainer"
import { Alert as AlertProto } from "@streamlit/lib/src/proto"
import AlertElement, {
  AlertElementProps,
  getAlertElementKind,
} from "./AlertElement"

const getProps = (
  elementProps: Partial<AlertElementProps> = {}
): AlertElementProps => ({
  body: "Something happened!",
  kind: Kind.INFO,
  width: 100,
  ...elementProps,
})

describe("Alert element", () => {
  it("renders an ERROR box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.ERROR),
      body: "#what in the world?",
    })
    const wrap = shallow(<AlertElement {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.ERROR)
    expect(wrap.find("EmojiIcon")).toEqual({})
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "#what in the world?"
    )
  })

  it("renders a WARNING box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.WARNING),
      body: "Are you *sure*?",
    })
    const wrap = shallow(<AlertElement {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.WARNING)
    expect(wrap.find("EmojiIcon")).toEqual({})
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "Are you *sure*?"
    )
  })

  it("renders a SUCCESS box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.SUCCESS),
      body: "But our princess was in another castle!",
    })
    const wrap = shallow(<AlertElement {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.SUCCESS)
    expect(wrap.find("EmojiIcon")).toEqual({})
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "But our princess was in another castle!"
    )
  })

  it("renders an INFO box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "It's dangerous to go alone.",
    })
    const wrap = shallow(<AlertElement {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.INFO)
    expect(wrap.find("EmojiIcon")).toEqual({})
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "It's dangerous to go alone."
    )
  })

  it("accepts an icon", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "It's dangerous to go alone.",
      icon: "👉🏻",
    })
    const wrap = shallow(<AlertElement {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stAlert")).toBeTruthy()
    expect(wrap.find("AlertContainer").prop("kind")).toEqual(Kind.INFO)
    expect(wrap.find("StreamlitMarkdown").prop("source")).toBe(
      "It's dangerous to go alone."
    )
    expect(wrap.find("EmojiIcon")).toBeDefined()
    expect(wrap.find("EmojiIcon").prop("children")).toContain("👉🏻")
  })
})

test("getAlertElementKind throws an error on invalid format", () => {
  expect(() => getAlertElementKind(AlertProto.Format.UNUSED)).toThrow(
    `Unexpected alert type: ${AlertProto.Format.UNUSED}`
  )
})
