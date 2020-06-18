/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React, { CSSProperties } from "react"
import { Map as ImmutableMap } from "immutable"

/**
 * Our iframe sandbox options.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#Attributes
 *
 * From that page:
 * "When the embedded document has the same origin as the embedding page, it is
 * strongly discouraged to use both allow-scripts and allow-same-origin, as
 * that lets the embedded document remove the sandbox attribute — making it no
 * more secure than not using the sandbox attribute at all."
 */
const SANDBOX_POLICY = [
  // Allows for downloads to occur without a gesture from the user.
  // Experimental; limited browser support.
  // "allow-downloads-without-user-activation",

  // Allows the resource to submit forms. If this keyword is not used, form submission is blocked.
  "allow-forms",

  // Lets the resource open modal windows.
  "allow-modals",

  // Lets the resource lock the screen orientation.
  // "allow-orientation-lock",

  // Lets the resource use the Pointer Lock API.
  // "allow-pointer-lock",

  // Allows popups (such as window.open(), target="_blank", or showModalDialog()). If this keyword is not used, the popup will silently fail to open.
  "allow-popups",

  // Lets the sandboxed document open new windows without those windows inheriting the sandboxing. For example, this can safely sandbox an advertisement without forcing the same restrictions upon the page the ad links to.
  "allow-popups-to-escape-sandbox",

  // Lets the resource start a presentation session.
  // "allow-presentation",

  // If this token is not used, the resource is treated as being from a special origin that always fails the same-origin policy.
  "allow-same-origin",

  // Lets the resource run scripts (but not create popup windows).
  "allow-scripts",

  // Lets the resource request access to the parent's storage capabilities with the Storage Access API.
  // Experimental; limited browser support.
  // "allow-storage-access-by-user-activation",

  // Lets the resource navigate the top-level browsing context (the one named _top).
  // "allow-top-navigation",

  // Lets the resource navigate the top-level browsing context, but only if initiated by a user gesture.
  // "allow-top-navigation-by-user-activation",
].join(" ")

export interface Props {
  element: ImmutableMap<string, any>
  width: number
}

class IFrame extends React.PureComponent<Props> {
  public render(): JSX.Element {
    const width = this.props.element.get("hasWidth")
      ? this.props.element.get("width")
      : this.props.width

    // Handle scrollbar visibility. Chrome and other WebKit browsers still
    // seem to use the deprecated "scrolling" attribute, whereas the standard
    // says to use a CSS style.
    let scrolling: string
    let style: CSSProperties
    if (this.props.element.get("scrolling")) {
      scrolling = "auto"
      style = {}
    } else {
      scrolling = "no"
      style = { overflow: "hidden" }
    }

    return (
      <iframe
        style={style}
        src={getNonEmptyString(this.props.element, "src")}
        srcDoc={getNonEmptyString(this.props.element, "srcdoc")}
        width={width}
        height={this.props.element.get("height")}
        allowFullScreen={false}
        scrolling={scrolling}
        sandbox={SANDBOX_POLICY}
        title="st.iframe"
      />
    )
  }
}

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  element: ImmutableMap<string, any>,
  name: string
): string | undefined {
  const value = element.get(name)
  return value == null || value === "" ? undefined : value
}

export default IFrame
