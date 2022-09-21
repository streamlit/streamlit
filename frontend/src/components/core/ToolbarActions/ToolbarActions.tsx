/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
