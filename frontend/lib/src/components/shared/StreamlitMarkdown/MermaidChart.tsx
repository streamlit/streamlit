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

import {
  Check,
  ContentCopy,
  FileDownload,
} from "@emotion-icons/material-outlined"
import { getLuminance } from "color2k"
import { getLogger } from "loglevel"

import { SquareSkeleton } from "~lib/components/elements/Skeleton/styled-components"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary/ErrorBoundary"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import {
  StyledMermaidContainer,
  StyledMermaidErrorMessage,
} from "~lib/components/shared/StreamlitMarkdown/styled-components"
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
  sankey: "Sankey diagram",
  packet: "packet diagram",
  block: "block diagram",
  architecture: "architecture diagram",
  kanban: "Kanban board",
  xychart: "XY chart",
  radar: "radar chart",
  treemap: "treemap",
} as const

/**
 * Extracts the diagram type from mermaid source to generate descriptive alt text.
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

/**
 * Extracts accessibility directives (accTitle and accDescr) from mermaid source.
 * Mermaid supports these directives for providing accessible descriptions:
 *   accTitle: A short title for the diagram
 *   accDescr: A longer description (can be single line or multi-line with braces)
 *
 * @returns Object with optional title and description properties
 */
function extractAccessibilityInfo(source: string): {
  title?: string
  description?: string
} {
  const result: { title?: string; description?: string } = {}

  // Match accTitle: <text>
  const titleMatch = /^\s*accTitle\s*:\s*(.+)$/m.exec(source)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }

  // Match single-line accDescr: <text>
  const singleLineDescr = /^\s*accDescr\s*:\s*(.+)$/m.exec(source)
  if (singleLineDescr) {
    result.description = singleLineDescr[1].trim()
  } else {
    // Match multi-line accDescr { <text> }
    const multiLineDescr = /^\s*accDescr\s*\{([^}]*)\}/m.exec(source)
    if (multiLineDescr) {
      // Normalize whitespace in multi-line descriptions
      result.description = multiLineDescr[1].trim().replace(/\s+/g, " ")
    }
  }

  return result
}

/**
 * Generates accessible alt text for a mermaid diagram.
 * Prefers user-provided accTitle/accDescr directives, falls back to diagram type.
 */
function getAltText(source: string): string {
  const { title, description } = extractAccessibilityInfo(source)

  if (title && description) {
    return `${title}: ${description}`
  }
  if (title) {
    return title
  }
  if (description) {
    return description
  }

  return `Mermaid ${getDiagramTypeFromSource(source)}`
}

/**
 * Symbol used to attach our theme tracking key to the mermaid module.
 * This makes the relationship between mermaid's global state and our
 * tracking explicit, rather than using a separate module-level variable.
 */
const THEME_CONFIG_KEY = Symbol.for("streamlit.mermaid.themeConfigKey")

interface MermaidChartProps {
  /**
   * The mermaid diagram source code
   */
  source: string
}

/**
 * Prepares the rendered SVG for responsive display inside an <img>.
 *
 * Mermaid emits SVGs with `width="100%"` plus an inline `max-width` style, which
 * leaves the <img> without a definite intrinsic size. Inside a shrink-to-fit
 * container (e.g. `width="content"`) that causes the image to collapse to 0×0.
 * To avoid this we derive concrete pixel dimensions from the `viewBox` (falling
 * back to the width/height attributes) and set them as the SVG's intrinsic size.
 * CSS then scales the diagram down to fit its container while preserving the
 * aspect ratio.
 */
function prepareResponsiveSvg(svg: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, "image/svg+xml")
  const svgElement = doc.querySelector("svg")

  if (!svgElement) {
    return svg
  }

  // Derive intrinsic dimensions, preferring the viewBox over the width/height
  // attributes (which mermaid frequently sets to "100%").
  let intrinsicWidth = 0
  let intrinsicHeight = 0

  const viewBox = svgElement.getAttribute("viewBox")
  if (viewBox) {
    const [, , vbWidth, vbHeight] = viewBox.split(/[\s,]+/).map(Number)
    if (vbWidth > 0 && vbHeight > 0) {
      intrinsicWidth = vbWidth
      intrinsicHeight = vbHeight
    }
  }

  if (!intrinsicWidth || !intrinsicHeight) {
    intrinsicWidth =
      Number.parseFloat(svgElement.getAttribute("width") ?? "") || 100
    intrinsicHeight =
      Number.parseFloat(svgElement.getAttribute("height") ?? "") || 100
    svgElement.setAttribute(
      "viewBox",
      `0 0 ${intrinsicWidth} ${intrinsicHeight}`
    )
  }

  // Set explicit pixel dimensions so the <img> has a definite intrinsic size and
  // aspect ratio; CSS handles the responsive down-scaling.
  svgElement.setAttribute("width", String(intrinsicWidth))
  svgElement.setAttribute("height", String(intrinsicHeight))
  svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet")
  // Remove mermaid's inline max-width so it cannot constrain the intrinsic size.
  svgElement.style.removeProperty("max-width")

  return new XMLSerializer().serializeToString(svgElement)
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

  // Saturated colors for data series (bars, lines, points). The lighter tints in
  // `palette` above work for node fills but are too low-contrast for thin marks.
  const dataPalette = [
    theme.colors.blueTextColor,
    theme.colors.greenTextColor,
    theme.colors.orangeTextColor,
    theme.colors.redTextColor,
    theme.colors.violetTextColor,
    theme.colors.yellowTextColor,
    theme.colors.grayTextColor,
  ]

  return {
    darkMode: !isLightTheme,
    theme: "base",
    fontFamily: theme.genericFonts.bodyFont,
    // Slightly smaller than the body font size. Because the SVG is displayed in
    // a sandboxed <img> (which can't access the app's web font), the browser
    // falls back to a system font whose wider metrics can clip labels; the
    // smaller size keeps text within its boxes.
    fontSize: convertRemToPx(theme.fontSizes.sm),
    // Use SVG text elements instead of HTML foreignObject for labels.
    // HTML labels can extend beyond the calculated viewBox, causing
    // text clipping when rendered as an image.
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
    },
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
      fontSize: `${convertRemToPx(theme.fontSizes.sm)}px`,
      lineColor: theme.colors.fadedText60,
      textColor: theme.colors.bodyText,

      // Error styling
      errorBkgColor: palette.red,
      errorTextColor: theme.colors.redTextColor,

      // Sequence diagram notes (yellow background is distinctive)
      noteBkgColor: palette.yellow,
      noteTextColor: theme.colors.bodyText,

      // Gantt chart status colors
      doneTaskBkgColor: palette.green,
      doneTaskBorderColor: theme.colors.greenTextColor,
      critBkgColor: palette.red,
      critBorderColor: theme.colors.redTextColor,
      todayLineColor: theme.colors.primary,
      gridColor: theme.colors.borderColor,
      // Gantt task text colors for readability
      taskTextColor: theme.colors.bodyText,
      taskTextOutsideColor: theme.colors.bodyText,
      taskTextLightColor: theme.colors.bodyText,
      taskTextDarkColor: theme.colors.bodyText,
      sectionBkgColor: theme.colors.secondaryBg,
      altSectionBkgColor: theme.colors.bgColor,

      // Pie chart colors (need explicit palette for consistency)
      pie1: palette.blue,
      pie2: palette.green,
      pie3: palette.orange,
      pie4: palette.red,
      pie5: palette.violet,
      pie6: palette.yellow,
      pie7: palette.gray,
      pieStrokeColor: theme.colors.borderColor,
      pieOuterStrokeColor: theme.colors.borderColor,

      // Git graph branch colors
      git0: theme.colors.blueTextColor,
      git1: theme.colors.greenTextColor,
      git2: theme.colors.orangeTextColor,
      git3: theme.colors.redTextColor,
      git4: theme.colors.violetTextColor,
      git5: theme.colors.yellowTextColor,
      git6: theme.colors.grayTextColor,
      git7: theme.colors.primary,
      // White text on colored branch labels for readability
      gitBranchLabel0: theme.colors.bgColor,
      gitBranchLabel1: theme.colors.bgColor,
      gitBranchLabel2: theme.colors.bgColor,
      gitBranchLabel3: theme.colors.bgColor,
      gitBranchLabel4: theme.colors.bgColor,
      gitBranchLabel5: theme.colors.bgColor,
      gitBranchLabel6: theme.colors.bgColor,
      gitBranchLabel7: theme.colors.bgColor,

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

      // XY chart: data series (bars/lines) use saturated colors for contrast
      // (the lighter node-fill tints would be nearly invisible for thin marks),
      // and the background/text/axis colors follow the theme so it doesn't show
      // a white plot card in dark mode.
      xyChart: {
        backgroundColor: theme.colors.bgColor,
        titleColor: theme.colors.bodyText,
        xAxisLabelColor: theme.colors.bodyText,
        xAxisTitleColor: theme.colors.bodyText,
        xAxisTickColor: theme.colors.fadedText60,
        xAxisLineColor: theme.colors.fadedText60,
        yAxisLabelColor: theme.colors.bodyText,
        yAxisTitleColor: theme.colors.bodyText,
        yAxisTickColor: theme.colors.fadedText60,
        yAxisLineColor: theme.colors.fadedText60,
        plotColorPalette: dataPalette.join(", "),
      },

      // Radar series reuse the cScale colors; raise opacity and stroke width so
      // the plotted curves stay visible against the background.
      radar: {
        curveOpacity: 0.5,
        curveStrokeWidth: 2.5,
      },
    },
  }
}

/**
 * A component that renders Mermaid diagrams.
 * Lazy loads the mermaid library and renders diagrams client-side.
 *
 * Renders via an <img> tag with blob URL, which provides browser-enforced
 * security sandboxing (no script execution possible).
 */
const MermaidChart = memo(function MermaidChart({
  source,
}: Readonly<MermaidChartProps>) {
  const theme = useEmotionTheme()
  const uniqueId = useId()
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

  const themeConfig = useMemo(() => getMermaidThemeConfig(theme), [theme])

  // Counter to ensure each render gets a unique diagram ID, preventing conflicts
  // when rapid source/theme changes cause overlapping mermaid.render() calls.
  const renderCounterRef = useRef(0)

  // Ref to track the blob URL being used for PNG download. This prevents the
  // cleanup effect from revoking the URL while an async image load is in progress.
  const downloadingBlobUrlRef = useRef<string | null>(null)

  // Ref mirroring the currently displayed blob URL. Used by the download handler
  // to decide whether a finished download URL is still on screen (keep it) or
  // stale (revoke it), without relying on a captured-closure value.
  const currentSvgBlobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let committedToState = false

    renderCounterRef.current += 1
    const renderNum = renderCounterRef.current

    const renderMermaid = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      let blobUrl: string | null = null
      try {
        const mermaidModule = await import("mermaid")
        const mermaid = mermaidModule.default

        if (isCancelled) return

        // Re-initialize mermaid when theme config changes.
        // We store our tracking key on the mermaid module itself since mermaid
        // maintains global state and initialize() affects all future renders.
        const themeConfigKey = JSON.stringify(themeConfig)
        const mermaidWithKey = mermaid as typeof mermaid & {
          [THEME_CONFIG_KEY]?: string
        }
        if (mermaidWithKey[THEME_CONFIG_KEY] !== themeConfigKey) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            ...themeConfig,
          })
          mermaidWithKey[THEME_CONFIG_KEY] = themeConfigKey
        }

        // Generate a unique ID for this render. Includes render counter to prevent
        // conflicts when multiple renders overlap (e.g., rapid source changes).
        // Remove colons since mermaid uses it as a CSS selector.
        const diagramId = `mermaid-${uniqueId.replace(/:/g, "")}-${renderNum}`
        const { svg } = await mermaid.render(diagramId, source)

        if (isCancelled) return

        const finalSvg = prepareResponsiveSvg(svg)

        // Create blob URL for rendering via <img> tag.
        const blob = new Blob([finalSvg], {
          type: "image/svg+xml;charset=utf-8",
        })
        blobUrl = URL.createObjectURL(blob)

        if (!isCancelled) {
          setSvgBlobUrl(blobUrl)
          committedToState = true
          setIsLoading(false)
        } else {
          URL.revokeObjectURL(blobUrl)
        }
      } catch (err) {
        if (blobUrl && !committedToState) {
          URL.revokeObjectURL(blobUrl)
        }
        if (!isCancelled) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to render diagram"
          setError(errorMessage)
          // Clear svgBlobUrl so the cleanup effect revokes any previously successful URL
          setSvgBlobUrl(null)
          setIsLoading(false)
        }
      }
    }

    void renderMermaid()

    return () => {
      isCancelled = true
    }
  }, [source, themeConfig, uniqueId])

  // Clean up blob URL when component unmounts or URL changes.
  // Skips revocation if the URL is currently being used for PNG download.
  useEffect(() => {
    currentSvgBlobUrlRef.current = svgBlobUrl
    return () => {
      if (svgBlobUrl && svgBlobUrl !== downloadingBlobUrlRef.current) {
        URL.revokeObjectURL(svgBlobUrl)
      }
    }
  }, [svgBlobUrl])

  const handleCopySource = useCallback((): void => {
    copyToClipboard(source)
  }, [copyToClipboard, source])

  /**
   * Download the rendered diagram as a PNG image.
   * Uses a ref to protect the blob URL from being revoked during async image loading.
   */
  const handleDownloadPng = useCallback((): void => {
    if (!svgBlobUrl) {
      return
    }

    downloadingBlobUrlRef.current = svgBlobUrl

    // Clear the download marker and revoke the URL if it's no longer the
    // currently displayed one (the source/theme may have changed mid-download,
    // in which case the cleanup effect skipped revoking it).
    const releaseDownloadUrl = (): void => {
      const urlToRevoke = downloadingBlobUrlRef.current
      downloadingBlobUrlRef.current = null
      if (urlToRevoke && urlToRevoke !== currentSvgBlobUrlRef.current) {
        URL.revokeObjectURL(urlToRevoke)
      }
    }

    const img = new Image()
    img.onload = () => {
      // Use natural dimensions from the SVG viewBox (avoids forced reflow)
      const width = img.naturalWidth || 800
      const height = img.naturalHeight || 600

      const canvas = document.createElement("canvas")
      const scale = 2 // 2x scale for better quality
      canvas.width = width * scale
      canvas.height = height * scale

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        downloadingBlobUrlRef.current = null
        return
      }

      ctx.fillStyle = theme.colors.bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)

      const link = document.createElement("a")
      link.download = "mermaid-diagram.png"
      link.href = canvas.toDataURL("image/png")
      link.click()

      releaseDownloadUrl()
    }
    img.onerror = () => {
      LOG.error("Failed to load SVG for PNG export")
      releaseDownloadUrl()
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
          <SquareSkeleton data-testid="stSkeleton" aria-hidden="true" />
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
          <StyledMermaidErrorMessage data-testid="stMermaidError" role="alert">
            Mermaid diagram error: {error}
          </StyledMermaidErrorMessage>
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    )
  }

  // Render the SVG via an <img> tag with blob URL.
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
          {svgBlobUrl && <img src={svgBlobUrl} alt={getAltText(source)} />}
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    </ErrorBoundary>
  )
})

const MermaidChartWithFullScreen = withFullScreenWrapper(MermaidChart)
export { MermaidChartWithFullScreen as MermaidChart }
