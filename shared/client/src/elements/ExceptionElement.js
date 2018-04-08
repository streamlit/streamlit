/**
 * Displays a Python Exception in the Report.
 */

import React, { PureComponent} from 'react';
// import './ExceptionElement.css';
import { dispatchOneOf } from 'streamlit-shared/lib/immutableProto';
 /**
  * Functional element representing formatted text.
  */
class ExceptionElement extends PureComponent {
  render() {
    const {element, width} = this.props;
    const type = element.get('type');
    const stackTrace = element.get('stackTrace');

    // The module string may be blank so there's a bit more logic here.
    let moduleHtml = '';
    const module = element.get('module');
    if (module)
      moduleHtml = <span className="doc-module">{module}.</span>

    // Put it all together into a nice little html view.
    return (
      <div className="exception" style={{width}}>
        <div className="type">{type}</div>
        <div className="stack-trace">{stackTrace}</div>
      </div>
    );
  }
}

export default ExceptionElement;
