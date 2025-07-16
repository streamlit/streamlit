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

import React, { CSSProperties, memo, ReactElement } from "react"

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

// This is deprecated, but we want to support old versions
// of the proto messages due to requirements of our integrations.
enum WidthBehavior {
  ORIGINAL = -1,
  COLUMN = -2,
  AUTO = -3,
  MIN_IMAGE_OR_CONTAINER = -4,
  MAX_IMAGE_OR_CONTAINER = -5,
}

export interface ImageListProps {
  endpoints: StreamlitEndpoints
  element: ImageListProto
  widthConfig?: streamlit.IWidthConfig | null
  disableFullscreenMode?: boolean
}

/**
 * Get the image width based on width configuration (new) or WidthBehavior (legacy).
 * Prioritizes the new widthConfig if both are present.
 *
 * @param widthConfig - The new width configuration from the element
 * @param legacyWidth - The legacy WidthBehavior width from element.width
 * @param elementWidth - The width of the container element
 * @returns The width to use for images, or undefined for original size
 */
function getImageWidth(
  widthConfig: streamlit.IWidthConfig | null | undefined,
  legacyWidth: number | null | undefined,
  elementWidth: number
): number | undefined {
  if (widthConfig) {
    if (widthConfig.useStretch) {
      // Use the full element width (stretch to container)
      return elementWidth
    }

    if (widthConfig.useContent) {
      // Use original image size (content width)
      return undefined
    }

    if (widthConfig.pixelWidth) {
      return widthConfig.pixelWidth
    }
  }

  // Fall back to legacy WidthBehavior if no new config
  if (legacyWidth !== null && legacyWidth !== undefined) {
    switch (legacyWidth) {
      case WidthBehavior.ORIGINAL:
      case WidthBehavior.AUTO:
      case WidthBehavior.MIN_IMAGE_OR_CONTAINER:
        // Use original image size
        return undefined

      case WidthBehavior.COLUMN:
      case WidthBehavior.MAX_IMAGE_OR_CONTAINER:
        // Use container width
        return elementWidth

      default:
        // Positive integers are exact pixel widths
        if (legacyWidth > 0) {
          return legacyWidth
        }
        // Unknown negative values default to original size
        return undefined
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
}: {
  itemKey: string
  image: ImageProto
  imgStyle: CSSProperties
  buildMediaURL: (url: string) => string
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
}): ReactElement => {
  const crossOrigin = useCrossOriginAttribute(image.url)
  return (
    <StyledImageContainer data-testid="stImageContainer">
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
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  // The width of the element is the width of the container, not necessarily the image.
  const elementWidth = width || 0

  const imageWidth = getImageWidth(widthConfig, element.width, elementWidth)

  const imgStyle: CSSProperties = {}

  if (height && isFullScreen) {
    imgStyle.maxHeight = height
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
      width={elementWidth}
      height={height}
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
      <StyledImageList className="stImage" data-testid="stImage">
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
            />
          )
        )}
      </StyledImageList>
    </StyledToolbarElementContainer>
  )
}

const ImageListWithFullScreen = withFullScreenWrapper(ImageList)
export default memo(ImageListWithFullScreen)
