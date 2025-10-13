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

import { assertNever } from "~lib/util/assertNever"

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

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && !isNaN(value)

const isNonZeroPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && value > 0 && !isNaN(value)

enum DimensionType {
  PIXEL = "pixel",
  STRETCH = "stretch",
  CONTENT = "content",
  REM = "rem",
  AUTO = "auto",
}

type LayoutDimensionConfig =
  | { type: DimensionType.STRETCH }
  | { type: DimensionType.CONTENT }
  | { type: DimensionType.PIXEL; pixels: number }
  | { type: DimensionType.REM; rem: number }
  | { type: DimensionType.AUTO }

const getWidth = (
  element: Element | BlockProto,
  // subElement supports older config where the width is set on the lower
  // level element.
  subElement?: SubElement
): LayoutDimensionConfig => {
  // The current behaviour is for useContainerWidth to take precedence over
  // width, see arrow.py for reference.
  if (subElement?.useContainerWidth) {
    return { type: DimensionType.STRETCH }
  }

  // We need to support old width configurations for backwards compatibility,
  // since some integrations cache the messages and we want to ensure that the FE
  // can still support old message formats.
  const isStretch =
    element.widthConfig?.useStretch || subElement?.widthConfig?.useStretch
  const isContent =
    element?.widthConfig?.useContent || subElement?.widthConfig?.useContent
  const isPixel =
    element?.widthConfig?.pixelWidth ||
    subElement?.widthConfig?.pixelWidth ||
    element.widthConfig?.pixelWidth === 0
  const isRem = element.widthConfig?.remWidth

  if (isStretch) {
    return { type: DimensionType.STRETCH }
  } else if (isContent) {
    return { type: DimensionType.CONTENT }
  } else if (isRem && isPositiveNumber(element.widthConfig?.remWidth)) {
    return { type: DimensionType.REM, rem: element.widthConfig.remWidth }
  } else if (isPixel && isPositiveNumber(element.widthConfig?.pixelWidth)) {
    return {
      type: DimensionType.PIXEL,
      pixels: element.widthConfig.pixelWidth,
    }
  } else if (
    isPixel &&
    isPositiveNumber(subElement?.widthConfig?.pixelWidth)
  ) {
    return {
      type: DimensionType.PIXEL,
      pixels: subElement.widthConfig.pixelWidth,
    }
  } else if (
    isNonZeroPositiveNumber(subElement?.width) &&
    !element.widthConfig
  ) {
    return { type: DimensionType.PIXEL, pixels: subElement.width }
  }

  return { type: DimensionType.AUTO }
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
  const isStretch = !!element.heightConfig?.useStretch
  const isContent = !!element.heightConfig?.useContent
  const isPixel =
    !!element.heightConfig?.pixelHeight ||
    element.heightConfig?.pixelHeight === 0
  const isRem = element.heightConfig?.remHeight

  if (isStretch) {
    return { type: DimensionType.STRETCH }
  } else if (isContent) {
    return { type: DimensionType.CONTENT }
  } else if (isRem && isPositiveNumber(element.heightConfig?.remHeight)) {
    return { type: DimensionType.REM, rem: element.heightConfig.remHeight }
  } else if (isPixel && isPositiveNumber(element.heightConfig?.pixelHeight)) {
    return {
      type: DimensionType.PIXEL,
      pixels: element.heightConfig.pixelHeight,
    }
  } else if (
    isNonZeroPositiveNumber(subElement?.height) &&
    !element.heightConfig
  ) {
    return { type: DimensionType.PIXEL, pixels: subElement.height }
  }

  return { type: DimensionType.AUTO }
}

const getFlex = (
  widthConfig: LayoutDimensionConfig,
  heightConfig: LayoutDimensionConfig,
  direction: Direction | undefined,
  minStretchBehavior?: MinFlexElementWidth
): string | undefined => {
  if (direction === Direction.HORIZONTAL) {
    switch (widthConfig.type) {
      case DimensionType.PIXEL:
        return `0 0 ${widthConfig.pixels}px`
      case DimensionType.REM:
        return `0 0 ${widthConfig.rem}rem`
      case DimensionType.CONTENT:
        return "0 0 fit-content"
      case DimensionType.STRETCH:
        return `1 1 ${minStretchBehavior ?? "fit-content"}`
      case DimensionType.AUTO:
        return undefined
      default:
        assertNever(widthConfig)
    }
  } else if (direction === Direction.VERTICAL) {
    switch (heightConfig.type) {
      case DimensionType.PIXEL:
        return `0 0 ${heightConfig.pixels}px`
      case DimensionType.REM:
        return `0 0 ${heightConfig.rem}rem`
      case DimensionType.CONTENT:
      case DimensionType.STRETCH:
      case DimensionType.AUTO:
        return undefined
      default:
        assertNever(heightConfig)
    }
  }

  return undefined
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

    const widthConfig = getWidth(element, subElement)
    let width: React.CSSProperties["width"]

    switch (widthConfig.type) {
      case DimensionType.STRETCH:
        width = "100%"
        break
      case DimensionType.REM:
        width = `${widthConfig.rem}rem`
        break
      case DimensionType.PIXEL:
        width = `${widthConfig.pixels}px`
        break
      case DimensionType.CONTENT:
        width = "fit-content"
        break
      case DimensionType.AUTO:
        width = "auto"
        break
      default:
        assertNever(widthConfig)
    }

    const heightConfig = getHeight(element, subElement)
    let height: React.CSSProperties["height"]
    let overflow: React.CSSProperties["overflow"] = "visible"

    switch (heightConfig.type) {
      case DimensionType.STRETCH:
        height = "100%"
        break
      case DimensionType.CONTENT:
        height = "auto"
        break
      case DimensionType.REM:
        height = `${heightConfig.rem}rem`
        break
      case DimensionType.PIXEL:
        height = `${heightConfig.pixels}px`
        overflow = "auto"
        break
      case DimensionType.AUTO:
        height = "auto"
        break
      default:
        assertNever(heightConfig)
    }

    const flex = getFlex(
      widthConfig,
      heightConfig,
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
