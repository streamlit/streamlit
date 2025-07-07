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

import { Element, TextArea as TextAreaProto } from "@streamlit/protobuf"

import {
  LabelVisibilityOptions,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"

/**
 * Determines the height of the input that will correspond to the outer element
 * height provided by the user. Because text areas can be resized by dragging
 * the corners, we need to set the height on the input itself.
 *
 * @param outerElement - The outer element containing height configuration
 * @param element - The TextArea protocol buffer element
 * @returns The calculated height as a CSS string (e.g., "100px", "100%", "auto")
 */
export const getTextAreaHeight = (
  outerElement: Element,
  element: TextAreaProto
): string => {
  let height = "auto"
  if (outerElement.heightConfig?.useStretch) {
    height = "100%"
  } else if (
    outerElement.heightConfig?.pixelHeight &&
    outerElement.heightConfig.pixelHeight > 0
  ) {
    const labelAndPadding =
      labelVisibilityProtoValueToEnum(element.labelVisibility?.value) ===
      LabelVisibilityOptions.Collapsed
        ? 2
        : 30
    const innerHeight = outerElement.heightConfig.pixelHeight - labelAndPadding
    height = `${innerHeight}px`
  }
  return height
}
