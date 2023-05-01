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
import { mount } from "src/lib/test_util"

import { BaseProvider, LightTheme } from "baseui"
import { Spinner as SpinnerProto } from "src/lib/proto"
import Spinner, { SpinnerProps } from "./Spinner"

const getProps = (
  propOverrides: Partial<SpinnerProps> = {}
): SpinnerProps => ({
  element: SpinnerProto.create({
    text: "Loading...",
  }),
  width: 0,
  ...propOverrides,
})

describe("Spinner component", () => {
  it("renders without crashing", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps()} />
      </BaseProvider>
    )

    expect(wrapper.find("StyledSpinnerContainer").length).toBe(1)
    expect(wrapper.find("StyledSpinnerContainer").html()).toMatchSnapshot()
  })

  it("sets the text and width correctly", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({ width: 100 })} />
      </BaseProvider>
    )

    expect(wrapper.find("StreamlitMarkdown").prop("source")).toEqual(
      "Loading..."
    )
    expect(wrapper.find("Spinner").prop("width")).toEqual(100)
  })
})
