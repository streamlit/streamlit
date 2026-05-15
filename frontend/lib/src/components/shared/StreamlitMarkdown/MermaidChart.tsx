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

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { Skeleton } from "~lib/components/elements/Skeleton/Skeleton"
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

/**
 * Extracts accessibility directives (accTitle and accDescr) from mermaid source.
 * Mermaid supports these directives for providing accessible descriptions:
 *   accTitle: A short title for the diagram
 *   accDescr: A longer description (can be single line or multi-line with braces)
 *
 * @returns Object with extracted title and description, or undefined if not present
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

  // Prefer user-provided accessibility info
  if (title && description) {
    return `${title}: ${description}`
  }
  if (title) {
    return title
  }
  if (description) {
    return description
  }

  // Fall back to diagram type
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
 * Prepares SVG for responsive rendering by ensuring viewBox exists
 * and removing explicit dimensions to allow CSS control.
 */
function prepareResponsiveSvg(svg: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, "image/svg+xml")
  const svgElement = doc.querySelector("svg")

  if (!svgElement) {
    return svg
  }

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

  return {
    darkMode: !isLightTheme,
    theme: "base",
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: convertRemToPx(theme.fontSizes.md),
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
      fontSize: `${convertRemToPx(theme.fontSizes.md)}px`,
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

  useEffect(() => {
    let isCancelled = false
    let committedToState = false

    // Increment counter for each effect run to generate a unique ID
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

        // Create blob URL for rendering via <img> tag (browser-enforced security sandboxing)
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
   * Captures svgBlobUrl locally to prevent race conditions if the component
   * re-renders and the blob URL cleanup effect revokes the URL during image loading.
   */
  const handleDownloadPng = useCallback((): void => {
    if (!svgBlobUrl) {
      return
    }

    // Capture the blob URL in a local variable to prevent race conditions.
    // If a re-render triggers the cleanup effect while the image is loading,
    // the old URL could be revoked before onload fires.
    const capturedBlobUrl = svgBlobUrl

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
    }
    img.onerror = () => {
      LOG.error("Failed to load SVG for PNG export")
    }
    img.src = capturedBlobUrl
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
          <StyledMermaidErrorMessage data-testid="stMermaidError" role="alert">
            Mermaid diagram error: {error}
          </StyledMermaidErrorMessage>
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
          {svgBlobUrl && <img src={svgBlobUrl} alt={getAltText(source)} />}
        </StyledMermaidContainer>
      </StyledToolbarElementContainer>
    </ErrorBoundary>
  )
})

const MermaidChartWithFullScreen = withFullScreenWrapper(MermaidChart)
export { MermaidChartWithFullScreen as MermaidChart }
