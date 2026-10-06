/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import type { ReactElement } from "react"

import type { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  BaseButton,
  BaseButtonKind,
  type IGuestToHostMessage,
  type IToolbarItem,
} from "@streamlit/lib"

import {
  StyledActionButtonContainer,
  StyledActionButtonIcon,
  StyledToolbarActions,
} from "./styled-components"

const DEFAULT_TOOLBAR_ACTION_NAME = "Toolbar action"

function trimHostString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Accessible name for a host toolbar action.
 *
 * Host messages are untrusted: `label` / `key` may be missing or non-strings.
 * Prefer a visible label, then a string key (so multiple icon-only actions stay
 * distinct), then a stable generic name. Icons are CSS background URLs and
 * cannot contribute a Material/emoji name.
 */
export function getToolbarActionAccessibleName(
  label?: string | null,
  key?: string | null
): string {
  return (
    trimHostString(label) || trimHostString(key) || DEFAULT_TOOLBAR_ACTION_NAME
  )
}

export interface ActionButtonProps {
  label?: string
  icon?: string
  /** Host item key. Used when there is no visible label; may still fall back to "Toolbar action". */
  itemKey?: string
  onClick: () => void
}

export function ActionButton({
  label,
  icon,
  itemKey,
  onClick,
}: ActionButtonProps): ReactElement {
  const visibleLabel = trimHostString(label) || undefined
  const accessibleName = getToolbarActionAccessibleName(label, itemKey)

  return (
    <div className="stToolbarActionButton" data-testid="stToolbarActionButton">
      <BaseButton
        onClick={onClick}
        kind={BaseButtonKind.HEADER_BUTTON}
        // aria-label overrides contents; only set it when there is no visible label.
        aria-label={visibleLabel ? undefined : accessibleName}
      >
        <StyledActionButtonContainer>
          {icon && (
            <StyledActionButtonIcon
              data-testid="stToolbarActionButtonIcon"
              icon={icon}
              aria-hidden="true"
            />
          )}
          {visibleLabel && (
            <span data-testid="stToolbarActionButtonLabel">
              {visibleLabel}
            </span>
          )}
        </StyledActionButtonContainer>
      </BaseButton>
    </div>
  )
}

export interface ToolbarActionsProps {
  sendMessageToHost: (message: IGuestToHostMessage) => void
  hostToolbarItems: IToolbarItem[]
  metricsMgr: MetricsManager
}

function ToolbarActions({
  sendMessageToHost,
  hostToolbarItems,
  metricsMgr,
}: ToolbarActionsProps): ReactElement {
  return (
    <StyledToolbarActions
      className="stToolbarActions"
      data-testid="stToolbarActions"
    >
      {hostToolbarItems.map(({ key, label, icon }) => (
        <ActionButton
          key={key}
          label={label}
          icon={icon}
          itemKey={key}
          onClick={() => {
            metricsMgr.enqueue("menuClick", {
              label: key,
            })
            sendMessageToHost({
              type: "TOOLBAR_ITEM_CALLBACK",
              key,
            })
          }}
        />
      ))}
    </StyledToolbarActions>
  )
}

export default ToolbarActions
