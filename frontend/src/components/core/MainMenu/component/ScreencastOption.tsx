import React from "react"
import { DropdownItem } from "reactstrap"

interface Props {
  screenCastState: string
  onClick: () => void
}

const ScreencastOption = ({
  screenCastState,
  onClick,
}: Props): JSX.Element => {
  if (screenCastState === "COUNTDOWN") {
    return (
      <DropdownItem onClick={onClick}>
        <span>Cancel screencast</span>
        <span className="shortcut">ESC</span>
      </DropdownItem>
    )
  }

  if (screenCastState === "RECORDING") {
    return (
      <DropdownItem onClick={onClick} className="stop-recording">
        <span>
          <strong>Stop recording</strong>
        </span>

        <span className="shortcut">ESC</span>
      </DropdownItem>
    )
  }

  return <DropdownItem onClick={onClick}>Record a screencast</DropdownItem>
}

export default ScreencastOption
