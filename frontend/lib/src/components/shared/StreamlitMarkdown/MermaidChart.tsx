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
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import styled from "@emotion/styled"
import {
  Check,
  ContentCopy,
  FileDownload,
} from "@emotion-icons/material-outlined"
import { getLuminance } from "color2k"
import dompurify from "dompurify"
import { getLogger } from "loglevel"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { Skeleton } from "~lib/components/elements/Skeleton/Skeleton"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary/ErrorBoundary"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { getThemeBackgroundColors } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"
import { blend, convertRemToPx } from "~lib/theme/utils"

const LOG = getLogger("MermaidChart")

// Module-level tracking for mermaid initialization
// Stores the theme mode (light/dark) that was used for initialization
let initializedThemeMode: boolean | null = null

/**
 * DOMPurify options for sanitizing Mermaid SVG output.
 * This provides defense-in-depth by sanitizing the SVG even though
 * Mermaid uses DOMPurify internally.
 *
 * Configuration allows SVG elements and common SVG/MathML attributes
 * needed for diagram rendering while blocking potentially dangerous content.
 * HTML profile is needed because Mermaid uses <foreignObject> with HTML
 * content (divs, spans) for text labels in flowcharts.
 */
const SANITIZE_SVG_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  // Allow xlink:href for SVG links (used in some diagram types)
  ADD_ATTR: ["xlink:href"],
}

const StyledMermaidContainer = styled.div<{
  hasError: boolean
  isFullScreen: boolean
}>(({ theme, hasError, isFullScreen }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: hasError ? "flex-start" : "center",
  justifyContent: isFullScreen ? "center" : "flex-start",
  minHeight: "2rem",
  padding: theme.spacing.sm,
  height: isFullScreen ? "100%" : "auto",
  width: "100%",
  // Make SVG fill the container width while maintaining aspect ratio
  "& svg": {
    width: "100%",
    maxWidth: "100%",
    height: "auto",
    ...(isFullScreen && {
      maxHeight: "100%",
    }),
  },
}))

const StyledErrorMessage = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
  backgroundColor: theme.colors.redBackgroundColor,
  padding: theme.spacing.sm,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.sm,
  fontFamily: theme.genericFonts.codeFont,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  width: "100%",
}))

interface MermaidChartProps {
  /**
   * The mermaid diagram source code
   */
  source: string
}

/**
 * Generates mermaid theme configuration based on the Streamlit theme.
 */
function getMermaidThemeConfig(theme: EmotionTheme): Record<string, unknown> {
  const markdownBgColors = getThemeBackgroundColors(theme)
  const isLightTheme = getLuminance(theme.colors.bgColor) > 0.5

  return {
    darkMode: !isLightTheme,
    theme: "base",
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: convertRemToPx(theme.fontSizes.md),
    themeVariables: {
      darkMode: !isLightTheme,
      primaryColor: blend(markdownBgColors.bluebg, theme.colors.bgColor),
      primaryTextColor: theme.colors.bodyText,
      primaryBorderColor: theme.colors.borderColor,
      secondaryColor: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      tertiaryColor: blend(markdownBgColors.orangebg, theme.colors.bgColor),
      background: theme.colors.bgColor,
      mainBkg: theme.colors.secondaryBg,
      fontFamily: theme.genericFonts.bodyFont,
      fontSize: `${convertRemToPx(theme.fontSizes.md)}px`,
      lineColor: theme.colors.fadedText60,
      textColor: theme.colors.bodyText,
      errorBkgColor: blend(markdownBgColors.redbg, theme.colors.bgColor),
      errorTextColor: theme.colors.redTextColor,
      // Flowchart
      nodeBorder: theme.colors.borderColor,
      clusterBkg: theme.colors.secondaryBg,
      clusterBorder: theme.colors.borderColor,
      defaultLinkColor: theme.colors.fadedText60,
      titleColor: theme.colors.bodyText,
      edgeLabelBackground: theme.colors.bgColor,
      // Sequence diagram
      actorBorder: theme.colors.borderColor,
      actorBkg: theme.colors.secondaryBg,
      actorTextColor: theme.colors.bodyText,
      actorLineColor: theme.colors.fadedText60,
      signalColor: theme.colors.bodyText,
      signalTextColor: theme.colors.bodyText,
      labelBoxBkgColor: theme.colors.secondaryBg,
      labelBoxBorderColor: theme.colors.borderColor,
      labelTextColor: theme.colors.bodyText,
      loopTextColor: theme.colors.bodyText,
      noteBorderColor: theme.colors.borderColor,
      noteBkgColor: blend(markdownBgColors.yellowbg, theme.colors.bgColor),
      noteTextColor: theme.colors.bodyText,
      activationBorderColor: theme.colors.borderColor,
      activationBkgColor: theme.colors.secondaryBg,
      sequenceNumberColor: theme.colors.bgColor,
      // Class diagram
      classText: theme.colors.bodyText,
      // State diagram
      labelColor: theme.colors.bodyText,
      // Gantt
      sectionBkgColor: theme.colors.secondaryBg,
      altSectionBkgColor: theme.colors.bgColor,
      sectionBkgColor2: theme.colors.secondaryBg,
      gridColor: theme.colors.borderColor,
      doneTaskBkgColor: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      doneTaskBorderColor: theme.colors.greenTextColor,
      critBorderColor: theme.colors.redTextColor,
      critBkgColor: blend(markdownBgColors.redbg, theme.colors.bgColor),
      todayLineColor: theme.colors.primary,
      taskTextColor: theme.colors.bodyText,
      taskTextOutsideColor: theme.colors.bodyText,
      taskTextLightColor: theme.colors.bodyText,
      taskTextDarkColor: theme.colors.bodyText,
      // Pie chart
      pieStrokeColor: theme.colors.borderColor,
      pieOuterStrokeColor: theme.colors.borderColor,
      pieSectionTextColor: theme.colors.bodyText,
      pieLegendTextColor: theme.colors.bodyText,
      pieTitleTextColor: theme.colors.bodyText,
      pie1: blend(markdownBgColors.bluebg, theme.colors.bgColor),
      pie2: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      pie3: blend(markdownBgColors.orangebg, theme.colors.bgColor),
      pie4: blend(markdownBgColors.redbg, theme.colors.bgColor),
      pie5: blend(markdownBgColors.violetbg, theme.colors.bgColor),
      pie6: blend(markdownBgColors.yellowbg, theme.colors.bgColor),
      pie7: blend(markdownBgColors.graybg, theme.colors.bgColor),
      // ER diagram
      attributeBackgroundColorOdd: theme.colors.secondaryBg,
      attributeBackgroundColorEven: theme.colors.bgColor,
      // Requirement diagram
      requirementBackground: theme.colors.secondaryBg,
      requirementBorderColor: theme.colors.borderColor,
      requirementTextColor: theme.colors.bodyText,
      relationColor: theme.colors.fadedText60,
      relationLabelBackground: theme.colors.bgColor,
      relationLabelColor: theme.colors.bodyText,
      // Git graph
      git0: theme.colors.blueTextColor,
      git1: theme.colors.greenTextColor,
      git2: theme.colors.orangeTextColor,
      git3: theme.colors.redTextColor,
      git4: theme.colors.violetTextColor,
      git5: theme.colors.yellowTextColor,
      git6: theme.colors.grayTextColor,
      git7: theme.colors.primary,
      gitBranchLabel0: theme.colors.bgColor,
      gitBranchLabel1: theme.colors.bgColor,
      gitBranchLabel2: theme.colors.bgColor,
      gitBranchLabel3: theme.colors.bgColor,
      gitBranchLabel4: theme.colors.bgColor,
      gitBranchLabel5: theme.colors.bgColor,
      gitBranchLabel6: theme.colors.bgColor,
      gitBranchLabel7: theme.colors.bgColor,
      gitInv0: theme.colors.bgColor,
      gitInv1: theme.colors.bgColor,
      gitInv2: theme.colors.bgColor,
      gitInv3: theme.colors.bgColor,
      gitInv4: theme.colors.bgColor,
      gitInv5: theme.colors.bgColor,
      gitInv6: theme.colors.bgColor,
      gitInv7: theme.colors.bgColor,
      commitLabelColor: theme.colors.bodyText,
      commitLabelBackground: theme.colors.secondaryBg,
      // Mindmap
      mindmap1: blend(markdownBgColors.bluebg, theme.colors.bgColor),
      mindmap2: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      mindmap3: blend(markdownBgColors.orangebg, theme.colors.bgColor),
      mindmap4: blend(markdownBgColors.redbg, theme.colors.bgColor),
      mindmap5: blend(markdownBgColors.violetbg, theme.colors.bgColor),
      // Timeline
      cScale0: blend(markdownBgColors.bluebg, theme.colors.bgColor),
      cScale1: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      cScale2: blend(markdownBgColors.orangebg, theme.colors.bgColor),
      cScale3: blend(markdownBgColors.redbg, theme.colors.bgColor),
      cScale4: blend(markdownBgColors.violetbg, theme.colors.bgColor),
      cScale5: blend(markdownBgColors.yellowbg, theme.colors.bgColor),
      cScale6: blend(markdownBgColors.graybg, theme.colors.bgColor),
      cScaleLabel0: theme.colors.bodyText,
      cScaleLabel1: theme.colors.bodyText,
      cScaleLabel2: theme.colors.bodyText,
      cScaleLabel3: theme.colors.bodyText,
      cScaleLabel4: theme.colors.bodyText,
      cScaleLabel5: theme.colors.bodyText,
      cScaleLabel6: theme.colors.bodyText,
      // Quadrant
      quadrant1Fill: blend(markdownBgColors.bluebg, theme.colors.bgColor),
      quadrant2Fill: blend(markdownBgColors.greenbg, theme.colors.bgColor),
      quadrant3Fill: blend(markdownBgColors.orangebg, theme.colors.bgColor),
      quadrant4Fill: blend(markdownBgColors.redbg, theme.colors.bgColor),
      quadrant1TextFill: theme.colors.bodyText,
      quadrant2TextFill: theme.colors.bodyText,
      quadrant3TextFill: theme.colors.bodyText,
      quadrant4TextFill: theme.colors.bodyText,
      quadrantPointFill: theme.colors.primary,
      quadrantPointTextFill: theme.colors.bodyText,
      quadrantXAxisTextFill: theme.colors.bodyText,
      quadrantYAxisTextFill: theme.colors.bodyText,
      quadrantTitleFill: theme.colors.bodyText,
      quadrantInternalBorderStrokeFill: theme.colors.borderColor,
      quadrantExternalBorderStrokeFill: theme.colors.borderColor,
    },
  }
}

/**
 * A component that renders Mermaid diagrams.
 * Lazy loads the mermaid library and renders diagrams client-side.
 */
const MermaidChart = memo(function MermaidChart({
  source,
}: Readonly<MermaidChartProps>) {
  const theme = useEmotionTheme()
  const uniqueId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Store bindFunctions to call after SVG is inserted into DOM
  const bindFunctionsRef = useRef<((element: Element) => void) | null>(null)

  const {
    expanded: isFullScreen,
    width: containerWidth,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  const { copyToClipboard, isCopied, label: copyLabel } = useCopyToClipboard()

  useEffect(() => {
    let isCancelled = false

    const renderMermaid = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        // Lazy load mermaid
        const mermaidModule = await import("mermaid")
        const mermaid = mermaidModule.default

        if (isCancelled) return

        // Configure mermaid with theme-aware settings
        const themeConfig = getMermaidThemeConfig(theme)
        const isLightTheme = getLuminance(theme.colors.bgColor) > 0.5

        // Only re-initialize if theme mode changed (light <-> dark)
        if (initializedThemeMode !== isLightTheme) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            ...themeConfig,
          })
          initializedThemeMode = isLightTheme
        }

        // Generate a unique ID for this render
        // Remove colons from the id since mermaid uses it as a CSS selector
        const diagramId = `mermaid-${uniqueId.replace(/:/g, "")}`

        // Render the diagram
        const { svg, bindFunctions } = await mermaid.render(diagramId, source)

        if (!isCancelled) {
          // Store bindFunctions to be called after DOM update
          bindFunctionsRef.current = bindFunctions || null
          setSvgContent(svg)
          setIsLoading(false)
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to render diagram"
          setError(errorMessage)
          setIsLoading(false)
        }
      }
    }

    void renderMermaid()

    return () => {
      isCancelled = true
    }
  }, [source, theme, uniqueId])

  // Call bindFunctions after SVG content is inserted into the DOM
  // This enables interactive features like click handlers in diagrams
  useEffect(() => {
    if (containerRef.current && bindFunctionsRef.current) {
      bindFunctionsRef.current(containerRef.current)
      bindFunctionsRef.current = null
    }
  }, [svgContent])

  // Sanitize SVG content for defense-in-depth
  // Mermaid uses DOMPurify internally, but we sanitize again to ensure safety
  // even if Mermaid's behavior changes or is misconfigured
  const sanitizedSvgContent = useMemo(() => {
    if (!svgContent) {
      return ""
    }

    const sanitized = dompurify.sanitize(svgContent, SANITIZE_SVG_OPTIONS)

    // Mermaid sets explicit width/height attributes on the SVG that prevent
    // CSS-based responsive sizing. Parse the SVG and remove these attributes
    // to allow the SVG to scale with CSS while preserving the viewBox.
    const parser = new DOMParser()
    const doc = parser.parseFromString(sanitized, "image/svg+xml")
    const svg = doc.querySelector("svg")

    if (svg) {
      // Get dimensions before removing (needed for fallback viewBox)
      const width = svg.getAttribute("width") || "100"
      const height = svg.getAttribute("height") || "100"

      // Ensure viewBox exists for proper scaling (most Mermaid SVGs have it)
      if (!svg.hasAttribute("viewBox")) {
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
      }

      // Remove explicit dimensions to allow CSS to control sizing
      svg.removeAttribute("width")
      svg.removeAttribute("height")
      // Add preserveAspectRatio for consistent scaling
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet")

      return new XMLSerializer().serializeToString(svg)
    }

    return sanitized
  }, [svgContent])

  /**
   * Copy the mermaid source code to clipboard.
   */
  const handleCopySource = useCallback((): void => {
    copyToClipboard(source)
  }, [copyToClipboard, source])

  /**
   * Download the rendered diagram as a PNG image.
   */
  const handleDownloadPng = useCallback((): void => {
    if (!containerRef.current) {
      return
    }

    const svgElement = containerRef.current.querySelector("svg")
    if (!svgElement) {
      return
    }

    // Clone the SVG to avoid modifying the displayed one
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

    // Get the SVG dimensions
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required for PNG export dimensions
    const svgRect = svgElement.getBoundingClientRect()
    const width = svgRect.width
    const height = svgRect.height

    // Set explicit dimensions on the cloned SVG
    clonedSvg.setAttribute("width", String(width))
    clonedSvg.setAttribute("height", String(height))

    // Serialize the SVG
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(clonedSvg)
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    })
    const svgUrl = URL.createObjectURL(svgBlob)

    // Create an image and draw it to canvas
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Use 2x scale for better quality
      const scale = 2
      canvas.width = width * scale
      canvas.height = height * scale

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(svgUrl)
        return
      }

      // Fill with white background
      ctx.fillStyle = theme.colors.bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Scale and draw the image
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)

      // Download the PNG
      const pngUrl = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = "mermaid-diagram.png"
      link.href = pngUrl
      link.click()

      URL.revokeObjectURL(svgUrl)
    }
    img.onerror = () => {
      LOG.error("Failed to load SVG for PNG export")
      URL.revokeObjectURL(svgUrl)
    }
    img.src = svgUrl
  }, [theme.colors.bgColor])

  if (isLoading) {
    return (
      <StyledToolbarElementContainer
        width={containerWidth}
        height={fullScreenHeight}
        useContainerWidth={true}
      >
        <StyledMermaidContainer
          hasError={false}
          isFullScreen={false}
          data-testid="stMermaidChart"
          aria-busy="true"
          aria-label="Loading mermaid diagram"
        >
          <Skeleton
            element={SkeletonProto.create({
              style: SkeletonProto.SkeletonStyle.ELEMENT,
            })}
          />
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    )
  }

  if (error) {
    return (
      <StyledToolbarElementContainer
        width={containerWidth}
        height={fullScreenHeight}
        useContainerWidth={true}
      >
        <StyledMermaidContainer
          hasError={true}
          isFullScreen={false}
          data-testid="stMermaidChart"
        >
          <StyledErrorMessage data-testid="stMermaidError" role="alert">
            Mermaid diagram error: {error}
          </StyledErrorMessage>
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    )
  }

  // Mermaid generates SVG content that must be injected as HTML.
  // The content is sanitized twice for defense-in-depth: once by Mermaid internally,
  // and again by DOMPurify in this component.
  return (
    <ErrorBoundary>
      <StyledToolbarElementContainer
        width={containerWidth}
        height={fullScreenHeight}
        useContainerWidth={true}
      >
        <Toolbar
          target={StyledToolbarElementContainer}
          isFullScreen={isFullScreen}
          onExpand={expand}
          onCollapse={collapse}
        >
          <ToolbarAction
            label="Download as PNG"
            icon={FileDownload}
            onClick={handleDownloadPng}
          />
          <ToolbarAction
            label={copyLabel}
            icon={isCopied ? Check : ContentCopy}
            onClick={handleCopySource}
          />
        </Toolbar>
        <StyledMermaidContainer
          ref={containerRef}
          hasError={false}
          isFullScreen={isFullScreen}
          data-testid="stMermaidChart"
          role="img"
          aria-label="Mermaid diagram"
          // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: sanitizedSvgContent }}
        />
      </StyledToolbarElementContainer>
    </ErrorBoundary>
  )
})

const MermaidChartWithFullScreen = withFullScreenWrapper(MermaidChart)
export { MermaidChartWithFullScreen as MermaidChart }
