/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IFrame as IFrameProto } from "src/autogen/proto"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "src/lib/IFrameUtil"
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
  // is set, we're loading a remote URL in the iframe.
  const src = getNonEmptyString(element.src)
  const srcDoc = src != null ? undefined : getNonEmptyString(element.srcdoc)

  return (
    <iframe
      allow={DEFAULT_IFRAME_FEATURE_POLICY}
      style={style}
      src={src}
      srcDoc={srcDoc}
      width={width}
      height={element.height}
      scrolling={scrolling}
      sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
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
