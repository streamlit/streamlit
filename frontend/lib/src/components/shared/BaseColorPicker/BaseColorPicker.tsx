/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo, useCallback, useEffect, useState } from "react"

import { StatefulPopover as UIPopover } from "baseui/popover"
import { ChromePicker, ColorResult } from "react-color"
import SaturationComponent from "react-color/es/components/common/Saturation"

import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelpInline,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { LabelVisibilityOptions } from "~lib/util/utils"

import {
  StyledChromePicker,
  StyledColorBlock,
  StyledColorPicker,
  StyledColorPreview,
  StyledColorValue,
} from "./styled-components"

/* When closing the color picker popover, react-color triggers a security error
 * if the app is in an iframe with a different origin. That security error shows up as
 * an exception within the app and stops the app from working. This isn't a problem on
 * Community Cloud anymore (because it uses same origin) but it can be in an
 * embedded app or in Notebooks. We're applying this fix here to prevent that:
 * https://github.com/uiwjs/react-color/issues/81#issuecomment-2208219820
 */
SaturationComponent.prototype.getContainerRenderWindow = function () {
  const container = this.container
  let renderWindow: Window & typeof globalThis = window
  let lastRenderWindow: Window & typeof globalThis = window

  try {
    while (
      !renderWindow.document.contains(container) &&
      renderWindow.parent !== renderWindow
    ) {
      lastRenderWindow = renderWindow
      renderWindow = renderWindow.parent as Window & typeof globalThis
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    renderWindow = lastRenderWindow
  }
  return renderWindow
}

export interface BaseColorPickerProps {
  disabled: boolean
  width?: number
  value: string
  showValue?: boolean
  label: string
  labelVisibility?: LabelVisibilityOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  onChange: (value: string) => any
  help?: string
}

const BaseColorPicker = (props: BaseColorPickerProps): React.ReactElement => {
  const {
    disabled,
    value: propValue,
    showValue,
    label,
    labelVisibility,
    onChange,
    help,
  } = props
  const [value, setValue] = useState(propValue)
  const theme = useEmotionTheme()

  // Reset the value when the prop value changes
  useEffect(() => {
    setValue(propValue)
  }, [propValue])

  // Note: This is a "local" onChange handler used to update the color preview
  // (allowing the user to click and drag). this.props.onChange is only called
  // when the ColorPicker popover is closed.
  const onColorChange = useCallback((color: ColorResult): void => {
    setValue(color.hex)
  }, [])

  const onColorClose = useCallback((): void => {
    onChange(value)
  }, [onChange, value])

  const customChromePickerStyles = {
    default: {
      picker: {
        borderRadius: theme.radii.default,
        // Remove the box shadow from the color picker component since we're already
        // applying a shadow to the popover that contains the color picker.
        boxShadow: "none",
        backgroundColor: theme.colors.bgColor,
      },
      saturation: {
        borderRadius: `${theme.radii.default} ${theme.radii.default} 0 0`,
        // Prevent text selection while the mouse is clicked to select a color. This
        // can be annoying if you select a color and then move the mouse outside the
        // color picker.
        // We need the `as const` here to prevent a typing error (even though it
        // also works correctly without it).
        userSelect: "none" as const,
      },
      body: {
        padding: theme.spacing.xl,
      },
    },
  }

  return (
    <StyledColorPicker
      className="stColorPicker"
      data-testid="stColorPicker"
      disabled={disabled}
    >
      <WidgetLabel
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibility}
      >
        {help && (
          <StyledWidgetLabelHelpInline>
            <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
          </StyledWidgetLabelHelpInline>
        )}
      </WidgetLabel>
      <UIPopover
        onClose={onColorClose}
        placement="bottomLeft"
        content={() => (
          <StyledChromePicker data-testid="stColorPickerPopover">
            <ChromePicker
              color={value}
              onChange={onColorChange}
              disableAlpha={true}
              styles={customChromePickerStyles}
            />
          </StyledChromePicker>
        )}
      >
        <StyledColorPreview disabled={disabled}>
          <StyledColorBlock
            data-testid="stColorPickerBlock"
            backgroundColor={value}
            disabled={disabled}
          />
          {showValue && (
            <StyledColorValue>{value.toUpperCase()}</StyledColorValue>
          )}
        </StyledColorPreview>
      </UIPopover>
    </StyledColorPicker>
  )
}

export default memo(BaseColorPicker)
