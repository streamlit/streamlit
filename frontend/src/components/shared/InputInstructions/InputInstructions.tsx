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
  let message

  if (type === "multiline") {
    if (isFromMac()) {
      message = "Press ⌘+Enter to apply"
    }

    if (!isFromMac()) {
      message = "Press Ctrl+Enter to apply"
    }
  } else {
    message = "Press Enter to apply"
  }

  if (dirty && maxLength && value.length > 0) {
    return (
      <div className={containerClassName}>
        <span className="message">{message}</span>
        <span className="separator">•</span>
        <span
          className={classNames("counter", {
            blink: value.length >= maxLength,
          })}
        >
          {value.length}/{maxLength}
        </span>
      </div>
    )
  }

  if (dirty) {
    return <div className={containerClassName}>{message}</div>
  }

  return <></>
}

export default InputInstructions
