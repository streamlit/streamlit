/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Represents formatted text.
 */

import CodeBlock from './CodeBlock';
import React from 'react';
import ReactJson from 'react-json-view';
import ReactMarkdown from 'react-markdown';
import {Map as ImmutableMap} from 'immutable';
import {PureStreamlitElement} from './util/StreamlitElement';
import {Text as TextProto} from '../protobuf';
import './Text.css';

function getAlertCSSClass(format: TextProto.Format): string | undefined {
  switch (format) {
    case TextProto.Format.ERROR:    return 'alert-danger';
    case TextProto.Format.WARNING:  return 'alert-warning';
    case TextProto.Format.INFO:     return 'alert-info';
    case TextProto.Format.SUCCESS:  return 'alert-success';
  }
  return undefined;
}

interface Props {
  element: ImmutableMap<string, any>;
  width: number;
}

/**
 * Functional element representing formatted text.
 */
class Text extends PureStreamlitElement<Props> {
  public safeRender(): React.ReactNode {
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
          bodyObject = JSON.parse(body);
        } catch (e) {
          const pos = parseInt(e.message.replace(/[^0-9]/g, ''), 10);
          e.message += `\n${body.substr(0, pos + 1)} ← here`;
          throw e;
        }
        return (
          <div className="json-text-container" style={{width}}>
            <ReactJson
              src={bodyObject}
              displayDataTypes={false}
              displayObjectSize={false}
              name={false}
              style={{font: ''}}  // Unset so we can style via a CSS file.
            />
          </div>
        );

      case TextProto.Format.ERROR:
      case TextProto.Format.WARNING:
      case TextProto.Format.INFO:
      case TextProto.Format.SUCCESS:
        return (
          <div className={`alert ${getAlertCSSClass(format)}`} style={{width}}>
            <div className="markdown-text-container">
              <ReactMarkdown source={body} escapeHtml={false} renderers={{code: CodeBlock}} />
            </div>
          </div>
        );
      // Default
      default:
        throw new Error(`Invalid Text format:${element.get('format')}`);
    }
  }
}

export default Text;
