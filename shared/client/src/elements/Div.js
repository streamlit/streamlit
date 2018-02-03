/**
 * Represents some text in a div.
 */

import React, { PureComponent} from 'react';
import './Div.css';

 /**
  * Functional element representing some text in a div.
  */
class Div extends PureComponent {
  render() {
    const {element, width} = this.props;
    return (
      <div className={element.get('classes')} style={{width}}>
        {element.get('text').replace('\r', '').split('\n').map((line, indx) => (
          <div key={indx}>{line}</div>
        ))}
      </div>
    );
  }
}

export default Div;
