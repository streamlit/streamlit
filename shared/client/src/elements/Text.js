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
    switch (element.get('format')) {
      case 1: // markdown
        return (
          <div className="markdown-text-container" style={{width}}>
            <ReactMarkdown source={element.get('body')} />
          </div>
        );
      default:
        return (
          <div className="plain-text-container" style={{width}}>
            {element.get('body')}
          </div>
        );
    }
  }
}

export default Text;
