import React, { ComponentType, ReactElement, useEffect, useState } from "react"
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"
import Icon from "src/components/shared/Icon"
import classNames from "classnames"
import {
  StatelessAccordion as Accordion,
  Panel,
  SharedProps,
} from "baseui/accordion"
import { useTheme } from "@emotion/react"
import { StyledExpandableContainer } from "./styled-components"

export interface Props {
  expandable: boolean
  label: string
  expanded: boolean
  empty: boolean
  widgetsDisabled: boolean
  isStale: boolean
}

function withExpandable(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  const ExpandableComponent = (props: Props): ReactElement => {
    const {
      label,
      expanded: initialExpanded,
      empty,
      widgetsDisabled,
      isStale,
      ...componentProps
    } = props

    const [expanded, setExpanded] = useState<boolean>(initialExpanded)
    useEffect(() => {
      setExpanded(initialExpanded)
      // Having `label` in the dependency array here is necessary because
      // sometimes two distinct expanders look so similar that even the react
      // diffing algorithm decides that they're the same element with updated
      // props (this happens when something in the app removes one expander and
      // replaces it with another in the same position).
      //
      // By adding `label` as a dependency, we ensure that we reset the
      // expander's `expanded` state in this edge case.
    }, [label, initialExpanded])

    const toggle = (): void => setExpanded(!expanded)
    const { colors, radii, spacing, fontSizes } = useTheme()

    return (
      <StyledExpandableContainer data-testid="stExpander">
        <Accordion
          onChange={toggle}
          expanded={expanded ? ["panel"] : []}
          disabled={widgetsDisabled}
          overrides={{
            Content: {
              style: ({ $expanded }: SharedProps) => ({
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
                borderTop: "none !important",
                borderBottom: "none !important",
                borderRight: "none !important",
                borderLeft: "none !important",
              }),
            },
            Header: {
              style: ({ $disabled }: SharedProps) => ({
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
                isStale,
              },
            },
            ToggleIcon: {
              style: ({ $disabled }: SharedProps) => ({
                color: $disabled ? colors.disabled : colors.bodyText,
              }),
              // eslint-disable-next-line react/display-name
              component: () => {
                if (expanded) {
                  return <Icon content={ExpandLess} size="lg" />
                }
                return <Icon content={ExpandMore} size="lg" />
              },
            },
            Root: {
              props: {
                className: classNames("streamlit-expander", { empty }),
                isStale,
              },
              style: {
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: colors.fadedText10,
                borderRadius: radii.md,
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
          <Panel title={label} key="panel">
            <WrappedComponent {...componentProps} disabled={widgetsDisabled} />
          </Panel>
        </Accordion>
      </StyledExpandableContainer>
    )
  }

  return ExpandableComponent
}

export default withExpandable
