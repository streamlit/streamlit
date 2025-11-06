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

import { FC, PropsWithChildren, useMemo } from "react"

import { BidiComponentContext } from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { StyledThemeCssProvider } from "~lib/components/widgets/BidiComponent/styled-components"
import { objectToCssCustomProperties } from "~lib/components/widgets/BidiComponent/utils/theme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

/**
 * ThemeCssProvider is a component that provides selected Emotion theme properties
 * as CSS custom properties by applying them to a wrapping element.
 * Only properties defined in ComponentsV2Theme are exposed as CSS custom properties.
 */
export const ThemeCssProvider: FC<PropsWithChildren> = ({ children }) => {
  const { theme } = useRequiredContext(BidiComponentContext)

  const cssCustomProperties = useMemo(() => {
    return objectToCssCustomProperties(theme)
  }, [theme])

  return (
    <StyledThemeCssProvider cssCustomProperties={cssCustomProperties}>
      {children}
    </StyledThemeCssProvider>
  )
}
