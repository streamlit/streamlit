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

import React, { PureComponent } from "react"
import Clipboard from "clipboard"
import { Copy as CopyIcon } from "react-feather"
import "./CopyButton.scss"

interface Props {
  text: string
}

class CopyButton extends PureComponent<Props> {
  private button = React.createRef<HTMLButtonElement>()
  private clipboard: ClipboardJS | null = null

  public componentDidMount = () => {
    const node = this.button.current
    if (node !== null) {
      this.clipboard = new Clipboard(node)
    }
  }

  public componentWillUnmount = () => {
    if (this.clipboard !== null) {
      this.clipboard.destroy()
    }
  }

  public render = (): React.ReactNode => (
    <button
      ref={this.button}
      title="Copy to clipboard"
      className="copyBtn"
      data-clipboard-text={this.props.text}
    >
      <CopyIcon size="16" />
    </button>
  )
}

export default CopyButton
