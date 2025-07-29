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
} from "@streamlit/protobuf"

import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import Toolbar, {
  StyledToolbarElementContainer,
} from "~lib/components/shared/Toolbar"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageList,
} from "./styled-components"

const LOG = getLogger("ImageList")

export interface ImageListProps {
  endpoints: StreamlitEndpoints
  element: ImageListProto
  disableFullscreenMode?: boolean
}

/**
 * @see WidthBehavior on the Backend
 * @see the Image.proto file
 */
enum WidthBehavior {
  OriginalWidth = -1,
  /** @deprecated */
  ColumnWidth = -2,
  /** @deprecated */
  AutoWidth = -3,
  MinImageOrContainer = -4,
  MaxImageOrContainer = -5,
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
  // The width field in the proto sets the image width, but has special
  // cases the values in the WidthBehavior enum.
  let imageWidth: number | undefined
  const protoWidth = element.width

  if (
    [
      WidthBehavior.OriginalWidth,
      WidthBehavior.AutoWidth,
      WidthBehavior.MinImageOrContainer,
    ].includes(protoWidth)
  ) {
    // Use the original image width.
    imageWidth = undefined
  } else if (
    [WidthBehavior.ColumnWidth, WidthBehavior.MaxImageOrContainer].includes(
      protoWidth
    )
  ) {
    // Use the full element width (which handles the full screen case)
    imageWidth = elementWidth
  } else if (protoWidth > 0) {
    // Set the image width explicitly.
    imageWidth = protoWidth
  } else {
    throw Error(`Invalid image width: ${protoWidth}`)
  }

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
