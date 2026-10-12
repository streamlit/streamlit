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

import {
  type CSSProperties,
  memo,
  type ReactElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { getLogger } from "loglevel"

import type {
  ImageList as ImageListProto,
  Image as ImageProto,
  streamlit,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar from "~lib/components/shared/Toolbar/Toolbar"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import type { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { plainTextWithBlockGaps } from "~lib/util/plainText"
import { isDangerousLinkUri } from "~lib/util/UriUtil"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  StyledCaption,
  StyledImageContainer,
  StyledImageLink,
  StyledImageList,
} from "./styled-components"

const LOG = getLogger("ImageList")

export interface ImageListProps {
  endpoints: StreamlitEndpoints
  element: ImageListProto
  widthConfig?: streamlit.WidthConfig.$Properties | null
  disableFullscreenMode?: boolean
}

/**
 * Get the image width based on widthConfig.
 *
 * @param widthConfig - The width configuration from the element
 * @param containerWidth - The width of the container element
 * @returns The width to use for images, or undefined for original size
 */
function getImageWidth(
  widthConfig: streamlit.WidthConfig.$Properties | null | undefined,
  containerWidth: number
): number | undefined {
  if (widthConfig) {
    if (widthConfig.useStretch) {
      return containerWidth
    }

    if (widthConfig.useContent) {
      // Use original image size (content width)
      return undefined
    }

    if (widthConfig.pixelWidth) {
      return widthConfig.pixelWidth
    }
  }

  // Default fallback: use original image size
  return undefined
}

const Image = ({
  image,
  imgStyle,
  buildMediaURL,
  handleImageError,
  shouldStretch,
  link,
  onCaptionPlainTextChange,
}: {
  image: ImageProto
  imgStyle: CSSProperties
  buildMediaURL: (url: string) => string
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
  shouldStretch?: boolean
  link?: string
  /** Reports rendered caption plain text (not markdown source) for toolbar naming. */
  onCaptionPlainTextChange?: (text: string | undefined) => void
}): ReactElement => {
  const crossOrigin = useCrossOriginAttribute(image.url)
  const captionDomId = useId()
  const captionRef = useRef<HTMLDivElement>(null)
  // Name the link from the caption only when the caption actually renders
  // text. Label Markdown strips some constructs (a lone `---` becomes
  // nothing), which would otherwise point aria-labelledby at an empty node.
  const [captionHasText, setCaptionHasText] = useState(false)
  // Do not wrap a dangerous URI in an anchor. A neutralized href="#" is
  // still a nameless focusable control (WCAG SC 4.1.2).
  const safeLink = link && !isDangerousLinkUri(link) ? link : undefined
  // Unset means omit alt (detectable missing name). Empty string is decorative.
  const imgAlt: string | undefined = isNullOrUndefined(image.alt)
    ? undefined
    : image.alt
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank alt uses the link
  const linkAccessibleName = imgAlt || safeLink

  // Watch the caption for text that arrives late: async Markdown plugins
  // (KaTeX, emoji) swap a loading skeleton for real content after the first
  // render. Linked images use captionHasText; the parent additionally asks
  // for the rendered plain text when this is the only image and it has no
  // alt. Skip the observer when neither consumer is active (for example,
  // unlinked gallery members).
  useLayoutEffect(() => {
    const node = captionRef.current
    if ((!safeLink && !onCaptionPlainTextChange) || !image.caption || !node) {
      setCaptionHasText(false)
      onCaptionPlainTextChange?.(undefined)
      return
    }

    const syncCaptionPlainText = (): void => {
      const text = plainTextWithBlockGaps(node)
      setCaptionHasText(text.length > 0)
      onCaptionPlainTextChange?.(text || undefined)
    }

    syncCaptionPlainText()

    const observer = new MutationObserver(syncCaptionPlainText)
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => observer.disconnect()
  }, [image.caption, onCaptionPlainTextChange, safeLink])

  const imageElement = (
    // oxlint-disable-next-line jsx-a11y/alt-text
    <img
      style={imgStyle}
      src={buildMediaURL(image.url)}
      alt={imgAlt}
      onError={handleImageError}
      crossOrigin={crossOrigin}
    />
  )

  return (
    <StyledImageContainer
      data-testid="stImageContainer"
      shouldStretch={shouldStretch}
    >
      {safeLink ? (
        <StyledImageLink
          href={safeLink}
          target="_blank"
          rel="noreferrer"
          // Name the link from the visible caption, then alt, then the URL.
          // Label by the caption node so markdown is announced as plain text.
          {...(captionHasText
            ? { "aria-labelledby": captionDomId }
            : { "aria-label": linkAccessibleName })}
          data-testid="stImageLink"
        >
          {imageElement}
        </StyledImageLink>
      ) : (
        imageElement
      )}
      {image.caption && (
        <StyledCaption
          ref={captionRef}
          id={captionDomId}
          data-testid="stImageCaption"
          style={imgStyle}
        >
          <StreamlitMarkdown
            source={image.caption}
            allowHTML={false}
            isCaption
            // This is technically not a label but we want the same restrictions
            // as for labels (e.g. no Markdown tables or horizontal rule).
            isLabel
          />
        </StyledCaption>
      )}
    </StyledImageContainer>
  )
}

/**
 * Functional element for a horizontal list of images.
 */
function ImageList({
  element,
  endpoints,
  widthConfig,
  disableFullscreenMode,
}: Readonly<ImageListProps>): ReactElement {
  const {
    expanded: isFullScreen,
    width,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  // The width of the container element, not necessarily the image.
  const containerWidth = width ?? 0

  const imageWidth = getImageWidth(widthConfig, containerWidth)

  const shouldStretch = widthConfig?.useStretch ?? false

  const imgStyle: CSSProperties = {}

  if (fullScreenHeight && isFullScreen) {
    imgStyle.maxHeight = fullScreenHeight
    imgStyle.objectFit = "contain"
    // @see issue https://github.com/streamlit/streamlit/issues/10904
    // Ensure the image tries to fill the width to prevent sizeless SVGs from
    // not rendering. Let object-fit handle aspect ratio.
    imgStyle.width = "100%"
  } else {
    // @see issue https://github.com/streamlit/streamlit/issues/10904
    // Use imageWidth if defined, otherwise fallback to 100% to prevent sizeless
    // SVGs from not rendering.
    imgStyle.width = imageWidth ?? "100%"
    // Cap the image width, so it doesn't exceed its parent container width
    imgStyle.maxWidth = "100%"
  }

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement>
  ): void => {
    const imageUrl = e.currentTarget.src
    LOG.error(`Client Error: Image source error - ${imageUrl}`)
    endpoints.sendClientErrorToHost(
      "Image",
      "Image source failed to load",
      "onerror triggered",
      imageUrl
    )
  }

  // Rendered caption plain text for the single-image toolbar fallback.
  const [captionPlainText, setCaptionPlainText] = useState<
    string | undefined
  >()

  // The gallery has one list-level Fullscreen button, so borrow a name only
  // when there is exactly one image; otherwise the button would be named after
  // an arbitrary member. Prefer alt, else the caption's rendered plain text.
  // Gated on singleImage so a 1→N rerun cannot leak a stale caption.
  const singleImage = element.imgs.length === 1 ? element.imgs[0] : undefined
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank alt is absent
  const altContext = singleImage?.alt?.trim() || undefined
  const labelContext =
    altContext ?? (singleImage ? captionPlainText : undefined)
  const reportCaptionPlainText =
    singleImage && !altContext ? setCaptionPlainText : undefined

  return (
    <StyledToolbarElementContainer
      width={containerWidth}
      height={fullScreenHeight}
      useContainerWidth={isFullScreen}
      topCentered
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
        labelContext={labelContext}
      ></Toolbar>
      <StyledImageList
        className="stImage"
        data-testid="stImage"
        shouldStretch={shouldStretch}
      >
        {element.imgs.map((iimage, idx): ReactElement => (
          <Image
            // TODO: Update to match React best practices
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={idx}
            image={iimage as ImageProto}
            imgStyle={imgStyle}
            buildMediaURL={(url: string) => endpoints.buildMediaURL(url)}
            handleImageError={handleImageError}
            shouldStretch={shouldStretch}
            link={element.imgs.length === 1 ? element.link : undefined}
            onCaptionPlainTextChange={
              idx === 0 ? reportCaptionPlainText : undefined
            }
          />
        ))}
      </StyledImageList>
    </StyledToolbarElementContainer>
  )
}

const ImageListWithFullScreen = withFullScreenWrapper(ImageList)
export default memo(ImageListWithFullScreen)
