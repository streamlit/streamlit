/**
 * Represents formatted text.
 */

import React, { PureComponent} from 'react';
import ReactMarkdown from 'react-markdown';
import './Text.css';

 /**
  * Functional element representing formatted text.
  */
class Text extends PureComponent {
  render() {
    const {element, width} = this.props;
    return (
      <div className="text-container" style={{width}}>
        <ReactMarkdown source={element.get('body')} />
      </div>
    );
  }
}

export default Text;
