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

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { Direction, getDirectionOfBlock, shouldChildrenStretch } from "./utils"

describe("getDirectionOfBlock", () => {
  const testCases = [
    {
      description:
        "returns HORIZONTAL when flexContainer direction is HORIZONTAL",
      block: {
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        },
      },
      expected: Direction.HORIZONTAL,
    },
    {
      description: "returns VERTICAL when flexContainer direction is VERTICAL",
      block: {
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.VERTICAL,
        },
      },
      expected: Direction.VERTICAL,
    },
    {
      description:
        "returns VERTICAL when block has vertical property (backwards compatibility)",
      block: {
        vertical: {},
      },
      expected: Direction.VERTICAL,
    },
    {
      description:
        "returns HORIZONTAL when block has horizontal property (backwards compatibility)",
      block: {
        horizontal: {},
      },
      expected: Direction.HORIZONTAL,
    },
    {
      description:
        "returns VERTICAL as default when block has no direction properties",
      block: {},
      expected: Direction.VERTICAL,
    },
    {
      description: "prioritizes flexContainer over legacy properties",
      block: {
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        },
        vertical: {},
      },
      expected: Direction.HORIZONTAL,
    },
  ]

  test.each(testCases)("$description", ({ block, expected }) => {
    const blockProto = new BlockProto(block)
    expect(getDirectionOfBlock(blockProto)).toBe(expected)
  })
})

describe("shouldChildrenStretch", () => {
  it("returns false if widthConfig is undefined", () => {
    expect(shouldChildrenStretch(undefined)).toBe(false)
  })

  it("returns true if useStretch is true", () => {
    const widthConfig = { useStretch: true } as streamlit.WidthConfig
    expect(shouldChildrenStretch(widthConfig)).toBe(true)
  })

  it("returns true if pixelWidth is a positive number", () => {
    const widthConfig = { pixelWidth: 200 } as streamlit.WidthConfig
    expect(shouldChildrenStretch(widthConfig)).toBe(true)
  })

  it("returns false if pixelWidth is 0", () => {
    const widthConfig = { pixelWidth: 0 } as streamlit.WidthConfig
    expect(shouldChildrenStretch(widthConfig)).toBe(false)
  })

  it("returns false if useContent is true", () => {
    const widthConfig = { useContent: true } as streamlit.WidthConfig
    expect(shouldChildrenStretch(widthConfig)).toBe(false)
  })

  it("returns false for an empty widthConfig object", () => {
    const widthConfig = {} as streamlit.WidthConfig
    expect(shouldChildrenStretch(widthConfig)).toBe(false)
  })
})
