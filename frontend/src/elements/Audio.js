/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';


class Audio extends PureComponent {
  render() {
    const {audio, width} = this.props;
    try {
      return (
        <audio
          style={{width}}
          controls
          src={`data:${audio.get('format')};base64,${audio.get('data')}`}
        >
        </audio>
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

export default Audio;
