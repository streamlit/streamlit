import React, { ReactElement } from "react"
import { isFromMac } from "lib/utils"
import classNames from "classnames"

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
  const containerClassName = classNames("instructions", className)
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

  return <div className={containerClassName}>{messages}</div>
}

export default InputInstructions
