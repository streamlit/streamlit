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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"

import {
  Metric as MetricProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/lib/src/proto"
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
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetric")).toBeInTheDocument()
  })

  it("renders metric label as expected", () => {
    const props = getProps()
    render(<Metric {...props} />)

    expect(screen.getByTestId("stMetricLabel")).toHaveTextContent(
      props.element.label
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN)
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED)
    )
  })

  it("renders direction icon based on props - red/up", () => {
    const props = getProps()
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDeltaIcon-Up")).toBeInTheDocument()
  })

  it("renders direction icon based on props - green/down", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDeltaIcon-Down")).toBeInTheDocument()
  })

  it("renders no text and icon based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
      delta: "",
    })
    render(<Metric {...props} />)
    expect(screen.queryByTestId("stMetricDeltaIcon")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stMetricDelta")).not.toBeInTheDocument()
  })

  it("renders correct gray based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgba(49, 51, 63, 0.6);"
    )
  })

  it("renders correct green based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(9, 171, 59);"
    )
  })

  it("renders correct red based on props", () => {
    const props = getProps()
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(255, 43, 43);"
    )
  })

  it("should render TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    render(<Metric {...props} />)
    const tooltip = screen.getByTestId("stTooltipIcon")
    expect(tooltip).toBeInTheDocument()
  })
})
