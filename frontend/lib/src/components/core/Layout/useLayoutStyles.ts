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

import { useMemo } from "react"

import { streamlit } from "@streamlit/protobuf"

type LayoutElement = {
  width?: number
  widthConfig?: streamlit.WidthConfig
  useContainerWidth?: boolean | null
}

export type UseLayoutStylesArgs<T> = {
  element: (T & LayoutElement) | undefined
}

const isNonZeroPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && value > 0 && !isNaN(value)

enum WidthType {
  PIXEL = "pixel",
  STRETCH = "stretch",
  CONTENT = "content",
}

type LayoutWidthConfig = {
  widthType: WidthType | undefined
  pixels?: number | undefined
}

const getWidth = (element: LayoutElement): LayoutWidthConfig => {
  // This can be simplified once all elements have been updated to use the
  // new width_config message and useContainerWidth is deprecated.
  let pixels: number | undefined
  let type: WidthType | undefined

  const isStretch =
    element.widthConfig && element.widthConfig.widthSpec === "useStretch"
  const isContent =
    element.widthConfig && element.widthConfig.widthSpec === "useContent"
  const isPixel =
    element.widthConfig && element.widthConfig.widthSpec === "pixelWidth"

  if (isStretch) {
    type = WidthType.STRETCH
  } else if (isContent) {
    type = WidthType.CONTENT
  } else if (
    isPixel &&
    isNonZeroPositiveNumber(element.widthConfig?.pixelWidth)
  ) {
    type = WidthType.PIXEL
    pixels = element.widthConfig?.pixelWidth
  } else if (
    isNonZeroPositiveNumber(element.width) &&
    element.widthConfig === undefined
  ) {
    pixels = element.width
    type = WidthType.PIXEL
  }
  // The current behaviour is for useContainerWidth to take precedence over
  // width, see arrow.py for reference.
  if (element.useContainerWidth) {
    type = WidthType.STRETCH
  }
  return { pixels, widthType: type }
}

export type UseLayoutStylesShape = {
  width: React.CSSProperties["width"]
}

/**
 * Returns the contextually-aware style values for an element container
 */
export const useLayoutStyles = <T>({
  element,
}: UseLayoutStylesArgs<T>): UseLayoutStylesShape => {
  // Note: Consider rounding the width to the nearest pixel so we don't have
  // subpixel widths, which leads to blurriness on screen
  const layoutStyles = useMemo((): UseLayoutStylesShape => {
    if (!element) {
      return {
        width: "auto",
      }
    }

    const { pixels: commandWidth, widthType } = getWidth(element)
    // The st.image element is potentially a list of images, so we always want
    // the enclosing container to be full width. The size of individual
    // images is managed in the ImageList component.
    const isImgList = element && "imgs" in element

    if (widthType === WidthType.STRETCH || isImgList) {
      return {
        width: "100%",
      }
    } else if (widthType === WidthType.PIXEL) {
      return {
        width: commandWidth,
      }
    } else if (widthType === WidthType.CONTENT) {
      return {
        width: "fit-content",
      }
    }
    return {
      width: "auto",
    }
  }, [element])

  return layoutStyles
}
