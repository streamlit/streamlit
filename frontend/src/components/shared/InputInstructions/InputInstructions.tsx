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
  const baseClassName = ["instructions", className]

  if (value.length > 0 && maxLength) {
    return (
      <div
        className={classNames(baseClassName, {
          blink: value.length >= maxLength,
        })}
      >
        {value.length}/{maxLength}
      </div>
    )
  }

  if (type === "multiline") {
    if (dirty && !isFromMac()) {
      return (
        <div className={classNames(baseClassName)}>
          Press Ctrl+Enter to apply
        </div>
      )
    }

    if (dirty && isFromMac()) {
      return (
        <div className={classNames(baseClassName)}>Press ⌘+Enter to apply</div>
      )
    }
  }

  if (dirty) {
    return (
      <div className={classNames(baseClassName)}>Press Enter to apply</div>
    )
  }

  return <></>
}

export default InputInstructions
