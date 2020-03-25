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

import React, { PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import {
  getWindowBaseUriParts as get_base_uri_parts,
  buildHttpUri,
} from "lib/UriUtil"
import "./ImageList.scss"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

function getImageURI(imgProto: ImmutableMap<string, any>): string {
  if (imgProto.get("url").startsWith("/media")) {
    return buildHttpUri(get_base_uri_parts(), imgProto.get("url"))
  } else {
    return imgProto.get("url")
  }
}

/**
 * Functional element for a horizontal list of images.
 */
export class ImageList extends PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    // The width field in the proto sets the image width, but has special
    // cases for -1 and -2.
    let imgWidth: number | undefined
    const protoWidth = element.get("width")
    if (protoWidth === -1) {
      // Use the original image width.
      imgWidth = undefined
    } else if (protoWidth === -2) {
      // Use the column width
      imgWidth = width
    } else if (protoWidth > 0) {
      // Set the image width explicitly.
      imgWidth = element.get("width")
    } else {
      throw Error(`Invalid image width: ${protoWidth}`)
    }

    return (
      <div style={{ width }}>
        {element
          .get("imgs")
          .map((img: ImmutableMap<string, any>, idx: string) => (
            <div
              className="image-container stImage"
              key={idx}
              style={{ width: imgWidth }}
            >
              <img
                style={{ width: imgWidth }}
                src={getImageURI(img)}
                alt={idx}
              />
              <div className="caption"> {img.get("caption")} </div>
            </div>
          ))}
      </div>
    )
  }
}

export default withFullScreenWrapper(ImageList)
