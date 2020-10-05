/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { IImage, IImageList } from "autogen/proto"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import { buildMediaUri } from "lib/UriUtil"
import { requireNonNull } from "lib/utils"
import React, { ReactElement } from "react"
import "./ImageList.scss"

export interface ImageListProps {
  width: number
  isFullScreen: boolean
  element: IImageList
  height?: number
}

enum WidthBehavior {
  OriginalWidth = -1,
  ColumnWidth = -2,
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
  // cases for -1 and -2.
  let containerWidth: number | undefined
  const protoWidth = requireNonNull(element.width)

  if (protoWidth === WidthBehavior.OriginalWidth) {
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
  }

  const images = requireNonNull(element.imgs)

  return (
    <div style={{ width }}>
      {images.map((img: IImage, idx: number) => (
        <div
          className="image-container stImage"
          key={idx}
          style={{ width: containerWidth }}
        >
          <img
            style={imgStyle}
            src={buildMediaUri(requireNonNull(img.url))}
            alt={idx.toString()}
          />
          {!isFullScreen && (
            <div className="caption"> {requireNonNull(img.caption)} </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default withFullScreenWrapper(ImageList)
