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

export enum Direction {
  HORIZONTAL = "row",
  VERTICAL = "column",
}

export type MinFlexElementWidth = "fit-content" | "14rem" | "8rem" | undefined

export function getDirectionOfBlock(block: BlockProto): Direction {
  if (block.flexContainer) {
    return block.flexContainer.direction ==
      BlockProto.FlexContainer.Direction.HORIZONTAL
      ? Direction.HORIZONTAL
      : Direction.VERTICAL
  } else if (block.vertical) {
    // Included for backwards compatibility of old proto messages.
    return Direction.VERTICAL
  } else if (block.horizontal) {
    // Included for backwards compatibility of old proto messages.
    return Direction.HORIZONTAL
  }
  return Direction.VERTICAL
}

export function shouldChildrenStretch(
  widthConfig: streamlit.IWidthConfig | undefined | null
): boolean {
  // Some elements (e.g. ButtonGroup) need styles applied to the element itself, to support
  // the width configuration.
  return !!(widthConfig?.useStretch || widthConfig?.pixelWidth)
}
