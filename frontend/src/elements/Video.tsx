/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react';
import {Map as ImmutableMap} from 'immutable';
import {PureStreamlitElement} from './util/StreamlitElement';

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
}

class Video extends PureStreamlitElement<Props> {
  public safeRender(): React.ReactNode {
    const {element, width} = this.props;
    return (
      <video
        style={{width}}
        controls
        src={`data:${element.get('format')};base64,${element.get('data')}`}
      >
      </video>
    );
  }
}

export default Video;
