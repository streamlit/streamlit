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

import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"

import {
  Metric as MetricProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "src/autogen/proto"
import Metric, { MetricProps } from "./Metric"

const getProps = (elementProps: Partial<MetricProto> = {}): MetricProps => ({
  element: MetricProto.create({
    color: MetricProto.MetricColor.RED,
    direction: MetricProto.MetricDirection.UP,
    delta: "test",
    ...elementProps,
  }),
})

describe("Metric element", () => {
  it("renders metric as expected", () => {
    const props = getProps()
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("renders metric label as expected", () => {
    const props = getProps()
    const wrapper = mount(<Metric {...props} />)
    const wrappedMetricLabel = wrapper.find(StreamlitMarkdown)

    expect(wrappedMetricLabel.props().source).toBe(getProps().element.label)
    expect(wrappedMetricLabel.props().isLabel).toBe(true)
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricLabelText").prop("visibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricLabelText").prop("visibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("renders direction icon based on props", () => {
    const props = getProps()
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").find("svg")).toBeDefined()
  })

  it("renders direction icon based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").find("svg")).toBeDefined()
  })

  it("renders no text and icon based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
      delta: "",
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").exists()).toBe(false)
  })

  it("renders correct gray based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").prop("style")?.color).toBe(
      "rgba(49, 51, 63, 0.6)"
    )
  })

  it("renders correct green based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").prop("style")?.color).toBe(
      "#09ab3b"
    )
  })

  it("renders correct red based on props", () => {
    const props = getProps()
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("StyledMetricDeltaText").prop("style")?.color).toBe(
      "#ff2b2b"
    )
  })

  it("should render TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    const wrapper = mount(<Metric {...props} />)
    expect(wrapper.find("TooltipIcon").prop("content")).toBe("help text")
  })
})
