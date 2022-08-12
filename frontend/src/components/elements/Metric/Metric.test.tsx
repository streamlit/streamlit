import React from "react"
import { Metric as MetricProto } from "src/autogen/proto"
import { mount } from "src/lib/test_util"
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
