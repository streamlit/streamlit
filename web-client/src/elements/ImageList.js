import React from 'react';

import './ImageList.css';

/**
 * Functional element for a horizontal list of images.
 */
const ImageList = ({imgs, width}) => (
  <div style={{width}}>
    {imgs.imgs.map((img, indx) => (
      <div className="image-container" key={indx}>
        <img
          style={{width: imgs.width ? imgs.width : undefined}}
          src={`data:image/png;base64,${img.base_64Png}`}
          alt={indx}
        />
        <div class="caption"> {img.caption} </div>
      </div>
    ))}
  </div>
);

export default ImageList;

// # style = 'style="border: ;"'
// # img_html = f'<img {style} src="data:image/png;base64,{img_base64}">'
// # self.add_html(img_html)
