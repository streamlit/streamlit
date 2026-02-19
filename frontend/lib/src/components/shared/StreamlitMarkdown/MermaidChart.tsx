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

import { memo, useEffect, useId, useRef, useState } from "react"

import styled from "@emotion/styled"
import { getLuminance } from "color2k"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { Skeleton } from "~lib/components/elements/Skeleton"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  blend,
  convertRemToPx,
  EmotionTheme,
  getThemeBackgroundColors,
} from "~lib/theme"

// Module-level tracking for mermaid initialization
// Stores the theme mode (light/dark) that was used for initialization
let initializedThemeMode: boolean | null = null

const StyledMermaidContainer = styled.div<{ hasError: boolean }>(
  ({ theme, hasError }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: hasError ? "flex-start" : "center",
    justifyContent: "center",
    minHeight: "2rem",
    padding: theme.spacing.sm,
    // Ensure SVG is responsive
    "& svg": {
      maxWidth: "100%",
      height: "auto",
    },
  })
)

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
export const MermaidChart = memo(function MermaidChart({
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

  if (isLoading) {
    return (
      <StyledMermaidContainer
        hasError={false}
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
    )
  }

  if (error) {
    return (
      <StyledMermaidContainer hasError={true} data-testid="stMermaidChart">
        <StyledErrorMessage data-testid="stMermaidError" role="alert">
          Mermaid diagram error: {error}
        </StyledErrorMessage>
      </StyledMermaidContainer>
    )
  }

  // Mermaid generates SVG content that must be injected as HTML.
  // The content is generated by mermaid.render() which uses DOMPurify internally for sanitization.
  return (
    <ErrorBoundary>
      <StyledMermaidContainer
        ref={containerRef}
        hasError={false}
        data-testid="stMermaidChart"
        role="img"
        aria-label="Mermaid diagram"
        // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
        dangerouslySetInnerHTML={{ __html: svgContent || "" }}
      />
    </ErrorBoundary>
  )
})
