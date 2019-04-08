/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import { Alert } from 'reactstrap';

import './ImageList.css';

/**
 * Returns an image source string, suitable for use in <img src=...>,
 * from an Image protobuf object.
 * An Image protobuf can contain either a URL string or a base64-encoded PNG.
 */
function getImageSrcString(imgProto) {
  const type = imgProto.get('type');
  if (type === 'base_64Png') {
    return `data:image/png;base64,${imgProto.get('base_64Png')}`;
  } else if (type === 'url') {
    return imgProto.get('url');
  }

  throw new Error(`Unrecognized Image protobuf type ${type}`);
}

/**
 * Functional element for a horizontal list of images.
 */
class ImageList extends PureComponent {
  render() {
    const {imgs, width} = this.props;
    try {
      // The width field in the proto sets the image width, but has special
      // cases for -1 and -2.
      let imgWidth;
      const protoWidth = imgs.get('width');
      if (protoWidth === -1) {
        // Use the original image width.
        imgWidth = undefined;
      } else if (protoWidth === -2) {
        // Use the column width
        imgWidth = width;
      } else if (protoWidth > 0) {
        // Set the image width explicitly.
        imgWidth = imgs.get('width');
      } else {
        throw Error(`Invalid image width: ${protoWidth}`);
      }

      return (
        <div style={{width}}>
          {imgs.get('imgs').map((img, indx) => (
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
      );
    } catch (e) {
      console.log(e.stack);
      return (
        <Alert style={{width}} color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
  }
}

export default ImageList;
