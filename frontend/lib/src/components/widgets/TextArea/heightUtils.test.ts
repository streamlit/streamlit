/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
import {
  Element,
  LabelVisibility as LabelVisibilityProto,
  TextArea,
} from "@streamlit/protobuf"

import { getTextAreaHeight } from "./heightUtils"

describe("getTextAreaHeight", () => {
  const baseOuterElement = new Element({ heightConfig: {} })
  const baseElement = new TextArea({ labelVisibility: { value: undefined } })

  it("returns '100%' if useStretch is true", () => {
    const outerElement = new Element({ heightConfig: { useStretch: true } })
    expect(getTextAreaHeight(outerElement, baseElement)).toBe("100%")
  })

  it("returns calculated px height if pixelHeight is set and label is visible", () => {
    const outerElement = new Element({ heightConfig: { pixelHeight: 100 } })
    const element = new TextArea({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
      },
    })
    expect(getTextAreaHeight(outerElement, element)).toBe("70px")
  })

  it("returns calculated px height if pixelHeight is set and label is collapsed", () => {
    const outerElement = new Element({ heightConfig: { pixelHeight: 100 } })
    const element = new TextArea({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    expect(getTextAreaHeight(outerElement, element)).toBe("98px")
  })

  it("returns 'auto' if no height config is set", () => {
    expect(getTextAreaHeight(baseOuterElement, baseElement)).toBe("auto")
  })

  it("returns 'auto' if useContent is true", () => {
    const outerElement = new Element({ heightConfig: { useContent: true } })
    expect(getTextAreaHeight(outerElement, baseElement)).toBe("auto")
  })

  it("returns calculated px height if pixelHeight is set and label is hidden", () => {
    const outerElement = new Element({ heightConfig: { pixelHeight: 100 } })
    const element = new TextArea({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    // Should match the same as visible (30px padding)
    expect(getTextAreaHeight(outerElement, element)).toBe("70px")
  })

  describe("negative height clamping (gh-12867)", () => {
    it.each([
      {
        pixelHeight: 10,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
        expected: "0px",
        description: "clamps negative height (10 - 30 = -20)",
      },
      {
        pixelHeight: 1,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
        expected: "0px",
        description:
          "clamps negative height with collapsed label (1 - 2 = -1)",
      },
      {
        pixelHeight: 29,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
        expected: "0px",
        description: "clamps at boundary case (29 - 30 = -1)",
      },
      {
        pixelHeight: 30,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
        expected: "0px",
        description: "returns 0px at exact boundary (30 - 30 = 0)",
      },
      {
        pixelHeight: 2,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
        expected: "0px",
        description:
          "returns 0px at exact boundary with collapsed label (2 - 2 = 0)",
      },
      {
        pixelHeight: 31,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
        expected: "1px",
        description:
          "returns positive height when above boundary (31 - 30 = 1)",
      },
      {
        pixelHeight: 3,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
        expected: "1px",
        description:
          "returns positive height with collapsed label (3 - 2 = 1)",
      },
      {
        pixelHeight: 100,
        labelVisibility: LabelVisibilityProto.LabelVisibilityOptions.VISIBLE,
        expected: "70px",
        description: "returns correct height for normal case (100 - 30 = 70)",
      },
    ])("$description", ({ pixelHeight, labelVisibility, expected }) => {
      const outerElement = new Element({ heightConfig: { pixelHeight } })
      const element = new TextArea({
        labelVisibility: { value: labelVisibility },
      })
      expect(getTextAreaHeight(outerElement, element)).toBe(expected)
    })
  })
})
