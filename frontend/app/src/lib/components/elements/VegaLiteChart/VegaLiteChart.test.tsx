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
import { fromJS, Map as ImmutableMap } from "immutable"
import { VegaLiteChart as VegaLiteChartProto } from "src/lib/proto"
import { tableGetRowsAndCols } from "src/lib/dataframes/dataFrameProto"
import { mockTheme } from "src/lib/mocks/mockTheme"

import mock from "./mock"
import {
  PropsWithHeight,
  VegaLiteChart,
  dataIsAnAppendOfPrev,
} from "./VegaLiteChart"

const getProps = (
  elementProps: Partial<VegaLiteChartProto> = {},
  props: Partial<PropsWithHeight> = {}
): PropsWithHeight => ({
  element: fromJS({
    ...mock,
    ...elementProps,
  }) as ImmutableMap<string, any>,
  width: 0,
  height: 0,
  theme: mockTheme.emotion,
  ...props,
})

const baseCase = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12] }, type: "int64s" },
      { strings: { data: ["A", "B", "C"] }, type: "strings" },
    ],
  },
})

const case1 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12] }, type: "int64s" },
      { strings: { data: ["A", "B", "C"] }, type: "strings" },
      { strings: { data: ["D", "E", "F"] }, type: "strings" },
    ],
  },
})

const case2 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12] }, type: "int64s" },
      { strings: { data: ["A", "B", "C"] }, type: "strings" },
    ],
  },
})

const case3 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55] }, type: "int64s" },
      { strings: { data: ["A", "B"] }, type: "strings" },
    ],
  },
})

const case4 = fromJS({
  data: {
    cols: [
      { int64s: { data: [] }, type: "int64s" },
      { strings: { data: [] }, type: "strings" },
    ],
  },
})

const case5 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12, 17] }, type: "int64s" },
      { strings: { data: ["Z", "B", "C", "D"] }, type: "strings" },
    ],
  },
})

const case6 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12, 17] }, type: "int64s" },
      { strings: { data: ["A", "B", "Z", "D"] }, type: "strings" },
    ],
  },
})

const case7 = fromJS({
  data: {
    cols: [
      { int64s: { data: [28, 55, 12, 17] }, type: "int64s" },
      { strings: { data: ["A", "B", "C", "D"] }, type: "strings" },
    ],
  },
})

describe("VegaLiteChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<VegaLiteChart {...props} />)

    expect(wrapper.find("StyledVegaLiteChartContainer").length).toBe(1)
  })

  const cases = [
    [baseCase, case1, false, "Case 1: number of columns don't match"],
    [baseCase, case2, false, "Case 2: same number of rows"],
    [baseCase, case3, false, "Case 3: previous number of rows greater"],
    [case4, baseCase, false, "Case 4: no previous rows"],
    [
      baseCase,
      case5,
      false,
      "Case 5: light comparison fails, changed value of last column, first row",
    ],
    [
      baseCase,
      case6,
      false,
      "Case 6: light comparison fails, changed value of last column, second to last row",
    ],
    [baseCase, case7, true, "Case 7: data is an append"],
  ]

  cases.forEach(([prevData, data, expected, testDescription]) => {
    it(`tests for appended data properly - ${testDescription}`, () => {
      const [prevNumRows, prevNumCols] = tableGetRowsAndCols(
        (prevData as ImmutableMap<string, number>).get("data")
      )
      const [numRows, numCols] = tableGetRowsAndCols(
        (data as ImmutableMap<string, number>).get("data")
      )

      expect(
        dataIsAnAppendOfPrev(
          prevData as ImmutableMap<string, number>,
          prevNumRows,
          prevNumCols,
          data as ImmutableMap<string, number>,
          numRows,
          numCols
        )
      ).toEqual(expected)
    })
  })

  it("pulls default config values from theme", () => {
    const props = getProps(undefined, { theme: mockTheme.emotion })

    const wrapper = mount<VegaLiteChart>(<VegaLiteChart {...props} />)
    const generatedSpec = wrapper.instance().generateSpec()

    expect(generatedSpec.config.background).toBe(
      mockTheme.emotion.colors.bgColor
    )
    expect(generatedSpec.config.axis.labelColor).toBe(
      mockTheme.emotion.colors.bodyText
    )
  })

  it("has user specified config take priority", () => {
    const props = getProps(undefined, { theme: mockTheme.emotion })

    const spec = JSON.parse(props.element.get("spec"))
    spec.config = { background: "purple", axis: { labelColor: "blue" } }

    props.element = fromJS({
      ...props.element.toObject(),
      spec: JSON.stringify(spec),
    }) as ImmutableMap<string, any>

    const wrapper = mount<VegaLiteChart>(<VegaLiteChart {...props} />)
    const generatedSpec = wrapper.instance().generateSpec()

    expect(generatedSpec.config.background).toBe("purple")
    expect(generatedSpec.config.axis.labelColor).toBe("blue")
    // Verify that things not overwritten by the user still fall back to the
    // theme default.
    expect(generatedSpec.config.axis.titleColor).toBe(
      mockTheme.emotion.colors.bodyText
    )
  })
})
