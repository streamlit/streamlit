/**
 * Represents formatted text.
 */

import React, { PureComponent} from 'react';
import './DocString.css';
import { dispatchOneOf } from 'streamlit/lib/immutableProto';
 /**
  * Functional element representing formatted text.
  */
class DocString extends PureComponent {
  render() {
    const {element, width} = this.props;
    const name = element.get('name');
    const docString = element.get('docString');

    // The module string may be blank so there's a bit more logic here.
    let moduleHtml = '';
    const module = element.get('module');
    if (module)
      moduleHtml = <span className="doc-module">{module}.</span>

    // Put it all together into a nice little html view.
    return (
      <div className="doc-containter" style={{width}}>
        <div className="doc-header">
          {moduleHtml}
          <span className="doc-name">{name}</span>
        </div>
        <div className="doc-string">{docString}</div>
      </div>
    );
  }
}

export default DocString;
