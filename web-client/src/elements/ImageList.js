import React from 'react';

import './ImageList.css';

/**
 * Functional element for a horizontal list of images.
 */
const ImageList = ({imgs, width}) => (
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

export default ImageList;

// # style = 'style="border: ;"'
// # img_html = f'<img {style} src="data:image/png;base64,{img_base64}">'
// # self.add_html(img_html)
