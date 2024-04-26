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

import snakeCase from "lodash/snakeCase"

import { IconSize, ThemeColor } from "@streamlit/lib/src/theme"
import {
  StyledMaterialIcon,
  StyledMaterialIconProps,
} from "./styled-components"

const ICON_PACK_MAPPING: Record<string, string> = {
  material: "material-symbols-outlined",
}

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
  pack,
  ...props
}: MaterialIconProps): ReactElement => {
  return (
    // This is a recommended way to render material icons from the font
    // Please see `Inserting the icon` section here:
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Asettings_applications%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4024
    <StyledMaterialIcon
      className={ICON_PACK_MAPPING[pack]}
      {...getDefaultProps(props)}
    >
      {snakeCase(iconName)}
    </StyledMaterialIcon>
  )
}

export default MaterialFontIcon
