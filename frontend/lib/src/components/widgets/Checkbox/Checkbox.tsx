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

import React from "react"

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
  Source,
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

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: boolean
}

class Checkbox extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    value: this.initialValue,
  }

  get initialValue(): boolean {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getBoolValue(this.props.element)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    if (this.props.element.setValue) {
      this.updateFromProtobuf()
    } else {
      this.commitWidgetValue({ fromUi: false })
    }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    const { setValue } = this.props.element
    if (setValue) {
      this.updateFromProtobuf()
    }
  }

  private updateFromProtobuf(): void {
    const { value } = this.props.element
    this.props.element.setValue = false
    this.setState({ value }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    const { widgetMgr, element, fragmentId } = this.props
    widgetMgr.setBoolValue(element, this.state.value, source, fragmentId)
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.checked
    this.setState({ value }, () => this.commitWidgetValue({ fromUi: true }))
  }

  public render(): React.ReactNode {
    const { theme, width, element, disabled, widgetMgr } = this.props
    const { colors, spacing, sizes } = theme
    const lightTheme = hasLightBackgroundColor(theme)

    const color = disabled ? colors.fadedText40 : colors.bodyText

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <StyledCheckbox
        className="stCheckbox"
        data-testid="stCheckbox"
        width={width}
      >
        <UICheckbox
          checked={this.state.value}
          disabled={disabled}
          onChange={this.onChange}
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
}

export default withTheme(Checkbox)
