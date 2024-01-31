/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { useTheme } from "@emotion/react"
import { ExpandMore } from "@emotion-icons/material-outlined"

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"
import { StyledIcon } from "@streamlit/lib/src/components/shared/Icon"
import { Block as BlockProto } from "@streamlit/lib/src/proto"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

import {
  StatefulPopover as UIPopover,
  TRIGGER_TYPE,
  PLACEMENT,
} from "baseui/popover"

import { StyledPopoverButtonIcon } from "./styled-components"

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
}

const Popover: React.FC<PopoverProps> = ({
  element,
  empty,
  children,
}): ReactElement => {
  const theme = useTheme()
  const lightBackground = hasLightBackgroundColor(theme)

  return (
    <div data-testid="stPopover">
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        content={() => children}
        overrides={{
          Body: {
            style: () => ({
              marginRight: theme.spacing.lg,
              marginBottom: theme.spacing.lg,
              maxHeight: "70vh",
              overflow: "auto",
              maxWidth: "80vw",
              minWidth: "20rem",

              paddingRight: "calc(1em - 1px)", // 1px to account for border.
              paddingLeft: "calc(1em - 1px)",
              paddingBottom: "calc(1em - 1px)",
              paddingTop: "calc(1em - 1px)",

              borderLeftWidth: "1px",
              borderRightWidth: "1px",
              borderTopWidth: "1px",
              borderBottomWidth: "1px",

              borderLeftRadius: theme.radii.lg,
              borderRightRadius: theme.radii.lg,
              borderTopRadius: theme.radii.lg,
              borderBottomRadius: theme.radii.lg,

              borderLeftStyle: "solid",
              borderRightStyle: "solid",
              borderTopStyle: "solid",
              borderBottomStyle: "solid",

              borderLeftColor: theme.colors.fadedText10,
              borderRightColor: theme.colors.fadedText10,
              borderTopColor: theme.colors.fadedText10,
              borderBottomColor: theme.colors.fadedText10,

              boxShadow: lightBackground
                ? "0px 4px 16px rgba(0, 0, 0, 0.16)"
                : "0px 4px 16px rgba(0, 0, 0, 0.7)",
            }),
          },
        }}
      >
        {/* This needs to be wrapped into a div, otherwise
      the BaseWeb popover implementation throws an error. */}
        <div>
          <BaseButton
            kind={BaseButtonKind.SECONDARY}
            size={BaseButtonSize.SMALL}
            disabled={empty}
            fluidWidth={element.useContainerWidth}
            data-testid="stPopoverButton"
          >
            <StreamlitMarkdown
              source={element.label}
              allowHTML={false}
              isLabel
              largerLabel
              disableLinks
            />
            <StyledPopoverButtonIcon>
              <StyledIcon
                as={ExpandMore}
                color={"inherit"}
                aria-hidden="true"
                size="lg"
                margin=""
                padding=""
              />
            </StyledPopoverButtonIcon>
          </BaseButton>
        </div>
      </UIPopover>
    </div>
  )
}

export default Popover
