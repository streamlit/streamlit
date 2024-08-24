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

import React, {
  ReactElement,
  useEffect,
  useCallback,
  useState,
  memo,
} from "react"

import { withTheme } from "@emotion/react"
import {
  LABEL_PLACEMENT,
  STYLE_TYPE,
  Checkbox as UICheckbox,
} from "baseui/checkbox"
import { transparentize } from "color2k"

import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import { Checkbox as CheckboxProto } from "@streamlit/lib/src/proto"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  useWatchedState,
  WatchedValue,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import {
  EmotionTheme,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { StyledWidgetLabelHelpInline } from "@streamlit/lib/src/components/widgets/BaseWidget"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

import { StyledCheckbox, StyledContent } from "./styled-components"

export interface OwnProps {
  disabled: boolean
  element: CheckboxProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

interface ThemeProps {
  theme: EmotionTheme
}

export type Props = OwnProps & ThemeProps

// Values with provenance labels attached to them.
// "Pvnd" is short for "Provenanced".
interface PvndValue<T> {
  value: T
  fromUi: boolean
}

function Checkbox({
  theme,
  width,
  element,
  disabled,
  widgetMgr,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const [formClearHelper, _] = useState(() => new FormClearHelper())
  useEffect(() => () => formClearHelper.disconnect(), [])

  const [value, setWatchedValue] = useWatchedState<boolean>({
    init: (): boolean => {
      // If WidgetStateManager knew a value for this widget, initialize to that.
      // Otherwise, use the default value from the widget protobuf.
      return widgetMgr.getBoolValue(element) ?? element.default
    },

    onChange(pv: PvndValue<boolean>): void {
      widgetMgr.setBoolValue(
        element,
        pv.value,
        { fromUi: pv.fromUi },
        fragmentId
      )
    },
  })

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  const onFormCleared = useCallback((): void => {
    console.log("Clearing form. Element.default:", element.default)
    setWatchedValue({ value: element.default, fromUi: true })
  }, [setWatchedValue, element])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setWatchedValue({ value: e.target.checked, fromUi: true })
    },
    [setWatchedValue]
  )

  const { colors, spacing, sizes } = theme
  const lightTheme = hasLightBackgroundColor(theme)

  const color = disabled ? colors.fadedText40 : colors.bodyText

  // Manage our form-clear event handler.
  formClearHelper.manageFormClearListener(
    widgetMgr,
    element.formId,
    onFormCleared
  )

  console.log("Rendering with:", value)

  return (
    <StyledCheckbox
      className="row-widget stCheckbox"
      data-testid="stCheckbox"
      width={width}
    >
      <UICheckbox
        checked={value}
        disabled={disabled}
        onChange={onChange}
        aria-label={element.label}
        checkmarkType={
          element.type === CheckboxProto.StyleType.TOGGLE
            ? STYLE_TYPE.toggle
            : STYLE_TYPE.default
        }
        labelPlacement={LABEL_PLACEMENT.right}
        overrides={{
          Root: {
            style: ({ $isFocusVisible }: { $isFocusVisible: boolean }) => ({
              marginBottom: spacing.none,
              marginTop: spacing.none,
              paddingRight: spacing.twoThirdsSmFont,
              backgroundColor: $isFocusVisible ? colors.darkenedBgMix25 : "",
              display: "flex",
              alignItems: "start",
            }),
          },
          Toggle: {
            style: ({ $checked }: { $checked: boolean }) => {
              let backgroundColor = lightTheme
                ? colors.bgColor
                : colors.bodyText

              if (disabled) {
                backgroundColor = lightTheme ? colors.gray70 : colors.gray90
              }
              return {
                width: `calc(${sizes.checkbox} - ${theme.spacing.twoXS})`,
                height: `calc(${sizes.checkbox} - ${theme.spacing.twoXS})`,
                transform: $checked ? `translateX(${sizes.checkbox})` : "",
                backgroundColor,
                boxShadow: "",
              }
            },
          },
          ToggleTrack: {
            style: ({
              $checked,
              $isHovered,
            }: {
              $checked: boolean
              $isHovered: boolean
            }) => {
              let backgroundColor = colors.fadedText40

              if ($isHovered && !disabled) {
                backgroundColor = colors.fadedText20
              }

              if ($checked && !disabled) {
                backgroundColor = colors.primary
              }

              return {
                marginRight: 0,
                marginLeft: 0,
                marginBottom: 0,
                marginTop: theme.spacing.twoXS,
                paddingLeft: theme.spacing.threeXS,
                paddingRight: theme.spacing.threeXS,
                width: `calc(2 * ${sizes.checkbox})`,
                minWidth: `calc(2 * ${sizes.checkbox})`,
                height: sizes.checkbox,
                minHeight: sizes.checkbox,
                borderBottomLeftRadius: theme.radii.lg,
                borderTopLeftRadius: theme.radii.lg,
                borderBottomRightRadius: theme.radii.lg,
                borderTopRightRadius: theme.radii.lg,
                backgroundColor,
              }
            },
          },
          Checkmark: {
            style: ({
              $isFocusVisible,
              $checked,
            }: {
              $isFocusVisible: boolean
              $checked: boolean
            }) => {
              const borderColor =
                $checked && !disabled ? colors.primary : colors.fadedText40

              return {
                outline: 0,
                width: sizes.checkbox,
                height: sizes.checkbox,
                marginTop: theme.spacing.twoXS,
                marginLeft: 0,
                marginBottom: 0,
                boxShadow:
                  $isFocusVisible && $checked
                    ? `0 0 0 0.2rem ${transparentize(colors.primary, 0.5)}`
                    : "",
                // This is painfully verbose, but baseweb seems to internally
                // use the long-hand version, which means we can't use the
                // shorthand names here as if we do we'll end up with warn
                // logs spamming us every time a checkbox is rendered.
                borderLeftWidth: sizes.borderWidth,
                borderRightWidth: sizes.borderWidth,
                borderTopWidth: sizes.borderWidth,
                borderBottomWidth: sizes.borderWidth,
                borderLeftColor: borderColor,
                borderRightColor: borderColor,
                borderTopColor: borderColor,
                borderBottomColor: borderColor,
              }
            },
          },
          Label: {
            style: {
              position: "relative",
              color,
            },
          },
        }}
      >
        <StyledContent
          visibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
          data-testid="stWidgetLabel"
        >
          <StreamlitMarkdown
            source={element.label}
            allowHTML={false}
            isLabel
            largerLabel
          />
          {element.help && (
            <StyledWidgetLabelHelpInline color={color}>
              <TooltipIcon
                content={element.help}
                placement={Placement.TOP_RIGHT}
              />
            </StyledWidgetLabelHelpInline>
          )}
        </StyledContent>
      </UICheckbox>
    </StyledCheckbox>
  )
}

export default withTheme(memo(Checkbox))
