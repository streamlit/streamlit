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

import { useTheme } from "@emotion/react"

import { EmotionTheme } from "@streamlit/lib/src/theme"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

export interface DynamicButtonLabelProps {
  icon: string
  label: string
}

export const DynamicButtonLabel = ({
  icon,
  label,
}: DynamicButtonLabelProps): React.ReactElement | null => {
  const { colors }: EmotionTheme = useTheme()

  // Material icons need to be larger to render similar size of emojis, emojis need addtl margin
  const isMaterialIcon = icon.startsWith(":material")
  const iconMargin = isMaterialIcon ? "0 sm 0 0" : "0 md 0 0"

  return (
    <>
      {icon && (
        <DynamicIcon
          size={isMaterialIcon ? "lg" : "base"}
          margin={label ? iconMargin : "0"}
          color={"inherit"}
          iconValue={icon}
        />
      )}
      {label && (
        <StreamlitMarkdown
          source={label}
          allowHTML={false}
          isLabel
          largerLabel
          disableLinks
        />
      )}
    </>
  )
}
