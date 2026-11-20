/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { type ReactElement, useCallback, useContext, useMemo } from "react"

import { getLogger } from "loglevel"

import {
  StyledIconLogo,
  StyledLogo,
  StyledLogoButton,
  StyledLogoInnerWrap,
  StyledLogoLink,
} from "@streamlit/app/src/components/Sidebar/styled-components"
import type { StreamlitEndpoints } from "@streamlit/connection"
import {
  DynamicIcon,
  getCrossOriginAttribute,
  type IconSize,
  LibConfigContext,
  NavigationContext,
} from "@streamlit/lib"
import { Logo } from "@streamlit/protobuf"

const LOG = getLogger("LogoComponent")

// Map logo size to DynamicIcon size for consistent scaling. The map is
// `Partial` because unknown sizes have no entry and fall back to "xl".
const LOGO_SIZE_TO_ICON_SIZE: Partial<Record<string, IconSize>> = {
  small: "lg", // 1.25rem
  medium: "xl", // 1.5rem
  large: "twoXL", // 1.8rem
}

interface LogoDisplaySize {
  size: string
  sizePx?: number
}

/**
 * Returns the logo size for the slot being rendered:
 * - Open sidebar: `sizePx`, else `size`.
 * - Header (sidebar closed or absent): `iconSizePx`, else `iconSize`, else
 *   the open-sidebar size.
 * When a pixel size is set, `size` is a "medium" placeholder that the styles
 * ignore.
 */
function resolveLogoDisplaySize(
  appLogo: Logo,
  collapsed: boolean
): LogoDisplaySize {
  const sidebarSize: LogoDisplaySize =
    appLogo.sizePx > 0
      ? { size: "medium", sizePx: appLogo.sizePx }
      : { size: appLogo.size || "medium" }

  if (!collapsed) {
    return sidebarSize
  }

  if (appLogo.iconSizePx > 0) {
    return { size: "medium", sizePx: appLogo.iconSizePx }
  }
  if (appLogo.iconSize) {
    return { size: appLogo.iconSize }
  }
  return sidebarSize
}

interface LogoComponentProps {
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
    () => appPages.find(page => page.isDefault === true),
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
  const displayImageType =
    collapsed && appLogo.iconImage ? appLogo.iconImageType : appLogo.imageType

  const source = endpoints.buildMediaURL(displayImage)

  const crossOrigin = getCrossOriginAttribute(
    resourceCrossOriginMode,
    displayImage
  )

  // Render icon or emoji using DynamicIcon
  const isIconOrEmoji =
    displayImageType === Logo.ImageType.ICON ||
    displayImageType === Logo.ImageType.EMOJI

  const { size, sizePx } = resolveLogoDisplaySize(appLogo, collapsed)
  const iconSize = sizePx ? "inherit" : (LOGO_SIZE_TO_ICON_SIZE[size] ?? "xl")

  // Linked / home-nav wrappers name the control. Unlinked icon/emoji logos are
  // otherwise nameless once Material/emoji glyphs are aria-hidden (#12873).
  const hasExternalLink = Boolean(appLogo.link)
  const isHomeNavButton =
    !hasExternalLink && isMultiPageApp && Boolean(homePage) && !isOnHomePage
  const nameUnlinkedIconLogo =
    isIconOrEmoji && !hasExternalLink && !isHomeNavButton

  const logo = isIconOrEmoji ? (
    <StyledIconLogo
      size={size}
      sizePx={sizePx}
      className="stLogo"
      data-testid={dataTestId}
      role={nameUnlinkedIconLogo ? "img" : undefined}
      aria-label={nameUnlinkedIconLogo ? "App Logo" : undefined}
    >
      <DynamicIcon iconValue={displayImage} size={iconSize} />
    </StyledIconLogo>
  ) : (
    <StyledLogo
      src={source}
      size={size}
      sizePx={sizePx}
      alt="Logo"
      className="stLogo"
      data-testid={dataTestId}
      // Save to logo's src to send on load error
      onError={_ => handleLogoError(source)}
      crossOrigin={crossOrigin}
    />
  )

  // If an explicit link is provided, use it (opens in new tab)
  if (hasExternalLink) {
    return (
      <StyledLogoLink
        href={appLogo.link}
        target="_blank"
        rel="noreferrer"
        data-testid="stLogoLink"
        // Icon/emoji logos don't have alt text, so we need an aria-label for accessibility
        aria-label={isIconOrEmoji ? "App Logo" : undefined}
      >
        {logo}
      </StyledLogoLink>
    )
  }

  // In multi-page apps without an explicit link, clicking the logo navigates to home page
  // Only use the clickable button when not already on the home page
  if (isHomeNavButton) {
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
  return <StyledLogoInnerWrap>{logo}</StyledLogoInnerWrap>
}

export default LogoComponent
