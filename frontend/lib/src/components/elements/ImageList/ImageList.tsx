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

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageList,
} from "./styled-components"

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
  } else {
    imgStyle.width = imageWidth
    // Cap the image width, so it doesn't exceed its parent container width
    imgStyle.maxWidth = "100%"
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
        {element.imgs.map((iimage, idx): ReactElement => {
          const image = iimage as ImageProto
          const imgProps = {
            style: imgStyle,
            src: endpoints.buildMediaURL(image.url),
            alt: idx.toString(),
          }
          return (
            // TODO: Update to match React best practices
            // eslint-disable-next-line @eslint-react/no-array-index-key
            <StyledImageContainer data-testid="stImageContainer" key={idx}>
              {/* This div ensures consistent layout for images regardless of
                whether they have click_url. Without it, images with and without anchor
                tags may have different heights and/or styles. */}
              <div>
                {image.clickUrl ? (
                  <a
                    href={image.clickUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img {...imgProps} />
                  </a>
                ) : (
                  <img {...imgProps} />
                )}
              </div>
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
        })}
      </StyledImageList>
    </StyledToolbarElementContainer>
  )
}

const ImageListWithFullScreen = withFullScreenWrapper(ImageList)
export default memo(ImageListWithFullScreen)
