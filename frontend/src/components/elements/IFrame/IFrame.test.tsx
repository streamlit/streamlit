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
import { ShallowWrapper } from "enzyme"
import { shallow } from "src/lib/test_util"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "src/lib/IFrameUtil"

import { IFrame as IFrameProto } from "src/autogen/proto"
import IFrame, { IFrameProps } from "./IFrame"

const getProps = (elementProps: Partial<IFrameProto> = {}): IFrameProps => ({
  element: IFrameProto.create({
    ...elementProps,
  }),
  width: 100,
})

describe("st.iframe", () => {
  it("should render an iframe", () => {
    const props = getProps({})
    const wrapper = shallow(<IFrame {...props} />)
    expect(wrapper.find("iframe").length).toBe(1)
  })

  it("should set iframe height", () => {
    const props = getProps({
      height: 400,
    })
    const wrapper = shallow(<IFrame {...props} />)
    expect(wrapper.find("iframe").prop("height")).toBe(400)
  })

  describe("Render iframe with `src` parameter", () => {
    let wrapper: ShallowWrapper

    beforeAll(() => {
      const props = getProps({
        src: "foo",
        srcdoc: "bar",
      })
      wrapper = shallow(<IFrame {...props} />)
    })

    it("should set `srcDoc` to undefined", () => {
      expect(wrapper.find("iframe").prop("srcDoc")).toBe(undefined)
    })

    it("should set `src`", () => {
      expect(wrapper.find("iframe").prop("src")).toBe("foo")
    })

    it("should use our default feature policy", () => {
      expect(wrapper.find("iframe").prop("allow")).toBe(
        DEFAULT_IFRAME_FEATURE_POLICY
      )
    })

    it("should use our default sandbox policy", () => {
      expect(wrapper.find("iframe").prop("sandbox")).toBe(
        DEFAULT_IFRAME_SANDBOX_POLICY
      )
    })
  })

  describe("Render iframe with `srcDoc` parameter", () => {
    let wrapper: ShallowWrapper

    beforeAll(() => {
      const props = getProps({
        srcdoc: "bar",
      })
      wrapper = shallow(<IFrame {...props} />)
    })

    it("should set `srcDoc`", () => {
      expect(wrapper.find("iframe").prop("srcDoc")).toBe("bar")
    })

    it("should use our default feature policy", () => {
      expect(wrapper.find("iframe").prop("allow")).toBe(
        DEFAULT_IFRAME_FEATURE_POLICY
      )
    })

    it("should use our default sandbox policy", () => {
      expect(wrapper.find("iframe").prop("sandbox")).toBe(
        DEFAULT_IFRAME_SANDBOX_POLICY
      )
    })
  })

  describe("Render iframe with specified width", () => {
    it("should set element width", () => {
      const props = getProps({
        hasWidth: true,
        width: 200,
      })
      const wrapper = shallow(<IFrame {...props} />)
      expect(wrapper.find("iframe").prop("width")).toBe(200)
    })

    it("should set app width", () => {
      const props = getProps({})
      const wrapper = shallow(<IFrame {...props} />)
      expect(wrapper.find("iframe").prop("width")).toBe(100)
    })
  })

  describe("Render iframe with scrolling", () => {
    it("should set style to {}", () => {
      const props = getProps({
        scrolling: true,
      })
      const wrapper = shallow(<IFrame {...props} />)
      expect(wrapper.find("iframe").prop("style")).toEqual({})
    })

    it("should set `overflow` to hidden", () => {
      const props = getProps({})
      const wrapper = shallow(<IFrame {...props} />)
      expect(wrapper.find("iframe").prop("style")).toEqual({
        overflow: "hidden",
      })
    })
  })
})
