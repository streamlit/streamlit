/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';

import './Video.css';

class Video extends PureComponent {
  render() {
    const {video, width} = this.props;
    try {
      return (
        <video
          style={{width}}
          controls
          src={`data:${video.get('format')};base64,${video.get('data')}`}
        >
        </video>
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

export default Video;
