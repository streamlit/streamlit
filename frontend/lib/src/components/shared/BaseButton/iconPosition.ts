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

/**
 * Shared mapping from protobuf IconPosition enum to UI icon position values.
 */

import { streamlit } from "@streamlit/protobuf"
type UiIconPosition = "left" | "right"

const ICON_POSITION_MAP: Record<
  streamlit.ButtonLikeIconPosition,
  UiIconPosition
> = {
  [streamlit.ButtonLikeIconPosition.LEFT]: "left",
  [streamlit.ButtonLikeIconPosition.RIGHT]: "right",
} as const

export function mapProtoIconPosition(
  iconPosition: streamlit.ButtonLikeIconPosition | null | undefined
): UiIconPosition {
  return ICON_POSITION_MAP[
    iconPosition ?? streamlit.ButtonLikeIconPosition.LEFT
  ]
}
