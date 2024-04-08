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

import React, { Suspense } from "react"

import { IconSize, ThemeColor } from "@streamlit/lib/src/theme"
import { EmojiIcon } from "./Icon"
import { camelCase, startCase } from "lodash"
import DynamicIconErrorBoundary from "./DynamicIconErrorBoundary"

const MaterialFilled = React.lazy(
  () =>
    import("@streamlit/lib/src/components/shared/Icon/Material/MaterialFilled")
)

const MaterialOutlined = React.lazy(
  () =>
    import(
      "@streamlit/lib/src/components/shared/Icon/Material/MaterialOutlined"
    )
)

const MaterialRounded = React.lazy(
  () =>
    import(
      "@streamlit/lib/src/components/shared/Icon/Material/MaterialRounded"
    )
)

interface IconPackEntry {
  pack: string
  icon: string
}

function parseIconPackEntry(iconName: string): IconPackEntry {
  // This is a regex to match icon pack and icon name from the strings of format
  // :pack:icon: like :material:SettingsSuggest:
  const iconRegexp = /^:(.*):(.*):$/
  const matchResult = iconName.match(iconRegexp)
  if (matchResult === null) {
    return { pack: "emoji", icon: iconName }
  }

  // Convert the icon name to CamelCase
  matchResult[2] = startCase(camelCase(matchResult[2])).replace(/ /g, "")
  matchResult[2] = matchResult[2].replace("3X3", "3x3")
  matchResult[2] = matchResult[2].replace("4X4", "4x4")
  return { pack: matchResult[1], icon: matchResult[2] }
}

// TODO(kajarenc): Think about writing this type with omit / type combinators
// based on IconProps and EmojiIconProps
interface DynamicIconProps {
  iconValue: string
  size?: IconSize
  margin?: string
  padding?: string
  testid?: string
  color?: ThemeColor
}

const DynamicIconDispatcher = ({
  iconValue,
  ...props
}: DynamicIconProps): React.ReactElement => {
  const { pack, icon } = parseIconPackEntry(iconValue)
  switch (pack) {
    case "material":
      return <MaterialFilled iconName={icon} {...props} />
    case "material-outlined":
      return <MaterialOutlined iconName={icon} {...props} />
    case "material-rounded":
      return <MaterialRounded iconName={icon} {...props} />
    case "emoji":
    default:
      return <EmojiIcon {...props}>{icon}</EmojiIcon>
  }
}

export const DynamicIcon = (props: DynamicIconProps): React.ReactElement => (
  <Suspense fallback={<EmojiIcon {...props}>&nbsp;</EmojiIcon>}>
    <DynamicIconErrorBoundary {...props}>
      <DynamicIconDispatcher {...props} />
    </DynamicIconErrorBoundary>
  </Suspense>
)
