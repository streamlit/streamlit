/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
    ReturnType<typeof getContextualFillColor>
  ][] = [
    [
      "should return the original fill color when not selected",
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
      "should return the original fill color with its original lower opacity when not selected",
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
      "should return the evaluated original fill color with lower opacity when not selected",
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
      "should return the evaluated original fill color with lower opacity when not selected",
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
      "should return the evaluated original fill color with lower opacity when not selected",
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
      "should return the evaluated original fill color with lower opacity when not selected",
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
      "should return the evaluated original fill color with its existing lower opacity when not selected",
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
      "should return the original shorthand fill color with lower opacity when not selected",
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
      "should return the original color when selected",
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
      "should return the original color with higher opacity when selected",
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

  it.each(testCases)("%s", (description, args, expected) => {
    expect(getContextualFillColor(args)).toEqual(expected)
  })
})
