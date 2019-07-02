/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
}

class Video extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const {element, width} = this.props
    const dataUrl = 'data:' + element.get('format') + ';base64,' + element.get('data')
    return <video controls src={dataUrl} className="stVideo" style={{ width }} />
  }
}

export default Video
