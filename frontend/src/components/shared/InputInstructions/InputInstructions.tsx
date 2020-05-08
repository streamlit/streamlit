import React, { ReactElement } from "react"
import { isFromMac } from "lib/utils"
import classNames from "classnames"

import "./style.scss"

export interface Props {
  dirty: boolean
  value: string
  maxLength?: number
  type?: "multiline" | "single"
}

const InputInstructions = ({
  dirty,
  value,
  maxLength,
  type = "single",
}: Props): ReactElement => {
  if (value.length > 0 && maxLength) {
    return (
      <div
        className={classNames("instructions", {
          blink: value.length >= maxLength,
        })}
      >
        {value.length}/{maxLength}
      </div>
    )
  }

  if (type === "multiline") {
    if (dirty && !isFromMac()) {
      return <div className="instructions">Press Ctrl+Enter to apply</div>
    }

    if (dirty && isFromMac()) {
      return <div className="instructions">Press ⌘+Enter to apply</div>
    }
  }

  if (dirty) {
    return <div className="instructions">Press Enter to apply</div>
  }

  return <></>
}

export default InputInstructions
