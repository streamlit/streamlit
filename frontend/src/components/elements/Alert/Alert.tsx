/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode, ReactElement } from "react"

import classNames from "classnames"
import ReactMarkdown from "react-markdown"
import { Map as ImmutableMap } from "immutable"
import { Alert as AlertProto } from "autogen/proto"

// Ignoring typeScript for this module as it has no ts support
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"

import "./Alert.scss"

function getAlertCSSClass(format: AlertProto.Format): string | undefined {
  switch (format) {
    case AlertProto.Format.ERROR:
      return "alert-danger"
    case AlertProto.Format.WARNING:
      return "alert-warning"
    case AlertProto.Format.INFO:
      return "alert-info"
    case AlertProto.Format.SUCCESS:
      return "alert-success"
  }
  return undefined
}

interface LinkProps {
  href: string
  children: ReactElement
}

interface LinkReferenceProps {
  href: string
  children: [ReactElement]
}

// Using target="_blank" without rel="noopener noreferrer" is a security risk:
// see https://mathiasbynens.github.io/rel-noopener
const linkWithTargetBlank = (props: LinkProps): ReactElement => (
  <a href={props.href} target="_blank" rel="noopener noreferrer">
    {props.children}
  </a>
)

// Handle rendering a link through a reference, ex [text](href)
// Don't convert to a link if only `[text]` and missing `(href)`
const linkReferenceHasParens = (props: LinkReferenceProps): any => {
  const { href, children } = props

  if (!href) {
    return children.length ? `[${children[0].props.children}]` : ""
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class Alert extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const format = element.get("format")
    const renderers = {
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
    }
    const styleProp = { width }

    return (
      <div
        className={classNames("alert", getAlertCSSClass(format), "stText")}
        style={styleProp}
      >
        <div className="markdown-text-container">
          <ReactMarkdown source={body} renderers={renderers} />
        </div>
      </div>
    )
  }
}

export default Alert
