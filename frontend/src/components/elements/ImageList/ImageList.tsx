import React, { useContext, ReactElement } from "react"
import ReactHtmlParser from "react-html-parser"

import {
  IImage,
  Image as ImageProto,
  ImageList as ImageListProto,
} from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { buildMediaUri, xssSanitizeSvg } from "src/lib/UriUtil"

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageList,
} from "./styled-components"

export interface ImageListProps {
  width: number
  isFullScreen: boolean
  element: ImageListProto
  height?: number
}

enum WidthBehavior {
  OriginalWidth = -1,
  ColumnWidth = -2,
  AutoWidth = -3,
}

/**
 * Functional element for a horizontal list of images.
 */
export function ImageList({
  width,
  isFullScreen,
  element,
  height,
}: ImageListProps): ReactElement {
  const { getBaseUriParts } = useContext(AppContext)

  // The width field in the proto sets the image width, but has special
  // cases for -1, -2, and -3.
  let containerWidth: number | undefined
  const protoWidth = element.width

  if (
    protoWidth === WidthBehavior.OriginalWidth ||
    protoWidth === WidthBehavior.AutoWidth
  ) {
    // Use the original image width.
    containerWidth = undefined
  } else if (protoWidth === WidthBehavior.ColumnWidth) {
    // Use the column width
    containerWidth = width
  } else if (protoWidth > 0) {
    // Set the image width explicitly.
    containerWidth = protoWidth
  } else {
    throw Error(`Invalid image width: ${protoWidth}`)
  }

  const imgStyle: any = {}

  if (height && isFullScreen) {
    imgStyle.maxHeight = height
    imgStyle["object-fit"] = "contain"
  } else {
    imgStyle.width = containerWidth

    if (protoWidth === WidthBehavior.AutoWidth) {
      // Cap the image width, so it doesn't exceed the column width
      imgStyle.maxWidth = "100%"
    }
  }

  return (
    <StyledImageList style={{ width }}>
      {element.imgs.map(
        (iimage: IImage, idx: number): ReactElement => {
          const image = iimage as ImageProto
          return (
            <StyledImageContainer key={idx} data-testid="stImage">
              {image.markup ? (
                // SVGs are received unsanitized
                ReactHtmlParser(xssSanitizeSvg(image.markup))
              ) : (
                <img
                  style={imgStyle}
                  src={buildMediaUri(image.url, getBaseUriParts())}
                  alt={idx.toString()}
                />
              )}
              {image.caption && (
                <StyledCaption data-testid="caption" style={imgStyle}>
                  {` ${image.caption} `}
                </StyledCaption>
              )}
            </StyledImageContainer>
          )
        }
      )}
    </StyledImageList>
  )
}

export default withFullScreenWrapper(ImageList)
