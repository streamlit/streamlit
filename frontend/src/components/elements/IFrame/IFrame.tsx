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

import { IFrame as IFrameProto } from "autogen/proto"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  getIFrameSandboxPolicy,
} from "lib/IFrameUtil"
import React, { CSSProperties, ReactElement } from "react"

export interface IFrameProps {
  element: IFrameProto
  width: number
}

export default function IFrame({
  element,
  width: propWidth,
}: IFrameProps): ReactElement {
  const width = element.hasWidth ? element.width : propWidth

  // Handle scrollbar visibility. Chrome and other WebKit browsers still
  // seem to use the deprecated "scrolling" attribute, whereas the standard
  // says to use a CSS style.
  let scrolling: string
  let style: CSSProperties
  if (element.scrolling) {
    scrolling = "auto"
    style = {}
  } else {
    scrolling = "no"
    style = { overflow: "hidden" }
  }

  // Either 'src' or 'srcDoc' will be set in our element. If 'src'
  // is set, we're loading a remote URL in the iframe, and we can
  // safely use the `allow-same-origin` sandbox parameter. But if
  // 'srcDoc' is set instead, we're displaying a literal string as HTML,
  // and our iframe will have the same origin as we do, and therefore
  // we cannot safely use `allow-same-origin` because doing so would
  // let the iframe'd content escape its sandbox.
  const src = getNonEmptyString(element.src)
  let srcDoc: string | undefined
  let allowSameOrigin: boolean
  if (src != null) {
    srcDoc = undefined
    allowSameOrigin = true
  } else {
    srcDoc = getNonEmptyString(element.srcdoc)
    allowSameOrigin = false
  }

  return (
    <iframe
      allow={DEFAULT_IFRAME_FEATURE_POLICY}
      style={style}
      src={src}
      srcDoc={srcDoc}
      width={width}
      height={element.height}
      scrolling={scrolling}
      sandbox={getIFrameSandboxPolicy(allowSameOrigin)}
      title="st.iframe"
    />
  )
}

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return value == null || value === "" ? undefined : value
}
