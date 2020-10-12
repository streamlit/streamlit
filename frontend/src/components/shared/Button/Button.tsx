import React, { ReactNode, FunctionComponent, MouseEvent } from "react"
import "./Button.scss"

export enum Kind {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  LINK = "link",
  ICON = "icon",
  MINIMAL = "minimal",
}

export enum Size {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export interface ButtonProps {
  id?: string
  kind: Kind
  size?: Size
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  fluidWidth?: boolean
  children: ReactNode
}

const Button: FunctionComponent<ButtonProps> = ({
  id,
  kind,
  size,
  disabled,
  onClick,
  fluidWidth,
  children,
}) => {
  const fluidWidthClass = fluidWidth ? "button-fluid-width" : ""
  return (
    <button
      id={id}
      className={`streamlit-button ${size}-button ${kind}-button ${fluidWidthClass}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

Button.defaultProps = {
  size: Size.MEDIUM,
  fluidWidth: false,
  disabled: false,
}

export default Button
