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

import React, { ReactElement, useEffect, useState } from "react"
import classNames from "classnames"
import {
  StatelessAccordion as Accordion,
  Panel,
  SharedStylePropsArg,
} from "baseui/accordion"
import { useTheme } from "@emotion/react"
import {
  ExpandMore,
  ExpandLess,
  Check,
  ErrorOutline,
} from "@emotion-icons/material-outlined"

import { Block as BlockProto } from "@streamlit/lib/src/proto"
import {
  StyledSpinnerIcon,
  StyledIcon,
} from "@streamlit/lib/src/components/shared/Icon"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import { IconSize, isPresetTheme } from "@streamlit/lib/src/theme"

import {
  StyledExpandableContainer,
  StyledIconContainer,
} from "./styled-components"

export interface ExpanderIconProps {
  icon: string
}

/**
 * Renders an icon for the expander.
 *
 * If the icon is "spinner", it will render a spinner icon.
 * If the icon is "check", it will render a check icon.
 * If the icon is "error", it will render an error icon.
 * Otherwise, it will render nothing.
 *
 * @param {string} icon - The icon to render.
 * @returns {ReactElement}
 */
export const ExpanderIcon = (props: ExpanderIconProps): ReactElement => {
  const { icon } = props
  const { activeTheme } = React.useContext(LibContext)

  const iconProps = {
    size: "lg" as IconSize,
    margin: "",
    padding: "",
  }
  if (icon === "spinner") {
    const usingCustomTheme = !isPresetTheme(activeTheme)
    return (
      <StyledSpinnerIcon
        usingCustomTheme={usingCustomTheme}
        data-testid="stExpanderIconSpinner"
        {...iconProps}
      />
    )
  } else if (icon === "check") {
    return (
      <StyledIcon
        as={Check}
        color={"inherit"}
        aria-hidden="true"
        data-testid="stExpanderIconCheck"
        {...iconProps}
      />
    )
  } else if (icon === "error") {
    return (
      <StyledIcon
        as={ErrorOutline}
        color={"inherit"}
        aria-hidden="true"
        data-testid="stExpanderIconError"
        {...iconProps}
      />
    )
  }

  return <></>
}

export interface ExpanderProps {
  element: BlockProto.Expandable
  widgetsDisabled: boolean
  isStale: boolean
  empty: boolean
}

const Expander: React.FC<ExpanderProps> = ({
  element,
  widgetsDisabled,
  isStale,
  empty,
  children,
}): ReactElement => {
  const { label, expanded: initialExpanded } = element
  const [expanded, setExpanded] = useState<boolean>(initialExpanded || false)
  useEffect(() => {
    // Only apply the expanded state if it was actually set in the proto.
    if (notNullOrUndefined(initialExpanded)) {
      setExpanded(initialExpanded)
    }
    // Having `label` in the dependency array here is necessary because
    // sometimes two distinct expanders look so similar that even the react
    // diffing algorithm decides that they're the same element with updated
    // props (this happens when something in the app removes one expander and
    // replaces it with another in the same position).
    //
    // By adding `label` as a dependency, we ensure that we reset the
    // expander's `expanded` state in this edge case.
  }, [label, initialExpanded])

  const toggle = (): void => {
    if (!empty) {
      setExpanded(!expanded)
    }
  }
  const { colors, radii, spacing, fontSizes } = useTheme()

  return (
    <StyledExpandableContainer
      data-testid="stExpander"
      empty={empty}
      disabled={widgetsDisabled}
    >
      <Accordion
        onChange={toggle}
        expanded={expanded && !empty ? ["panel"] : []}
        disabled={widgetsDisabled}
        overrides={{
          Content: {
            style: ({ $expanded }: SharedStylePropsArg) => ({
              backgroundColor: colors.transparent,
              marginLeft: spacing.none,
              marginRight: spacing.none,
              marginTop: spacing.none,
              marginBottom: spacing.none,
              overflow: "visible",
              paddingLeft: spacing.lg,
              paddingRight: spacing.lg,
              paddingTop: 0,
              paddingBottom: $expanded ? spacing.lg : 0,
              borderTopStyle: "none",
              borderBottomStyle: "none",
              borderRightStyle: "none",
              borderLeftStyle: "none",
            }),
            props: { className: "streamlit-expanderContent" },
          },
          // Allow fullscreen button to overflow the expander
          ContentAnimationContainer: {
            style: ({ $expanded }: SharedStylePropsArg) => ({
              overflow: $expanded ? "visible" : "hidden",
            }),
          },
          PanelContainer: {
            style: () => ({
              marginLeft: `${spacing.none} !important`,
              marginRight: `${spacing.none} !important`,
              marginTop: `${spacing.none} !important`,
              marginBottom: `${spacing.none} !important`,
              paddingLeft: `${spacing.none} !important`,
              paddingRight: `${spacing.none} !important`,
              paddingTop: `${spacing.none} !important`,
              paddingBottom: `${spacing.none} !important`,
              borderTopStyle: "none !important",
              borderBottomStyle: "none !important",
              borderRightStyle: "none !important",
              borderLeftStyle: "none !important",
            }),
          },
          Header: {
            style: ({ $disabled }: SharedStylePropsArg) => ({
              marginBottom: spacing.none,
              marginLeft: spacing.none,
              marginRight: spacing.none,
              marginTop: spacing.none,
              backgroundColor: colors.transparent,
              color: $disabled ? colors.disabled : colors.bodyText,
              fontSize: fontSizes.sm,
              borderTopStyle: "none",
              borderBottomStyle: "none",
              borderRightStyle: "none",
              borderLeftStyle: "none",
              paddingBottom: spacing.md,
              paddingTop: spacing.md,
              paddingRight: spacing.lg,
              paddingLeft: spacing.lg,
              ...(isStale
                ? {
                    opacity: 0.33,
                    transition: "opacity 1s ease-in 0.5s",
                  }
                : {}),
            }),
            props: {
              className: "streamlit-expanderHeader",
            },
          },
          ToggleIcon: {
            style: ({ $disabled }: SharedStylePropsArg) => ({
              color: $disabled ? colors.disabled : colors.bodyText,
            }),
            // eslint-disable-next-line react/display-name
            component: () => {
              if (empty) {
                // Don't show then expand/collapse icon if there's no content.
                return <></>
              }
              return (
                <StyledIcon
                  as={expanded ? ExpandLess : ExpandMore}
                  color={"inherit"}
                  aria-hidden="true"
                  data-testid="stExpanderToggleIcon"
                  size="lg"
                  margin=""
                  padding=""
                />
              )
            },
          },
          Root: {
            props: {
              className: classNames("streamlit-expander"),
            },
            style: {
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: colors.fadedText10,
              borderRadius: radii.lg,
              ...(isStale
                ? {
                    borderColor: colors.fadedText05,
                    transition: "border 1s ease-in 0.5s",
                  }
                : {}),
            },
          },
        }}
      >
        <Panel
          title={
            <StyledIconContainer>
              {element.icon && <ExpanderIcon icon={element.icon} />}
              <StreamlitMarkdown source={label} allowHTML={false} isLabel />
            </StyledIconContainer>
          }
          key="panel"
        >
          {children}
        </Panel>
      </Accordion>
    </StyledExpandableContainer>
  )
}

export default Expander
