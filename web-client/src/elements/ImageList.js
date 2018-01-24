import React, { PureComponent } from 'react';

import './ImageList.css';

/**
 * Functional element for a horizontal list of images.
 */
class ImageList extends PureComponent {
  render() {
    const {imgs, width} = this.props;
    return (
      <div style={{width}}>
        {imgs.get('imgs').map((img, indx) => (
          <div className="image-container" key={indx}>
            <img
              style={{width: imgs.get('width') ? imgs.get('width') : undefined}}
              src={`data:image/png;base64,${img.get('base_64Png')}`}
              alt={indx}
            />
            <div className="caption"> {img.get('caption')} </div>
          </div>
        ))}
      </div>
    );
  }
}

export default ImageList;
