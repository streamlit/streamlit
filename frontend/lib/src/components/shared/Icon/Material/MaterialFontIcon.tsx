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

import styled from "@emotion/styled"
import snakeCase from "lodash/snakeCase"

import {
  IconSize,
  ThemeColor,
  computeSpacingStyle,
} from "@streamlit/lib/src/theme"
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
}: Partial<StyledMaterialIconProps>): StyledMaterialIconProps => ({
  size: size || "md",
  margin: margin || "",
  padding: padding || "",
})

const MaterialFontIcon = ({
  iconName,
  pack,
  ...props
}: MaterialIconProps): ReactElement => {
  return (
    <StyledMaterialIcon
      className={ICON_PACK_MAPPING[pack]}
      {...getDefaultProps(props)}
    >
      {snakeCase(iconName)}
    </StyledMaterialIcon>
  )
}

export default MaterialFontIcon
