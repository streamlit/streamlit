/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  LabelVisibilityMessage as LabelVisibilityMessageProto,
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
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.VISIBLE,
      },
    })
    expect(getTextAreaHeight(outerElement, element)).toBe("70px")
  })

  it("returns calculated px height if pixelHeight is set and label is collapsed", () => {
    const outerElement = new Element({ heightConfig: { pixelHeight: 100 } })
    const element = new TextArea({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
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
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    // Should match the same as visible (30px padding)
    expect(getTextAreaHeight(outerElement, element)).toBe("70px")
  })
})
