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

import { memo, useCallback, useEffect, useId, useRef, useState } from "react"

import styled from "@emotion/styled"
import {
  Check,
  ContentCopy,
  FileDownload,
} from "@emotion-icons/material-outlined"
import { getLuminance } from "color2k"
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

/**
 * Mapping of mermaid diagram type keywords to human-readable names.
 * Used to generate more descriptive alt text for accessibility.
 */
const DIAGRAM_TYPE_MAP: Record<string, string> = {
  graph: "flowchart",
  flowchart: "flowchart",
  sequencediagram: "sequence diagram",
  classDiagram: "class diagram",
  stateDiagram: "state diagram",
  erDiagram: "entity relationship diagram",
  journey: "user journey diagram",
  gantt: "Gantt chart",
  pie: "pie chart",
  quadrantChart: "quadrant chart",
  requirementDiagram: "requirement diagram",
  gitGraph: "Git graph",
  mindmap: "mindmap",
  timeline: "timeline",
  zenuml: "ZenUML diagram",
  sankey: "Sankey diagram",
  packet: "packet diagram",
  block: "block diagram",
  architecture: "architecture diagram",
  kanban: "Kanban board",
} as const

/**
 * Extracts the diagram type from mermaid source to generate descriptive alt text.
 * Parses the first line to identify the diagram type keyword.
 */
function getDiagramTypeFromSource(source: string): string {
  const firstLine = source.trim().split("\n")[0].trim().toLowerCase()

  for (const [keyword, label] of Object.entries(DIAGRAM_TYPE_MAP)) {
    if (firstLine.startsWith(keyword.toLowerCase())) {
      return label
    }
  }

  return "diagram"
}

// Module-level tracking for mermaid initialization
// Stores a fingerprint of the full theme config to detect any theme changes
let lastThemeConfigKey: string | null = null

const StyledMermaidContainer = styled.div<{
  hasError: boolean
  isFullScreen: boolean
}>(({ theme, hasError, isFullScreen }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: hasError ? "flex-start" : "center",
  justifyContent: isFullScreen ? "center" : "flex-start",
  minHeight: "2rem",
  padding: theme.spacing.md,
  height: isFullScreen ? "100%" : "auto",
  width: "100%",
  "& img": {
    // In fullscreen mode: fill available space while maintaining aspect ratio
    // In normal mode: use natural size up to constraints
    width: isFullScreen ? "100%" : "auto",
    maxWidth: "100%",
    height: "auto",
    // Limit height in normal mode to prevent diagrams from dominating the page
    // Users can expand to fullscreen to see the full diagram
    maxHeight: isFullScreen ? "100%" : "25rem",
    objectFit: "contain",
    borderRadius: theme.radii.default,
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
 *
 * Uses htmlLabels: false to generate native SVG text elements instead of
 * foreignObject with HTML. This allows rendering via an <img> tag, which
 * provides browser-enforced security sandboxing (no script execution possible).
 */
const MermaidChart = memo(function MermaidChart({
  source,
}: Readonly<MermaidChartProps>) {
  const theme = useEmotionTheme()
  const uniqueId = useId()
  const imgRef = useRef<HTMLImageElement>(null)
  const [svgBlobUrl, setSvgBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    // Track if blob URL was committed to state (so cleanup knows not to revoke it)
    let committedToState = false

    const renderMermaid = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      let blobUrl: string | null = null
      try {
        // Lazy load mermaid
        const mermaidModule = await import("mermaid")
        const mermaid = mermaidModule.default

        if (isCancelled) return

        // Configure mermaid with theme-aware settings
        const themeConfig = getMermaidThemeConfig(theme)
        const themeConfigKey = JSON.stringify(themeConfig)

        // Re-initialize mermaid when theme config changes
        if (lastThemeConfigKey !== themeConfigKey) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            // Use native SVG text instead of foreignObject with HTML.
            // This enables rendering via <img> tag for browser-enforced security.
            htmlLabels: false,
            ...themeConfig,
          })
          lastThemeConfigKey = themeConfigKey
        }

        // Generate a unique ID for this render
        // Remove colons from the id since mermaid uses it as a CSS selector
        const diagramId = `mermaid-${uniqueId.replace(/:/g, "")}`

        // Render the diagram (bindFunctions not used since we render via <img>)
        const { svg } = await mermaid.render(diagramId, source)

        if (isCancelled) return

        // Process SVG for responsive sizing
        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, "image/svg+xml")
        const svgElement = doc.querySelector("svg")

        let finalSvg = svg
        if (svgElement) {
          // Get dimensions before removing (needed for fallback viewBox)
          const width = svgElement.getAttribute("width") || "100"
          const height = svgElement.getAttribute("height") || "100"

          // Ensure viewBox exists for proper scaling
          if (!svgElement.hasAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`)
          }

          // Remove explicit dimensions to allow CSS to control sizing
          svgElement.removeAttribute("width")
          svgElement.removeAttribute("height")
          svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet")

          finalSvg = new XMLSerializer().serializeToString(svgElement)
        }

        // Create blob URL for rendering via <img> tag
        // This provides browser-enforced security sandboxing
        const blob = new Blob([finalSvg], {
          type: "image/svg+xml;charset=utf-8",
        })
        blobUrl = URL.createObjectURL(blob)

        if (!isCancelled) {
          setSvgBlobUrl(blobUrl)
          committedToState = true
          setIsLoading(false)
        } else {
          // Cancelled after creating URL but before committing - clean up
          URL.revokeObjectURL(blobUrl)
        }
      } catch (err) {
        // Clean up blob URL if render failed after creating it
        if (blobUrl && !committedToState) {
          URL.revokeObjectURL(blobUrl)
        }
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
      // Don't revoke here - let the svgBlobUrl cleanup effect handle committed URLs
    }
  }, [source, theme, uniqueId])

  // Clean up blob URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (svgBlobUrl) {
        URL.revokeObjectURL(svgBlobUrl)
      }
    }
  }, [svgBlobUrl])

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
    if (!imgRef.current || !svgBlobUrl) {
      return
    }

    const imgElement = imgRef.current

    // Get the rendered image dimensions
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required for PNG export dimensions
    const imgRect = imgElement.getBoundingClientRect()
    const width = imgRect.width
    const height = imgRect.height

    // Create an image from the blob URL and draw to canvas
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Use 2x scale for better quality
      const scale = 2
      canvas.width = width * scale
      canvas.height = height * scale

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        return
      }

      // Fill with background color
      ctx.fillStyle = theme.colors.bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Scale and draw the image
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)

      // Download the PNG
      const pngUrl = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = "mermaid-diagram.png"
      link.href = pngUrl
      link.click()
    }
    img.onerror = () => {
      LOG.error("Failed to load SVG for PNG export")
    }
    img.src = svgBlobUrl
  }, [svgBlobUrl, theme.colors.bgColor])

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

  // Render the SVG via an <img> tag with blob URL.
  // This provides browser-enforced security sandboxing - no script execution possible.
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
          hasError={false}
          isFullScreen={isFullScreen}
          data-testid="stMermaidChart"
        >
          {svgBlobUrl && (
            <img
              ref={imgRef}
              src={svgBlobUrl}
              alt={`Mermaid ${getDiagramTypeFromSource(source)}`}
            />
          )}
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    </ErrorBoundary>
  )
})

const MermaidChartWithFullScreen = withFullScreenWrapper(MermaidChart)
export { MermaidChartWithFullScreen as MermaidChart }
