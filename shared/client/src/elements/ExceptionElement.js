/**
 * Displays a Python Exception in the Report.
 */

import React, { PureComponent} from 'react';
import './ExceptionElement.css';
import { dispatchOneOf } from 'streamlit-shared/lib/immutableProto';

 /**
  * Functional element representing formatted text.
  */
class ExceptionElement extends PureComponent {
  render() {
    const {element, width} = this.props;
    const type = element.get('type');
    const message = element.get('message');
    const stackTrace = element.get('stackTrace');

    // Put it all together into a nice little html view.
    return (
      <div className="alert alert-danger exception" style={{width}}>
        <div className="message"><strong>{type}</strong>: {message}</div>
        <div className="stack-trace">{
          stackTrace.map((row, indx) =>
            <div className="row" key={indx}>{row}</div>
          )
        }</div>
      </div>
    );
  }
}

export default ExceptionElement;
