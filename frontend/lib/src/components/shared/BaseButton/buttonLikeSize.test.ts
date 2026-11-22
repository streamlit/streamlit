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

import { streamlit } from "@streamlit/protobuf"

import { mapButtonLikeControlSize } from "./buttonLikeSize"

describe("mapButtonLikeControlSize", () => {
  it.each([
    [streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_XXSMALL, "xxsmall"],
    [streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_XSMALL, "xsmall"],
    [streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_SMALL, "small"],
    [streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_MEDIUM, "medium"],
    [streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_LARGE, "large"],
  ])("maps proto value %s to %s", (protoSize, expected) => {
    expect(mapButtonLikeControlSize(protoSize)).toBe(expected)
  })

  it.each([undefined, null])("falls back to medium for %s", protoSize => {
    expect(mapButtonLikeControlSize(protoSize)).toBe("medium")
  })
})
