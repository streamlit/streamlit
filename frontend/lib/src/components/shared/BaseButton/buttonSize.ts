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

export type ButtonControlSize =
  | "xxsmall"
  | "xsmall"
  | "small"
  | "medium"
  | "large"

/**
 * Converts the button proto's `size` field to a `controlSize` value,
 * defaulting to "medium" (2.5rem) when the field is unset.
 */
export function mapProtoButtonSize(
  size: streamlit.ButtonLikeSize | null | undefined
): ButtonControlSize {
  switch (size) {
    case streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_XXSMALL:
      return "xxsmall"
    case streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_XSMALL:
      return "xsmall"
    case streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_SMALL:
      return "small"
    case streamlit.ButtonLikeSize.BUTTON_LIKE_SIZE_LARGE:
      return "large"
    default:
      return "medium"
  }
}
