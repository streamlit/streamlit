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

import React from "react"
import { Map as ImmutableMap } from "immutable"

export interface Props {
  element: ImmutableMap<string, any>
  width: number
}

class IFrame extends React.PureComponent<Props> {
  public render(): JSX.Element {
    const width = this.props.element.get("hasWidth")
      ? this.props.element.get("width")
      : this.props.width

    // An empty string for sandbox means "apply all sandbox restrictions",
    // so getNonEmptyString() is not appropriate here.
    const sandbox = this.props.element.get("hasSandbox")
      ? this.props.element.get("sandbox")
      : undefined

    return (
      <iframe
        src={getNonEmptyString(this.props.element, "src")}
        srcDoc={getNonEmptyString(this.props.element, "srcdoc")}
        width={width}
        height={this.props.element.get("height")}
        name={this.props.element.get("name")}
        allow={getNonEmptyString(this.props.element, "allow")}
        allowFullScreen={this.props.element.get("allowFullscreen")}
        referrerPolicy={getNonEmptyString(
          this.props.element,
          "referrerPolicy"
        )}
        sandbox={sandbox}
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
