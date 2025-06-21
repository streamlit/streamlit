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

import React, { ReactElement } from "react"

import { IconSize, ThemeColor } from "~lib/theme"

import {
  StyledMaterialIcon,
  StyledMaterialIconProps,
} from "./styled-components"

interface MaterialIconProps {
  iconName: string
  pack: string
  size?: IconSize
  color?: ThemeColor
  margin?: string
  padding?: string
  testid?: string
}

const getDefaultProps = ({
  size,
  margin,
  padding,
  color,
}: Partial<StyledMaterialIconProps>): StyledMaterialIconProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
  color: color || "inherit",
})

const MaterialFontIcon = ({
  iconName,
  ...props
}: MaterialIconProps): ReactElement => {
  return (
    <StyledMaterialIcon
      {...getDefaultProps(props)}
      data-testid={props.testid || "stIconMaterial"}
      // Prevent the icon text from being translated
      // this would break the icon display in the UI.
      // https://github.com/streamlit/streamlit/issues/10168
      translate="no"
    >
      {iconName}
    </StyledMaterialIcon>
  )
}

export default MaterialFontIcon
