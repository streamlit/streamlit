/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StProps, StState } from 'components/shared/StreamlitElement/'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}

class Audio extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    const { element, width } = this.props
    const dataUrl = 'data:' + element.get('format') + ';base64,' + element.get('data')
    return <audio className="stAudio" controls src={dataUrl} style={{ width }} />
  }
}

export default Audio
