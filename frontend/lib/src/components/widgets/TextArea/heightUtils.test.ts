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

import { getTextAreaHeight } from "./heightUtils"
import { LabelVisibilityOptions } from "~lib/util/utils"

describe("getTextAreaHeight", () => {
  const baseOuterElement = {
    heightConfig: {},
  }
  const baseElement = {
    labelVisibility: { value: undefined },
  }

  it("returns '100%' if useStretch is true", () => {
    const outerElement = {
      ...baseOuterElement,
      heightConfig: { useStretch: true },
    }
    expect(getTextAreaHeight(outerElement as any, baseElement as any)).toBe(
      "100%"
    )
  })

  it("returns calculated px height if pixelHeight is set and label is visible", () => {
    const outerElement = {
      ...baseOuterElement,
      heightConfig: { pixelHeight: 100 },
    }
    const element = {
      ...baseElement,
      labelVisibility: { value: LabelVisibilityOptions.Visible },
    }
    expect(getTextAreaHeight(outerElement as any, element as any)).toBe("70px")
  })

  it("returns calculated px height if pixelHeight is set and label is collapsed", () => {
    const outerElement = {
      ...baseOuterElement,
      heightConfig: { pixelHeight: 100 },
    }
    const element = {
      ...baseElement,
      labelVisibility: { value: LabelVisibilityOptions.Collapsed },
    }
    expect(getTextAreaHeight(outerElement as any, element as any)).toBe("98px")
  })

  it("returns 'auto' if no height config is set", () => {
    expect(
      getTextAreaHeight(baseOuterElement as any, baseElement as any)
    ).toBe("auto")
  })

  it("returns 'auto' if useContent is true", () => {
    const outerElement = {
      ...baseOuterElement,
      heightConfig: { useContent: true },
    }
    expect(getTextAreaHeight(outerElement as any, baseElement as any)).toBe(
      "auto"
    )
  })

  it("returns calculated px height if pixelHeight is set and label is hidden", () => {
    const outerElement = {
      ...baseOuterElement,
      heightConfig: { pixelHeight: 100 },
    }
    const element = {
      ...baseElement,
      labelVisibility: { value: LabelVisibilityOptions.Hidden },
    }
    // Should match the same as visible (30px padding)
    expect(getTextAreaHeight(outerElement as any, element as any)).toBe("70px")
  })
})
