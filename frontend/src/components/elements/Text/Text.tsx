/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Represents formatted text.
 */

import React, {ReactNode, ReactElement} from 'react'
import ReactJson from 'react-json-view'
import ReactMarkdown from 'react-markdown'
import {Map as ImmutableMap} from 'immutable'
import CodeBlock from '../CodeBlock'
import {PureStreamlitElement, StProps, StState} from 'components/shared/StreamlitElement/'
import {Text as TextProto} from 'autogen/protobuf'
import './Text.scss'

function getAlertCSSClass(format: TextProto.Format): string | undefined {
  switch (format) {
    case TextProto.Format.ERROR:    return 'alert-danger'
    case TextProto.Format.WARNING:  return 'alert-warning'
    case TextProto.Format.INFO:     return 'alert-info'
    case TextProto.Format.SUCCESS:  return 'alert-success'
  }
  return undefined
}

interface LinkProps {
  href: string;
  children: ReactElement;
}

// Using target="_blank" without rel="noopener noreferrer" is a security risk:
// see https://mathiasbynens.github.io/rel-noopener
const linkWithTargetBlank = (props: LinkProps): ReactElement => (
  <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>
)

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}

/**
 * Functional element representing formatted text.
 */
class Text extends PureStreamlitElement<Props, StState> {
  public safeRender(): ReactNode {
    const {element, width} = this.props
    const body = element.get('body')
    const format = element.get('format')
    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
    }

    switch (format) {
      // Plain, fixed width text.
      case TextProto.Format.PLAIN:
        return (
          <div className="fixed-width stText" style={{width}}>
            {body}
          </div>
        )

      // Markdown.
      case TextProto.Format.MARKDOWN:
        return (
          <div className="markdown-text-container stText" style={{width}}>
            <ReactMarkdown source={body} escapeHtml={false} renderers={renderers} />
          </div>
        )

      // A JSON object. Stored as a string.
      case TextProto.Format.JSON:
        let bodyObject = undefined
        try {
          bodyObject = JSON.parse(body)
        } catch (e) {
          const pos = parseInt(e.message.replace(/[^0-9]/g, ''), 10)
          e.message += `\n${body.substr(0, pos + 1)} ← here`
          throw e
        }
        return (
          <div className="json-text-container stText" style={{width}}>
            <ReactJson
              src={bodyObject}
              displayDataTypes={false}
              displayObjectSize={false}
              name={false}
              style={{font: ''}}  // Unset so we can style via a CSS file.
            />
          </div>
        )

      case TextProto.Format.ERROR:
      case TextProto.Format.WARNING:
      case TextProto.Format.INFO:
      case TextProto.Format.SUCCESS:
        return (
          <div className={`alert ${getAlertCSSClass(format)}`} style={{width}}>
            <div className="markdown-text-container stText">
              <ReactMarkdown source={body} escapeHtml={false} renderers={renderers} />
            </div>
          </div>
        )
      // Default
      default:
        throw new Error(`Invalid Text format:${element.get('format')}`)
    }
  }
}

export default Text
