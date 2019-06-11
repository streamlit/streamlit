/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Represents formatted text.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import './DocString.scss'

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}

/**
 * Functional element representing formatted text.
 */
class DocString extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    const {element, width} = this.props

    const name = element.get('name')
    const module = element.get('module')
    const docString = element.get('docString')
    const type = element.get('type')
    const signature = element.get('signature')

    const moduleHtml = <span className="doc-module">{module}.</span>
    const nameHtml = <span className="doc-name">{name}</span>
    const signatureHtml = <span className="doc-signature">{signature}</span>
    const typeHtml = <span className="doc-type">{type}</span>

    // Put it all together into a nice little html view.
    return (
      <div className="doc-containter" style={{width}}>
        <div className="doc-header">
          {
            name ? [
              module ? moduleHtml : '',
              nameHtml,
              signature ? signatureHtml : '',
            ] : [
              typeHtml,
            ]
          }
        </div>
        <div className="doc-string">{docString}</div>
      </div>
    )
  }
}

export default DocString
