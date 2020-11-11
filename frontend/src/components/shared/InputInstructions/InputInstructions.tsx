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

import React, { ReactElement } from "react"
import { isFromMac } from "lib/utils"
import classNames from "classnames"
import { StyledWidgetInstructions } from "components/widgets/BaseWidget"

import "./style.scss"

export interface Props {
  dirty: boolean
  value: string
  maxLength?: number
  className?: string
  type?: "multiline" | "single"
}

const InputInstructions = ({
  dirty,
  value,
  maxLength,
  className,
  type = "single",
}: Props): ReactElement => {
  const messages = []

  if (dirty) {
    if (type === "multiline") {
      if (isFromMac()) {
        messages.push(
          <span key={0} className="message">
            Press ⌘+Enter to apply
          </span>
        )
      } else {
        messages.push(
          <span key={0} className="message">
            Press Ctrl+Enter to apply
          </span>
        )
      }
    } else {
      messages.push(
        <span key={0} className="message">
          Press Enter to apply
        </span>
      )
    }
  }

  if (maxLength) {
    messages.push(
      <span
        key={1}
        className={classNames("message", "counter", {
          blink: dirty && value.length >= maxLength,
        })}
      >
        {value.length}/{maxLength}
      </span>
    )
  }

  return (
    <StyledWidgetInstructions className={className}>
      {messages}
    </StyledWidgetInstructions>
  )
}

export default InputInstructions
