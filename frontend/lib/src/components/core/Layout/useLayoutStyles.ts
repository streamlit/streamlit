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

import { useContext, useMemo } from "react"

import { Block as BlockProto, Element, streamlit } from "@streamlit/protobuf"

import { FlexContext, IFlexContext } from "./FlexContext"
import { Direction, MinFlexElementWidth } from "./utils"

type SubElement = {
  useContainerWidth?: boolean | null
  height?: number
  width?: number
  // We must include this for backwards compatiblity since
  // Alert.proto has been released (1.45) with the field in this position.
  widthConfig?: streamlit.IWidthConfig | null | undefined
}

type StyleOverrides = Partial<
  Pick<UseLayoutStylesShape, "height" | "width" | "overflow" | "flex">
>

export type UseLayoutStylesArgs = {
  element: Element | BlockProto
  // subElement supports older config where the width/height is set on the lower
  // level element.
  subElement?: SubElement
  styleOverrides?: StyleOverrides
  minStretchBehavior?: MinFlexElementWidth
}

const isNonZeroPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && value > 0 && !isNaN(value)

enum DimensionType {
  PIXEL = "pixel",
  STRETCH = "stretch",
  CONTENT = "content",
}

type LayoutDimensionConfig = {
  type: DimensionType | undefined
  pixels?: number | undefined
}

const getWidth = (
  element: Element | BlockProto,
  // subElement supports older config where the width is set on the lower
  // level element.
  subElement?: SubElement
): LayoutDimensionConfig => {
  // We need to support old width configurations for backwards compatibility,
  // since some integrations cache the messages and we want to ensure that the FE
  // can still support old message formats.
  let pixels: number | undefined
  let type: DimensionType | undefined

  const isStretch =
    element.widthConfig?.useStretch || subElement?.widthConfig?.useStretch
  const isContent =
    element?.widthConfig?.useContent || subElement?.widthConfig?.useContent
  const isPixel =
    element?.widthConfig?.pixelWidth || subElement?.widthConfig?.pixelWidth

  if (isStretch) {
    type = DimensionType.STRETCH
  } else if (isContent) {
    type = DimensionType.CONTENT
  } else if (
    isPixel &&
    isNonZeroPositiveNumber(element.widthConfig?.pixelWidth)
  ) {
    type = DimensionType.PIXEL
    pixels = element.widthConfig?.pixelWidth
  } else if (
    isPixel &&
    isNonZeroPositiveNumber(subElement?.widthConfig?.pixelWidth)
  ) {
    type = DimensionType.PIXEL
    pixels = subElement?.widthConfig?.pixelWidth
  } else if (
    isNonZeroPositiveNumber(subElement?.width) &&
    !element.widthConfig
  ) {
    pixels = subElement?.width
    type = DimensionType.PIXEL
  }
  // The current behaviour is for useContainerWidth to take precedence over
  // width, see arrow.py for reference.
  if (subElement?.useContainerWidth) {
    type = DimensionType.STRETCH
  }
  return { pixels, type }
}

const getHeight = (
  element: Element | BlockProto,
  // subElement supports older config where the width is set on the lower
  // level element.
  subElement?: SubElement
): LayoutDimensionConfig => {
  // We need to support old height configurations for backwards compatibility,
  // since some integrations cache the messages and we want to ensure that the FE
  // can still support old message formats.
  let pixels: number | undefined
  let type: DimensionType | undefined

  const isStretch = !!element.heightConfig?.useStretch
  const isContent = !!element.heightConfig?.useContent
  const isPixel = !!element.heightConfig?.pixelHeight

  if (isStretch) {
    type = DimensionType.STRETCH
  } else if (isContent) {
    type = DimensionType.CONTENT
  } else if (
    isPixel &&
    isNonZeroPositiveNumber(element.heightConfig?.pixelHeight)
  ) {
    type = DimensionType.PIXEL
    pixels = element.heightConfig?.pixelHeight
  } else if (
    isNonZeroPositiveNumber(subElement?.height) &&
    !element.heightConfig
  ) {
    pixels = subElement?.height
    type = DimensionType.PIXEL
  }

  return { pixels, type }
}

const getFlex = (
  widthType: DimensionType | undefined,
  widthPixels: number | undefined,
  heightType: DimensionType | undefined,
  heightPixels: number | undefined,
  direction: Direction | undefined,
  minStretchBehavior?: MinFlexElementWidth
): string | undefined => {
  if (
    widthType === DimensionType.PIXEL &&
    direction === Direction.HORIZONTAL
  ) {
    return `0 0 ${widthPixels}px`
  } else if (
    heightType === DimensionType.PIXEL &&
    direction === Direction.VERTICAL
  ) {
    return `0 0 ${heightPixels}px`
  } else if (
    widthType === DimensionType.CONTENT &&
    direction === Direction.HORIZONTAL
  ) {
    return "0 0 fit-content"
  } else if (
    widthType === DimensionType.STRETCH &&
    direction === Direction.HORIZONTAL
  ) {
    return `1 1 ${minStretchBehavior ?? "fit-content"}`
  }
}

const getDirection = (
  flexContext: IFlexContext | null
): Direction | undefined => {
  return flexContext?.direction
}

export type UseLayoutStylesShape = {
  width: React.CSSProperties["width"]
  height: React.CSSProperties["height"]
  overflow: React.CSSProperties["overflow"]
  flex?: React.CSSProperties["flex"]
}

/**
 * Returns the contextually-aware style values for an element container
 */
export const useLayoutStyles = ({
  element,
  subElement,
  styleOverrides,
  minStretchBehavior,
}: UseLayoutStylesArgs): UseLayoutStylesShape => {
  const flexContext = useContext(FlexContext)
  const layoutStyles = useMemo((): UseLayoutStylesShape => {
    if (!element) {
      return {
        width: "auto",
        height: "auto",
        overflow: "visible",
      }
    }

    const { pixels: commandWidth, type: widthType } = getWidth(
      element,
      subElement
    )
    let width: React.CSSProperties["width"] = "auto"
    if (widthType === DimensionType.STRETCH) {
      width = "100%"
    } else if (widthType === DimensionType.PIXEL) {
      width = `${commandWidth}px`
    } else if (widthType === DimensionType.CONTENT) {
      width = "fit-content"
    }

    const { pixels: commandHeight, type: heightType } = getHeight(
      element,
      subElement
    )
    let height: React.CSSProperties["height"] = "auto"
    let overflow: React.CSSProperties["overflow"] = "visible"

    if (heightType === DimensionType.STRETCH) {
      height = "100%"
    } else if (heightType === DimensionType.CONTENT) {
      height = "auto"
    } else if (heightType === DimensionType.PIXEL) {
      height = `${commandHeight}px`
      overflow = "auto"
    }

    const flex = getFlex(
      widthType,
      commandWidth,
      heightType,
      commandHeight,
      getDirection(flexContext),
      minStretchBehavior
    )

    const calculatedStyles = {
      width,
      height,
      overflow,
      flex,
    }

    return {
      ...calculatedStyles,
      ...styleOverrides,
    }
  }, [element, subElement, styleOverrides, flexContext, minStretchBehavior])

  return layoutStyles
}
