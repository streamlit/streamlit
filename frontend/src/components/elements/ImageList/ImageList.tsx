/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import './ImageList.scss'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}

/**
 * Returns an image source string, suitable for use in <img src=...>,
 * from an Image protobuf object.
 * An Image protobuf can contain either a URL string or a base64-encoded PNG.
 */
function getImageSrcString(imgProto: ImmutableMap<string, any>): string {
  const type = imgProto.get('type')
  if (type === 'data') {
    let data = imgProto.get('data')
    return `data:${data.get('mimeType')};base64,${data.get('base64')}`
  } else if (type === 'url') {
    return imgProto.get('url')
  }

  throw new Error(`Unrecognized Image protobuf type ${type}`)
}

/**
 * Functional element for a horizontal list of images.
 */
class ImageList extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    const {element, width} = this.props
    // The width field in the proto sets the image width, but has special
    // cases for -1 and -2.
    let imgWidth: number|undefined
    const protoWidth = element.get('width')
    if (protoWidth === -1) {
      // Use the original image width.
      imgWidth = undefined
    } else if (protoWidth === -2) {
      // Use the column width
      imgWidth = width
    } else if (protoWidth > 0) {
      // Set the image width explicitly.
      imgWidth = element.get('width')
    } else {
      throw Error(`Invalid image width: ${protoWidth}`)
    }

    return (
      <div style={{width}}>
        {element.get('imgs').map((img: ImmutableMap<string, any>, indx: string) => (
          <div className="image-container" key={indx}>
            <img
              style={{width: imgWidth}}
              src={getImageSrcString(img)}
              alt={indx}
            />
            <div className="caption"> {img.get('caption')} </div>
          </div>
        ))}
      </div>
    )
  }
}

export default ImageList
