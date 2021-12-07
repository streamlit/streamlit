/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
import Button, { Kind } from "src/components/shared/Button"
import {
  IGuestToHostMessage,
  IToolbarItem,
} from "src/hocs/withS4ACommunication/types"

export interface ToolbarButtonProps {
  label?: string
  icon?: string
  onClick: () => void
}

function ToolbarButton({
  label,
  icon,
  onClick,
}: ToolbarButtonProps): ReactElement {
  return (
    <div className="stToolbarButton">
      <Button onClick={onClick} kind={Kind.ICON}>
        {icon && <img src={icon}></img>}
        {label && <span>{label}</span>}
      </Button>
    </div>
  )
}

export interface ToolbarButtonsProps {
  sendS4AMessage: (message: IGuestToHostMessage) => void
  s4aToolbarItems: IToolbarItem[]
}

function ToolbarButtons({
  sendS4AMessage,
  s4aToolbarItems,
}: ToolbarButtonsProps): ReactElement {
  return (
    <>
      {s4aToolbarItems.map(({ key, label, icon }) => (
        <ToolbarButton
          key={key}
          label={label}
          icon={icon}
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

export default ToolbarButtons
