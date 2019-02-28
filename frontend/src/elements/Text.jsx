/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Represents formatted text.
 */

import React, { PureComponent } from 'react';
import ReactMarkdown from 'react-markdown';
import ReactJson from 'react-json-view';
import { Alert } from 'reactstrap';
import { Text as TextProto } from '../protobuf';
import CodeBlock from './CodeBlock';
import './Text.css';

/**
 * Functional element representing formatted text.
 */
class Text extends PureComponent {
  render() {
    const {element, width} = this.props;
    const body = element.get('body');
    const format = element.get('format');

    switch (format) {
      // Plain, fixed width text.
      case TextProto.Format.PLAIN:
        return (
          <div className="fixed-width" style={{width}}>
            {body}
          </div>
        );

      // Markdown.
      case TextProto.Format.MARKDOWN:
        return (
          <div className="markdown-text-container" style={{width}}>
            <ReactMarkdown source={body} escapeHtml={false} renderers={{code: CodeBlock}} />
          </div>
        );

      // A JSON object. Stored as a string.
      case TextProto.Format.JSON:
        let bodyObject = undefined;
        try {
          bodyObject = JSON.parse(body)
        } catch (e) {
          const pos = parseInt(e.message.replace(/[^0-9]/g, ''), 10);
          const split = body.substr(0, pos).split('\n');
          const line = `${split.length}:${split[split.length - 1].length + 1}`
          return (
            <div className="json-text-container" style={{width}}>
              <Alert color="danger" style={{width}}>
                <strong>Invalid JSON format:</strong> {e.message} ({line})
                <pre className="error">
                  <code>
                    {body.substr(0, pos)}
                    <span className="error">{body[pos]}</span>
                    {body.substr(pos + 1)}
                  </code>
                </pre>
              </Alert>
            </div>
          );
        }
        return (
          <div className="json-text-container" style={{width}}>
            <ReactJson
              src={bodyObject}
              displayDataTypes={false}
              displayObjectSize={false}
              name={false}
              style={{font: ""}}  // Unset so we can style via a CSS file.
            />
          </div>
        );

      case TextProto.Format.ERROR:
      case TextProto.Format.WARNING:
      case TextProto.Format.INFO:
      case TextProto.Format.SUCCESS:
        const alertType = {
          [TextProto.Format.ERROR]: 'alert-danger',
          [TextProto.Format.WARNING]: 'alert-warning',
          [TextProto.Format.INFO]: 'alert-info',
          [TextProto.Format.SUCCESS]: 'alert-success',
        }[format];
        return (
          <div className={`alert ${alertType}`} style={{width}}>
            {body}
          </div>
        );
      // Default
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
