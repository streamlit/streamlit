/**
 * Represents formatted text.
 */

import React, { PureComponent} from 'react';
import './DocString.css';
import { dispatchOneOf } from 'streamlit-shared/lib/immutableProto';
 /**
  * Functional element representing formatted text.
  */
class DocString extends PureComponent {
  render() {
    const {element, width} = this.props;
    const name = element.get('name');
    const module = element.get('module');
    const doc = dispatchOneOf(element, 'doc', {
      docHtml: (docHtml) => <div className="doc-html"
          dangerouslySetInnerHTML={{__html: docHtml}}/>,
      docString: (docString) => <div className="doc-string">{docString}</div>,
    });

    const docHtml = element.get('docHtml');
    return (
      <div className="doc-containter" style={{width}}>
        <div className="doc-header">
          <span className="doc-module">{module}.</span>
          <span className="doc-name">{name}</span>
        </div>
        {doc}
      </div>
    );
  }
}

export default DocString;
