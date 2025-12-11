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

import React, { ReactElement, useCallback, useContext, useMemo } from "react"

import { getLogger } from "loglevel"

import {
  StyledLogo,
  StyledLogoButton,
  StyledLogoLink,
} from "@streamlit/app/src/components/Sidebar/styled-components"
import { StreamlitEndpoints } from "@streamlit/connection"
import {
  getCrossOriginAttribute,
  LibConfigContext,
  NavigationContext,
} from "@streamlit/lib"
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
  const { resourceCrossOriginMode } = useContext(LibConfigContext)
  const { appPages, onPageChange, currentPageScriptHash } =
    useContext(NavigationContext)

  // Find the home page (the default page) and check if this is a multi-page app
  const homePage = useMemo(
    () => appPages.find(page => page.isDefault),
    [appPages]
  )
  const isMultiPageApp = appPages.length > 1
  const isOnHomePage = homePage?.pageScriptHash === currentPageScriptHash

  const handleLogoClick = useCallback(() => {
    // Only navigate if we're not already on the home page
    if (homePage?.pageScriptHash && !isOnHomePage) {
      onPageChange(homePage.pageScriptHash)
    }
  }, [homePage, onPageChange, isOnHomePage])

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
    resourceCrossOriginMode,
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

  // If an explicit link is provided, use it (opens in new tab)
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

  // In multi-page apps without an explicit link, clicking the logo navigates to home page
  // Only use the clickable button when not already on the home page
  if (isMultiPageApp && homePage && !isOnHomePage) {
    return (
      <StyledLogoButton
        onClick={handleLogoClick}
        data-testid="stLogoLink"
        aria-label="Navigate to home page"
      >
        {logo}
      </StyledLogoButton>
    )
  }

  // Wrapping the logo into a div makes it easier to correctly
  // handle the width in all cases. It already gets wrapped via a
  // link element (<a>) above when link is provided.
  // https://github.com/streamlit/streamlit/issues/12326
  return <div>{logo}</div>
}

export default LogoComponent
