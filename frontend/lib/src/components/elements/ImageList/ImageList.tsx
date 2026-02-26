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

import { CSSProperties, memo, ReactElement } from "react"

import { getLogger } from "loglevel"

import {
  ImageList as ImageListProto,
  Image as ImageProto,
  streamlit,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import Toolbar, {
  StyledToolbarElementContainer,
} from "~lib/components/shared/Toolbar"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageList,
} from "./styled-components"

const LOG = getLogger("ImageList")

/**
 * Check if a URL points to an SVG image.
 */
export function isSvgImage(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.includes("data:image/svg+xml")) {
    return true
  }
  // Strip query string and fragment before checking the extension so that
  // patterns like ".svg?token=abc" or ".svg#icon" are handled correctly
  // without false-positiving on URLs where ".svg?" appears mid-path.
  const pathOnly = lower.split("?")[0].split("#")[0]
  return pathOnly.endsWith(".svg")
}

/**
 * Check whether an SVG data URI encodes an SVG that lacks intrinsic
 * width/height attributes (i.e. it is "dimensionless"). Only data URIs
 * can be inspected on the frontend; for remote URLs we conservatively
 * return true (assume dimensionless) so the full-width fallback applies.
 */
export function svgHasIntrinsicSize(url: string): boolean {
  const lower = url.toLowerCase()
  if (!lower.includes("data:image/svg+xml")) {
    // Remote URL - we cannot inspect it, assume it has dimensions
    // (most SVG files served over HTTP have width/height).
    return true
  }

  let svgText: string
  try {
    if (lower.includes(";base64,")) {
      const base64 = url.split(";base64,")[1]
      svgText = atob(base64)
    } else {
      // URL-encoded data URI
      const dataContent = url.split(",").slice(1).join(",")
      svgText = decodeURIComponent(dataContent)
    }
  } catch {
    // If decoding fails, assume it has dimensions to avoid breaking layout
    return true
  }

  // Extract the opening <svg ...> tag and check for width/height attributes
  const svgTagMatch = svgText.match(/<svg[^>]*>/i)
  if (!svgTagMatch) {
    return true
  }

  const svgTag = svgTagMatch[0]
  // Check for width="..." or height="..." attributes (not viewBox)
  const hasWidth = /\bwidth\s*=/i.test(svgTag)
  const hasHeight = /\bheight\s*=/i.test(svgTag)

  return hasWidth && hasHeight
}

export interface ImageListProps {
  endpoints: StreamlitEndpoints
  element: ImageListProto
  widthConfig?: streamlit.IWidthConfig | null
  disableFullscreenMode?: boolean
}

/**
 * Get the image width based on widthConfig.
 *
 * @param widthConfig - The width configuration from the element
 * @param containerWidth - The width of the container element
 * @returns The width to use for images, or undefined for original size
 */
function getImageWidth(
  widthConfig: streamlit.IWidthConfig | null | undefined,
  containerWidth: number
): number | undefined {
  if (widthConfig) {
    if (widthConfig.useStretch) {
      return containerWidth
    }

    if (widthConfig.useContent) {
      // Use original image size (content width)
      return undefined
    }

    if (widthConfig.pixelWidth) {
      return widthConfig.pixelWidth
    }
  }

  // Default fallback: use original image size
  return undefined
}

const Image = ({
  itemKey,
  image,
  imgStyle,
  buildMediaURL,
  handleImageError,
  shouldStretch,
}: {
  itemKey: string
  image: ImageProto
  imgStyle: CSSProperties
  buildMediaURL: (url: string) => string
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
  shouldStretch?: boolean
}): ReactElement => {
  const crossOrigin = useCrossOriginAttribute(image.url)
  return (
    <StyledImageContainer
      data-testid="stImageContainer"
      shouldStretch={shouldStretch}
    >
      <img
        style={imgStyle}
        src={buildMediaURL(image.url)}
        alt={itemKey}
        onError={handleImageError}
        crossOrigin={crossOrigin}
      />
      {image.caption && (
        <StyledCaption data-testid="stImageCaption" style={imgStyle}>
          <StreamlitMarkdown
            source={image.caption}
            allowHTML={false}
            isCaption
            // This is technically not a label but we want the same restrictions
            // as for labels (e.g. no Markdown tables or horizontal rule).
            isLabel
          />
        </StyledCaption>
      )}
    </StyledImageContainer>
  )
}

/**
 * Functional element for a horizontal list of images.
 */
function ImageList({
  element,
  endpoints,
  widthConfig,
  disableFullscreenMode,
}: Readonly<ImageListProps>): ReactElement {
  const {
    expanded: isFullScreen,
    width,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  // The width of the container element, not necessarily the image.
  const containerWidth = width || 0

  const imageWidth = getImageWidth(widthConfig, containerWidth)

  const shouldStretch = widthConfig?.useStretch ?? false

  // @see issue https://github.com/streamlit/streamlit/issues/9098
  // SVGs without intrinsic width/height attributes render at 0x0 in
  // useContent mode because the container collapses to zero.
  // To fix this, we detect dimensionless SVGs (those whose data URI lacks
  // explicit width and height on the <svg> tag) and expand the outer list
  // container to full width so the SVG has a rendering context.
  // In mixed lists (SVG + non-SVG), the list container stretches to full
  // width, but only the individual dimensionless-SVG containers get
  // shouldStretch -- non-SVG images and SVGs with intrinsic sizes keep
  // their natural width.
  const hasDimensionlessSvg = element.imgs.some(img => {
    const url = img.url ?? ""
    return isSvgImage(url) && !svgHasIntrinsicSize(url)
  })
  const svgNeedsFullWidth = hasDimensionlessSvg && imageWidth === undefined

  const imgStyle: CSSProperties = {}

  if (fullScreenHeight && isFullScreen) {
    imgStyle.maxHeight = fullScreenHeight
    imgStyle.objectFit = "contain"
    // @see issue https://github.com/streamlit/streamlit/issues/10904
    // Ensure the image tries to fill the width to prevent sizeless SVGs from
    // not rendering. Let object-fit handle aspect ratio.
    imgStyle.width = "100%"
  } else {
    // @see issue https://github.com/streamlit/streamlit/issues/10904
    // Use imageWidth if defined, otherwise fallback to 100% to prevent sizeless
    // SVGs from not rendering.
    imgStyle.width = imageWidth ?? "100%"
    // Cap the image width, so it doesn't exceed its parent container width
    imgStyle.maxWidth = "100%"
  }

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement>
  ): void => {
    const imageUrl = e.currentTarget.src
    LOG.error(`Client Error: Image source error - ${imageUrl}`)
    endpoints.sendClientErrorToHost(
      "Image",
      "Image source failed to load",
      "onerror triggered",
      imageUrl
    )
  }

  return (
    <StyledToolbarElementContainer
      width={containerWidth}
      height={fullScreenHeight}
      useContainerWidth={isFullScreen}
      topCentered
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      ></Toolbar>
      <StyledImageList
        className="stImage"
        data-testid="stImage"
        shouldStretch={shouldStretch || svgNeedsFullWidth}
      >
        {element.imgs.map(
          (iimage, idx): ReactElement => (
            <Image
              // TODO: Update to match React best practices
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={idx}
              itemKey={idx.toString()}
              image={iimage as ImageProto}
              imgStyle={imgStyle}
              buildMediaURL={(url: string) => endpoints.buildMediaURL(url)}
              handleImageError={handleImageError}
              shouldStretch={
                shouldStretch ||
                (svgNeedsFullWidth &&
                  isSvgImage((iimage as ImageProto).url ?? "") &&
                  !svgHasIntrinsicSize((iimage as ImageProto).url ?? ""))
              }
            />
          )
        )}
      </StyledImageList>
    </StyledToolbarElementContainer>
  )
}

const ImageListWithFullScreen = withFullScreenWrapper(ImageList)
export default memo(ImageListWithFullScreen)
