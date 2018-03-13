/**
 * Represents formatted text.
 */

import React, { PureComponent} from 'react';
import ReactMarkdown from 'react-markdown';
import ReactJson from 'react-json-view';
import { Alert }  from 'reactstrap';
import './Text.css';

 /**
  * Functional element representing formatted text.
  */
class Text extends PureComponent {
  render() {
    const {element, width} = this.props;
    switch (element.get('format')) {
      case 1: // Text.Format["markdown"]
        return (
          <div className="markdown-text-container" style={{width}}>
            <ReactMarkdown source={element.get('body')} />
          </div>
        );
        break;
      case 2: // Text.Format["json"]
        const body = element.get('body')
        let bodyObject = undefined;
        try {
          bodyObject = JSON.parse(body)
        } catch (e) {
          const pos = parseInt(e.message.replace(/[^0-9]/g, ''))
          const split = body.substr(0, pos).split('\n')
          const line = `${split.length}:${split[split.length - 1].length + 1}`
          return (
            <div className="json-text-container" style={{width}}>
              <Alert color="danger" style={{width}}>
                <strong>Invalid JSON format:</strong> {e.message} ({line})
                <pre className="error"><code>{body.substr(0, pos)}<span className="error">{body[pos]}</span>{body.substr(pos + 1)}</code></pre>
              </Alert>
            </div>
          );
        }
        return (
          <div className="json-text-container" style={{width}}>
            <ReactJson src={bodyObject} displayDataTypes={false} displayObjectSize={false} name={false} />
          </div>
        );
        break;
      default:
        return (
          <Alert color="danger" style={{width}}>
            <strong>Invalid Text format:</strong> {element.get('format')}
          </Alert>
        );
    }
  }
}

export default Text;
