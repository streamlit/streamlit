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
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar from "~lib/components/shared/Toolbar/Toolbar"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageLink,
  StyledImageList,
} from "./styled-components"

const LOG = getLogger("ImageList")

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
  link,
}: {
  itemKey: string
  image: ImageProto
  imgStyle: CSSProperties
  buildMediaURL: (url: string) => string
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
  shouldStretch?: boolean
  link?: string
}): ReactElement => {
  const crossOrigin = useCrossOriginAttribute(image.url)

  const imageElement = (
    <img
      style={imgStyle}
      src={buildMediaURL(image.url)}
      alt={itemKey}
      onError={handleImageError}
      crossOrigin={crossOrigin}
    />
  )

  return (
    <StyledImageContainer
      data-testid="stImageContainer"
      shouldStretch={shouldStretch}
    >
      {link ? (
        <StyledImageLink
          href={link}
          target="_blank"
          rel="noreferrer"
          aria-label={image.caption || link}
          data-testid="stImageLink"
        >
          {imageElement}
        </StyledImageLink>
      ) : (
        imageElement
      )}
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
        shouldStretch={shouldStretch}
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
              shouldStretch={shouldStretch}
              link={element.imgs.length === 1 ? element.link : undefined}
            />
          )
        )}
      </StyledImageList>
    </StyledToolbarElementContainer>
  )
}

const ImageListWithFullScreen = withFullScreenWrapper(ImageList)
export default memo(ImageListWithFullScreen)
