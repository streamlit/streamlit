/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import ReactHtmlParser from "react-html-parser"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import { buildMediaUri, xssSanitizeSvg } from "lib/UriUtil"
import {
  IImage,
  Image as ImageProto,
  ImageList as ImageListProto,
} from "autogen/proto"
import { StyledCaption, StyledImageContainer } from "./styled-components"

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
    imgStyle.height = height
    imgStyle["object-fit"] = "contain"
  } else {
    imgStyle.width = containerWidth

    if (protoWidth === WidthBehavior.AutoWidth) {
      // Cap the image width, so it doesn't exceed the column width
      imgStyle.maxWidth = "100%"
    }
  }

  return (
    <div style={{ width }}>
      {element.imgs.map(
        (iimage: IImage, idx: number): ReactElement => {
          const image = iimage as ImageProto
          return (
            <StyledImageContainer
              key={idx}
              data-testid="stImage"
              style={{ width: containerWidth }}
            >
              {image.markup ? (
                // SVGs are received unsanitized
                ReactHtmlParser(xssSanitizeSvg(image.markup))
              ) : (
                <img
                  style={imgStyle}
                  src={buildMediaUri(image.url)}
                  alt={idx.toString()}
                />
              )}
              {!isFullScreen && (
                <StyledCaption data-testid="caption">
                  {` ${image.caption} `}
                </StyledCaption>
              )}
            </StyledImageContainer>
          )
        }
      )}
    </div>
  )
}

export default withFullScreenWrapper(ImageList)
