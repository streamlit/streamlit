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

import React, { ReactElement, useContext } from "react"

import { getLogger } from "loglevel"

import {
  StyledLogo,
  StyledLogoLink,
} from "@streamlit/app/src/components/Sidebar/styled-components"
import { StreamlitEndpoints } from "@streamlit/connection"
import { getCrossOriginAttribute, LibContext } from "@streamlit/lib"
import { Logo } from "@streamlit/protobuf"

const LOG = getLogger("LogoComponent")

export interface LogoComponentProps {
  appLogo: Logo | null
  endpoints: StreamlitEndpoints
  collapsed?: boolean
  componentName?: string
  dataTestId?: string
}

/**
 * Shared component for rendering the app logo that works in both Sidebar and Header contexts.
 */
const LogoComponent = ({
  appLogo,
  endpoints,
  collapsed = false,
  componentName = "Logo",
  dataTestId = "stLogo",
}: LogoComponentProps): ReactElement | null => {
  const { libConfig } = useContext(LibContext)

  if (!appLogo) {
    return null
  }

  const handleLogoError = (logoUrl: string): void => {
    // StyledLogo does not retain the e.currentEvent.src like other onerror cases
    LOG.error(`Client Error: ${componentName} source error - ${logoUrl}`)
    endpoints.sendClientErrorToHost(
      componentName,
      "Logo source failed to load",
      "onerror triggered",
      logoUrl
    )
  }

  // Use icon image when collapsed in sidebar mode, otherwise use the main image
  const displayImage =
    collapsed && appLogo.iconImage ? appLogo.iconImage : appLogo.image

  const source = endpoints.buildMediaURL(displayImage)

  const crossOrigin = getCrossOriginAttribute(
    libConfig.resourceCrossOriginMode,
    displayImage
  )

  const logo = (
    <StyledLogo
      src={source}
      size={appLogo.size}
      alt="Logo"
      className="stLogo"
      data-testid={dataTestId}
      // Save to logo's src to send on load error
      onError={_ => handleLogoError(source)}
      crossOrigin={crossOrigin}
    />
  )

  if (appLogo.link) {
    return (
      <StyledLogoLink
        href={appLogo.link}
        target="_blank"
        rel="noreferrer"
        data-testid="stLogoLink"
      >
        {logo}
      </StyledLogoLink>
    )
  }

  // Wrapping the logo into a div makes it easier to correctly
  // handle the width in all cases. It already gets wrapped via a
  // link element (<a>) above when link is provided.
  // https://github.com/streamlit/streamlit/issues/12326
  return <div>{logo}</div>
}

export default LogoComponent
