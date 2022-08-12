import React, { ReactElement } from "react"

import Button, { Kind } from "src/components/shared/Button"
import {
  IGuestToHostMessage,
  IToolbarItem,
} from "src/hocs/withS4ACommunication/types"
import {
  StyledActionButtonContainer,
  StyledActionButtonIcon,
} from "./styled-components"

export interface ActionButtonProps {
  borderless?: boolean
  label?: string
  icon?: string
  onClick: () => void
}

export function ActionButton({
  borderless,
  label,
  icon,
  onClick,
}: ActionButtonProps): ReactElement {
  return (
    <div className="stActionButton">
      <Button onClick={onClick} kind={Kind.HEADER_BUTTON}>
        <StyledActionButtonContainer>
          {icon && <StyledActionButtonIcon icon={icon} />}
          {label && <span>{label}</span>}
        </StyledActionButtonContainer>
      </Button>
    </div>
  )
}

export interface ToolbarActionsProps {
  sendS4AMessage: (message: IGuestToHostMessage) => void
  s4aToolbarItems: IToolbarItem[]
}

function ToolbarActions({
  sendS4AMessage,
  s4aToolbarItems,
}: ToolbarActionsProps): ReactElement {
  return (
    <>
      {s4aToolbarItems.map(({ borderless, key, label, icon }) => (
        <ActionButton
          key={key}
          label={label}
          icon={icon}
          borderless={borderless}
          onClick={() =>
            sendS4AMessage({
              type: "TOOLBAR_ITEM_CALLBACK",
              key,
            })
          }
        />
      ))}
    </>
  )
}

export default ToolbarActions
