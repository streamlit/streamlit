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
 * Uses Mermaid's "base" theme which derives many colors automatically.
 * We only override colors that need to match Streamlit's palette.
 */
function getMermaidThemeConfig(theme: EmotionTheme): Record<string, unknown> {
  const markdownBgColors = getThemeBackgroundColors(theme)
  const isLightTheme = getLuminance(theme.colors.bgColor) > 0.5

  // Streamlit color palette for charts (blended with background for better contrast)
  const palette = {
    blue: blend(markdownBgColors.bluebg, theme.colors.bgColor),
    green: blend(markdownBgColors.greenbg, theme.colors.bgColor),
    orange: blend(markdownBgColors.orangebg, theme.colors.bgColor),
    red: blend(markdownBgColors.redbg, theme.colors.bgColor),
    violet: blend(markdownBgColors.violetbg, theme.colors.bgColor),
    yellow: blend(markdownBgColors.yellowbg, theme.colors.bgColor),
    gray: blend(markdownBgColors.graybg, theme.colors.bgColor),
  }

  return {
    darkMode: !isLightTheme,
    theme: "base",
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: convertRemToPx(theme.fontSizes.md),
    themeVariables: {
      // Core theme variables - Mermaid derives many others from these
      darkMode: !isLightTheme,
      primaryColor: palette.blue,
      primaryTextColor: theme.colors.bodyText,
      primaryBorderColor: theme.colors.borderColor,
      secondaryColor: palette.green,
      tertiaryColor: palette.orange,
      background: theme.colors.bgColor,
      mainBkg: theme.colors.secondaryBg,
      fontFamily: theme.genericFonts.bodyFont,
      fontSize: `${convertRemToPx(theme.fontSizes.md)}px`,
      lineColor: theme.colors.fadedText60,
      textColor: theme.colors.bodyText,

      // Error styling
      errorBkgColor: palette.red,
      errorTextColor: theme.colors.redTextColor,

      // Sequence diagram notes (yellow background is distinctive)
      noteBkgColor: palette.yellow,

      // Gantt chart status colors
      doneTaskBkgColor: palette.green,
      doneTaskBorderColor: theme.colors.greenTextColor,
      critBkgColor: palette.red,
      critBorderColor: theme.colors.redTextColor,
      todayLineColor: theme.colors.primary,

      // Pie chart colors (need explicit palette for consistency)
      pie1: palette.blue,
      pie2: palette.green,
      pie3: palette.orange,
      pie4: palette.red,
      pie5: palette.violet,
      pie6: palette.yellow,
      pie7: palette.gray,

      // Git graph branch colors
      git0: theme.colors.blueTextColor,
      git1: theme.colors.greenTextColor,
      git2: theme.colors.orangeTextColor,
      git3: theme.colors.redTextColor,
      git4: theme.colors.violetTextColor,
      git5: theme.colors.yellowTextColor,
      git6: theme.colors.grayTextColor,
      git7: theme.colors.primary,

      // Mindmap colors
      mindmap1: palette.blue,
      mindmap2: palette.green,
      mindmap3: palette.orange,
      mindmap4: palette.red,
      mindmap5: palette.violet,

      // Timeline/cScale colors
      cScale0: palette.blue,
      cScale1: palette.green,
      cScale2: palette.orange,
      cScale3: palette.red,
      cScale4: palette.violet,
      cScale5: palette.yellow,
      cScale6: palette.gray,

      // Quadrant chart fills
      quadrant1Fill: palette.blue,
      quadrant2Fill: palette.green,
      quadrant3Fill: palette.orange,
      quadrant4Fill: palette.red,
      quadrantPointFill: theme.colors.primary,

      // User Journey section colors
      fillType0: palette.blue,
      fillType1: palette.green,
      fillType2: palette.orange,
      fillType3: palette.red,
      fillType4: palette.violet,
      fillType5: palette.yellow,
      fillType6: palette.gray,
      fillType7: theme.colors.secondaryBg,
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
