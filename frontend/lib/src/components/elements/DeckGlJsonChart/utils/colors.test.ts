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

import { getContextualFillColor, SerializedColorArray } from "./colors"

describe("#getContextualFillColor", () => {
  const object = { count: 10 }
  const selectedColor: SerializedColorArray = [255, 75, 75]
  const unselectedColor: SerializedColorArray = [25, 25, 25]

  const testCases: [
    string,
    Parameters<typeof getContextualFillColor>[0],
    ReturnType<typeof getContextualFillColor>,
  ][] = [
    [
      "should return the original fill color with lower opacity when not selected",
      {
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [0, 0, 0, 255],
        selectedColor,
        unselectedColor,
      },
      [0, 0, 0, 102],
    ],
    [
      "should preserve original lower opacity when not selected",
      {
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [0, 0, 0, 40],
        selectedColor,
        unselectedColor,
      },
      [0, 0, 0, 40],
    ],
    // @see https://deck.gl/docs/api-reference/json/conversion-reference#functions-and-using-the--prefix
    [
      "should evaluate @@= expression with array syntax (count <= 50)",
      {
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => "@@=[255, 255, count > 50 ? 255 : 0]",
        selectedColor,
        unselectedColor,
      },
      [255, 255, 0, 102],
    ],
    [
      "should evaluate @@= expression with array syntax (count > 50)",
      {
        isSelected: false,
        object: { count: 200 },
        objectInfo: { index: 0 },
        originalFillFunction: () => "@@=[255, 255, count > 50 ? 255 : 0]",
        selectedColor,
        unselectedColor,
      },
      [255, 255, 255, 102],
    ],
    [
      "should evaluate @@= ternary expression returning array",
      {
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () =>
          "@@=count > 10 ? [255, 0, 0] : [0, 255, 200]",
        selectedColor,
        unselectedColor,
      },
      [0, 255, 200, 102],
    ],
    [
      "should evaluate @@= expression referencing object property (3-element color)",
      {
        isSelected: false,
        object: { color: [124, 54, 66] },
        objectInfo: { index: 0 },
        originalFillFunction: () => "@@=color",
        selectedColor,
        unselectedColor,
      },
      [124, 54, 66, 102],
    ],
    [
      "should evaluate @@= expression referencing object property (4-element color with low opacity)",
      {
        isSelected: false,
        object: { color: [124, 54, 66, 40] },
        objectInfo: { index: 0 },
        originalFillFunction: () => "@@=color",
        selectedColor,
        unselectedColor,
      },
      [124, 54, 66, 40],
    ],
    [
      "should handle shorthand single-element color array",
      {
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [255],
        selectedColor,
        unselectedColor,
      },
      [255, 0, 0, 102],
    ],
    [
      "should return full opacity when selected",
      {
        isSelected: true,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [0, 0, 0, 255],
        selectedColor,
        unselectedColor,
      },
      [0, 0, 0, 255],
    ],
    [
      "should boost low opacity to full when selected",
      {
        isSelected: true,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [0, 0, 0, 40],
        selectedColor,
        unselectedColor,
      },
      [0, 0, 0, 255],
    ],
  ]

  it.each(testCases)("%s", (_description, args, expected) => {
    expect(getContextualFillColor(args)).toEqual(expected)
  })

  describe("fallback colors", () => {
    it.each([
      ["originalFillFunction returns non-array value", () => 123],
      ["originalFillFunction is undefined", undefined],
    ])(
      "should return selected fallback color when %s and item is selected",
      (_scenario, originalFillFunction) => {
        const result = getContextualFillColor({
          isSelected: true,
          object,
          objectInfo: { index: 0 },
          originalFillFunction,
          selectedColor,
          unselectedColor,
        })
        expect(result).toEqual(selectedColor)
      }
    )

    it.each([
      ["originalFillFunction returns non-array value", () => 123],
      ["originalFillFunction is undefined", undefined],
    ])(
      "should return unselected fallback color when %s and item is not selected",
      (_scenario, originalFillFunction) => {
        const result = getContextualFillColor({
          isSelected: false,
          object,
          objectInfo: { index: 0 },
          originalFillFunction,
          selectedColor,
          unselectedColor,
        })
        expect(result).toEqual(unselectedColor)
      }
    )
  })

  describe("custom opacity values", () => {
    it("should use custom selectedOpacity when provided", () => {
      const result = getContextualFillColor({
        isSelected: true,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [100, 100, 100, 50],
        selectedColor,
        unselectedColor,
        selectedOpacity: 200,
      })
      // selectedOpacity is 200, original is 50, so max(50, 200) = 200
      expect(result).toEqual([100, 100, 100, 200])
    })

    it("should use custom unselectedOpacity when provided", () => {
      const result = getContextualFillColor({
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [100, 100, 100, 255],
        selectedColor,
        unselectedColor,
        unselectedOpacity: 50,
      })
      // unselectedOpacity is 50, original is 255, so min(255, 50) = 50
      expect(result).toEqual([100, 100, 100, 50])
    })

    it("should respect original lower opacity when unselected", () => {
      const result = getContextualFillColor({
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [100, 100, 100, 30],
        selectedColor,
        unselectedColor,
        unselectedOpacity: 100,
      })
      // unselectedOpacity is 100, original is 30, so min(30, 100) = 30
      expect(result).toEqual([100, 100, 100, 30])
    })
  })

  describe("two-element color arrays", () => {
    it("should handle two-element color array", () => {
      const result = getContextualFillColor({
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [255, 128],
        selectedColor,
        unselectedColor,
      })
      // [255, 128] -> [255, 128, 0, 102] (with default unselected opacity)
      expect(result).toEqual([255, 128, 0, 102])
    })

    it("should handle three-element color array", () => {
      const result = getContextualFillColor({
        isSelected: false,
        object,
        objectInfo: { index: 0 },
        originalFillFunction: () => [255, 128, 64],
        selectedColor,
        unselectedColor,
      })
      // [255, 128, 64] -> [255, 128, 64, 102] (with default unselected opacity)
      expect(result).toEqual([255, 128, 64, 102])
    })
  })
})
