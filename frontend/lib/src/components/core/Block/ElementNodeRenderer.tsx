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

import { lazy, ReactElement, useContext } from "react"

import {
  Alert as AlertProto,
  AudioInput as AudioInputProto,
  Audio as AudioProto,
  BidiComponent as BidiComponentProto,
  ButtonGroup as ButtonGroupProto,
  Button as ButtonProto,
  CameraInput as CameraInputProto,
  ChatInput as ChatInputProto,
  Checkbox as CheckboxProto,
  Code as CodeProto,
  ColorPicker as ColorPickerProto,
  ComponentInstance as ComponentInstanceProto,
  Dataframe as DataframeProto,
  DateInput as DateInputProto,
  DateTimeInput as DateTimeInputProto,
  DeckGlJsonChart as DeckGlJsonChartProto,
  DownloadButton as DownloadButtonProto,
  Exception as ExceptionProto,
  Feedback as FeedbackProto,
  FileUploader as FileUploaderProto,
  GraphVizChart as GraphVizChartProto,
  Heading as HeadingProto,
  Help as HelpProto,
  Html as HtmlProto,
  IFrame as IFrameProto,
  ImageList as ImageListProto,
  Json as JsonProto,
  LinkButton as LinkButtonProto,
  Markdown as MarkdownProto,
  Metric as MetricProto,
  MultiSelect as MultiSelectProto,
  NumberInput as NumberInputProto,
  PageLink as PageLinkProto,
  PlotlyChart as PlotlyChartProto,
  Progress as ProgressProto,
  Radio as RadioProto,
  Selectbox as SelectboxProto,
  Skeleton as SkeletonProto,
  Slider as SliderProto,
  Spinner as SpinnerProto,
  Table as TableProto,
  TextArea as TextAreaProto,
  TextInput as TextInputProto,
  Text as TextProto,
  TimeInput as TimeInputProto,
  Toast as ToastProto,
  Video as VideoProto,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
// Load (non-lazy) elements.
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import Maybe from "~lib/components/core/Maybe"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import AlertElement, {
  getAlertElementKind,
} from "~lib/components/elements/AlertElement"
import ExceptionElement from "~lib/components/elements/ExceptionElement"
import Help from "~lib/components/elements/Help"
import Markdown from "~lib/components/elements/Markdown"
import { Skeleton } from "~lib/components/elements/Skeleton"
import TextElement from "~lib/components/elements/TextElement"
import Heading from "~lib/components/shared/StreamlitMarkdown/Heading"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import { ElementContainer } from "./ElementContainer"
import {
  ElementContainerConfig,
  MinStretchWidth,
} from "./ElementContainerConfig"
import { StyledSpace } from "./styled-components"
import {
  BaseBlockProps,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"

// Lazy-load elements.
const Table = lazy(() => import("~lib/components/elements/Table"))
const ArrowVegaLiteChart = lazy(
  () => import("~lib/components/elements/ArrowVegaLiteChart")
)
const Audio = lazy(() => import("~lib/components/elements/Audio"))
const Balloons = lazy(() => import("~lib/components/elements/Balloons"))
const DeckGlJsonChart = lazy(
  () => import("~lib/components/elements/DeckGlJsonChart")
)
const GraphVizChart = lazy(
  () => import("~lib/components/elements/GraphVizChart")
)
const Html = lazy(() => import("~lib/components/elements/Html"))
const IFrame = lazy(() => import("~lib/components/elements/IFrame"))
const ImageList = lazy(() => import("~lib/components/elements/ImageList"))
const Json = lazy(() => import("~lib/components/elements/Json"))
const LinkButton = lazy(() => import("~lib/components/elements/LinkButton"))
const Metric = lazy(() => import("~lib/components/elements/Metric"))
const PageLink = lazy(() => import("~lib/components/elements/PageLink"))
const PlotlyChart = lazy(() => import("~lib/components/elements/PlotlyChart"))
const Progress = lazy(() => import("~lib/components/elements/Progress"))
const Snow = lazy(() => import("~lib/components/elements/Snow"))
const Spinner = lazy(() => import("~lib/components/elements/Spinner"))
const StreamlitSyntaxHighlighter = lazy(
  () => import("~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter")
)
const Toast = lazy(() => import("~lib/components/elements/Toast"))
const Video = lazy(() => import("~lib/components/elements/Video"))

// Lazy-load widgets.
const AudioInput = lazy(() => import("~lib/components/widgets/AudioInput"))
const ArrowDataFrame = lazy(() => import("~lib/components/widgets/DataFrame"))
const Button = lazy(() => import("~lib/components/widgets/Button"))
const ButtonGroup = lazy(() => import("~lib/components/widgets/ButtonGroup"))
const ComponentInstance = lazy(() =>
  import("~lib/components/widgets/CustomComponent").then(module => ({
    default: module.ComponentInstance,
  }))
)
const CameraInput = lazy(() => import("~lib/components/widgets/CameraInput"))
const ChatInput = lazy(() => import("~lib/components/widgets/ChatInput"))
const Checkbox = lazy(() => import("~lib/components/widgets/Checkbox"))
const ColorPicker = lazy(() => import("~lib/components/widgets/ColorPicker"))
const DateInput = lazy(() => import("~lib/components/widgets/DateInput"))
const DateTimeInput = lazy(
  () => import("~lib/components/widgets/DateTimeInput")
)
const DownloadButton = lazy(
  () => import("~lib/components/widgets/DownloadButton")
)
const Feedback = lazy(() => import("~lib/components/widgets/Feedback"))
const FileUploader = lazy(() => import("~lib/components/widgets/FileUploader"))
const FormSubmitContent = lazy(() =>
  import("~lib/components/widgets/Form").then(module => ({
    default: module.FormSubmitContent,
  }))
)
const Multiselect = lazy(() => import("~lib/components/widgets/Multiselect"))
const NumberInput = lazy(() => import("~lib/components/widgets/NumberInput"))
const Radio = lazy(() => import("~lib/components/widgets/Radio"))
const Selectbox = lazy(() => import("~lib/components/widgets/Selectbox"))
const Slider = lazy(() => import("~lib/components/widgets/Slider"))
const TextArea = lazy(() => import("~lib/components/widgets/TextArea"))
const TextInput = lazy(() => import("~lib/components/widgets/TextInput"))
const TimeInput = lazy(() => import("~lib/components/widgets/TimeInput"))

const BidiComponent = lazy(
  () => import("~lib/components/widgets/BidiComponent")
)

export interface ElementNodeRendererProps extends BaseBlockProps {
  node: ElementNode
}

interface RawElementNodeRendererProps extends ElementNodeRendererProps {
  isStale: boolean
}

function hideIfStale(isStale: boolean, component: ReactElement): ReactElement {
  return isStale ? <></> : component
}

// Render ElementNodes (i.e. leaf nodes).
const RawElementNodeRenderer = (
  props: RawElementNodeRendererProps
): ReactElement => {
  const { node, isStale } = props
  const { isInRoot, isInHorizontalLayout } = useRequiredContext(FlexContext)

  if (!node) {
    throw new Error("ElementNode not found.")
  }

  const elementProps = {
    disableFullscreenMode: props.disableFullscreenMode,
    widthConfig: node.element.widthConfig,
    heightConfig: node.element.heightConfig,
  }

  const widgetProps = {
    ...elementProps,
    widgetMgr: props.widgetMgr,
    disabled: props.widgetsDisabled,
    fragmentId: node.fragmentId,
    componentRegistry: props.componentRegistry,
  }

  switch (node.element.type) {
    case "alert": {
      const alertProto = node.element.alert as AlertProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <AlertElement
            icon={alertProto.icon}
            body={alertProto.body}
            kind={getAlertElementKind(alertProto.format)}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    case "table": {
      const tableProto = node.element.table as TableProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <Table
            element={tableProto}
            data={node.quiverElement}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    case "audio":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <Audio
            element={node.element.audio as AudioProto}
            endpoints={props.endpoints}
            {...elementProps}
            elementMgr={props.widgetMgr}
          />
        </ElementContainer>
      )

    case "balloons":
      // Specifically use node.scriptRunId vs. scriptRunId from context
      // See issue #10961: https://github.com/streamlit/streamlit/issues/10961
      return hideIfStale(
        isStale,
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Balloons scriptRunId={node.scriptRunId} />
        </ElementContainer>
      )

    case "code": {
      const codeProto = node.element.code as CodeProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <StreamlitSyntaxHighlighter
            language={codeProto.language}
            showLineNumbers={codeProto.showLineNumbers}
            wrapLines={codeProto.wrapLines}
          >
            {codeProto.codeText}
          </StreamlitSyntaxHighlighter>
        </ElementContainer>
      )
    }

    case "deckGlJsonChart": {
      const deckGlProto = node.element.deckGlJsonChart as DeckGlJsonChartProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_OVERFLOW_VISIBLE}
          isStale={isStale}
        >
          <DeckGlJsonChart
            element={deckGlProto}
            // DeckGL chart can be used as a widget (when selections are activated) or
            // an element. We only want to set the key in case of it being used as a widget
            // since otherwise it might break some apps that show the same charts multiple times.
            // So we only compute an element ID if it's a widget, otherwise its an empty string.
            key={deckGlProto.id || undefined}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "helpInfo":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <Help
            element={node.element.helpInfo as HelpProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "empty":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <div className="stEmpty" data-testid="stEmpty" />
        </ElementContainer>
      )

    case "exception":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <ExceptionElement
            element={node.element.exception as ExceptionProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "graphvizChart":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_OVERFLOW_VISIBLE}
          isStale={isStale}
        >
          <GraphVizChart
            element={node.element.graphvizChart as GraphVizChartProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "heading":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Heading
            element={node.element.heading as HeadingProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "iframe":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_OVERFLOW_VISIBLE}
          isStale={isStale}
        >
          <IFrame
            element={node.element.iframe as IFrameProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "imgs": {
      // The st.image element is potentially a list of images, so we defer the sizing to the ImageList component.
      // This also covers st.pyplot() which is a special case of st.image.
      //
      // Use "auto" when image has explicit non-stretch size (content/pixel/rem) to enable horizontal alignment (#12435).
      // Use "100%" when using stretch or when no width config is set to ensure container has dimensions for width calculation (#12678).
      //
      // Legacy behavior: When widthConfig is not set, the default is to stretch (use container width).
      // This is consistent with how useLayoutStyles handles missing config for other elements.
      const isUsingStretch =
        !node.element.widthConfig || node.element.widthConfig.useStretch

      const config = isUsingStretch
        ? ElementContainerConfig.FULL_WIDTH
        : new ElementContainerConfig({
            styleOverrides: { width: "auto" },
          })

      return (
        <ElementContainer node={node} config={config} isStale={isStale}>
          <ImageList
            element={node.element.imgs as ImageListProto}
            endpoints={props.endpoints}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    case "json":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <Json element={node.element.json as JsonProto} {...elementProps} />
        </ElementContainer>
      )

    case "markdown": {
      // Markdown "auto" width behavior:
      // When markdown has no explicit width config, apply container-aware sizing:
      // - In horizontal layouts: content width (fit-content)
      // - In vertical layouts: stretch (100%)
      const config = node.element.widthConfig
        ? ElementContainerConfig.DEFAULT
        : isInHorizontalLayout
          ? new ElementContainerConfig({
              styleOverrides: { width: "fit-content" },
            })
          : ElementContainerConfig.FULL_WIDTH

      return (
        <ElementContainer node={node} config={config} isStale={isStale}>
          <Markdown
            element={node.element.markdown as MarkdownProto}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    case "metric": {
      const metricProto = node.element.metric as MetricProto
      const hasChart =
        metricProto.chartData && metricProto.chartData.length > 0
      return (
        <ElementContainer
          node={node}
          config={
            hasChart
              ? ElementContainerConfig.LARGE_ELEMENT
              : ElementContainerConfig.DEFAULT
          }
          isStale={isStale}
        >
          <Metric element={metricProto} {...elementProps} />
        </ElementContainer>
      )
    }

    case "html":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Html element={node.element.html as HtmlProto} {...elementProps} />
        </ElementContainer>
      )

    case "pageLink": {
      const pageLinkProto = node.element.pageLink as PageLinkProto
      const isDisabled = widgetProps.disabled || pageLinkProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <PageLink
            element={pageLinkProto}
            disabled={isDisabled}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    case "progress":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <Progress
            element={node.element.progress as ProgressProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "skeleton":
      // Without this style, the skeleton width relies on the flex container that
      // wraps the page contents having align-items: stretch. There was a regression
      // where this default was changed. It is more robust to ensure that the skeleton
      // has this width.
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.FULL_WIDTH}
          isStale={isStale}
        >
          <Skeleton element={node.element.skeleton as SkeletonProto} />
        </ElementContainer>
      )

    case "snow":
      // Specifically use node.scriptRunId vs. scriptRunId from context
      // See issue #10961: https://github.com/streamlit/streamlit/issues/10961
      return hideIfStale(
        isStale,
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Snow scriptRunId={node.scriptRunId} />
        </ElementContainer>
      )

    case "space":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <StyledSpace className="stSpace" data-testid="stSpace" />
        </ElementContainer>
      )

    case "spinner":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Spinner
            element={node.element.spinner as SpinnerProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "text":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <TextElement
            element={node.element.text as TextProto}
            {...elementProps}
          />
        </ElementContainer>
      )

    case "video":
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <Video
            element={node.element.video as VideoProto}
            endpoints={props.endpoints}
            {...elementProps}
            elementMgr={props.widgetMgr}
          />
        </ElementContainer>
      )

    // Events:
    case "toast": {
      const toastProto = node.element.toast as ToastProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Toast
            // React key needed so toasts triggered on re-run
            key={node.scriptRunId}
            element={toastProto}
            {...elementProps}
          />
        </ElementContainer>
      )
    }

    // Widgets:
    case "dataframe": {
      const dataframeProto = node.element.dataframe as DataframeProto
      widgetProps.disabled = widgetProps.disabled || dataframeProto.disabled

      // Resizable dataframes measure parent container width for the resize feature.
      // Parent needs defined width (not fit-content) for measurement to work.
      // Only needed in root where resize is enabled; disabled in nested containers.
      const needsFullWidth = node.element.widthConfig?.useContent && isInRoot
      const config = needsFullWidth
        ? new ElementContainerConfig({
            minStretchWidth: MinStretchWidth.LARGE,
            styleOverrides: { overflow: "visible", width: "100%" },
          })
        : ElementContainerConfig.LARGE_OVERFLOW_VISIBLE

      return (
        <ElementContainer node={node} config={config} isStale={isStale}>
          <ArrowDataFrame
            // Arrow dataframe can be used as a widget (data_editor) or
            // an element (dataframe). We only want to set the key in case of
            // it being used as a widget. For the non-widget usage, the id will
            // be undefined.
            key={dataframeProto.id || undefined}
            element={dataframeProto}
            data={node.quiverElement}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "vegaLiteChart": {
      const vegaLiteElement = node.vegaLiteChartElement

      // VegaLite charts with embedded dataframes need a defined parent width
      // (not fit-content) for proper measurement and rendering due to the resize feature.
      // Resize is disabled in nested containers, so this is only necessary in the root container.
      const needsFullWidth = node.element.widthConfig?.useContent && isInRoot
      // TODO (lawilby): See if we can remove this once the new width style is implemented for all of the vega charts.
      const needsFlex = isInHorizontalLayout && !node.element.widthConfig
      const config =
        needsFullWidth || needsFlex
          ? new ElementContainerConfig({
              minStretchWidth: MinStretchWidth.LARGE,
              styleOverrides: {
                overflow: "visible",
                ...(needsFullWidth && { width: "100%" }),
                ...(needsFlex && { flex: "1 1 14rem" }),
              },
            })
          : ElementContainerConfig.LARGE_OVERFLOW_VISIBLE

      return (
        <ElementContainer node={node} config={config} isStale={isStale}>
          <ArrowVegaLiteChart
            element={vegaLiteElement}
            // Vega-lite chart can be used as a widget (when selections are activated) or
            // an element. We only want to set the key in case of it being used as a widget
            // since otherwise it might break some apps that show the same charts multiple times.
            // So we only compute an element ID if it's a widget, otherwise its an empty string.
            key={vegaLiteElement.id || undefined}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "audioInput": {
      const audioInputProto = node.element.audioInput as AudioInputProto
      widgetProps.disabled = widgetProps.disabled || audioInputProto.disabled

      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <AudioInput
            key={audioInputProto.id}
            uploadClient={props.uploadClient}
            element={audioInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "button": {
      const buttonProto = node.element.button as ButtonProto
      widgetProps.disabled = widgetProps.disabled || buttonProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          {buttonProto.isFormSubmitter ? (
            <FormSubmitContent element={buttonProto} {...widgetProps} />
          ) : (
            <Button element={buttonProto} {...widgetProps} />
          )}
        </ElementContainer>
      )
    }

    case "buttonGroup": {
      const buttonGroupProto = node.element.buttonGroup as ButtonGroupProto
      widgetProps.disabled = widgetProps.disabled || buttonGroupProto.disabled

      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <ButtonGroup
            key={buttonGroupProto.id}
            element={buttonGroupProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "downloadButton": {
      const downloadButtonProto = node.element
        .downloadButton as DownloadButtonProto
      widgetProps.disabled =
        widgetProps.disabled || downloadButtonProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <DownloadButton
            endpoints={props.endpoints}
            key={downloadButtonProto.id}
            element={downloadButtonProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "feedback": {
      const feedbackProto = node.element.feedback as FeedbackProto
      widgetProps.disabled = widgetProps.disabled || feedbackProto.disabled

      // Feedback uses borderless button group style, should shrink to content size
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.FIT_CONTENT_ELEMENT}
          isStale={isStale}
        >
          <Feedback
            key={feedbackProto.id}
            element={feedbackProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "cameraInput": {
      const cameraInputProto = node.element.cameraInput as CameraInputProto
      widgetProps.disabled = widgetProps.disabled || cameraInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <CameraInput
            key={cameraInputProto.id}
            element={cameraInputProto}
            uploadClient={props.uploadClient}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "chatInput": {
      const chatInputProto = node.element.chatInput as ChatInputProto
      widgetProps.disabled = widgetProps.disabled || chatInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <ChatInput
            key={chatInputProto.id}
            element={chatInputProto}
            uploadClient={props.uploadClient}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "checkbox": {
      const checkboxProto = node.element.checkbox as CheckboxProto
      widgetProps.disabled = widgetProps.disabled || checkboxProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <Checkbox
            key={checkboxProto.id}
            element={checkboxProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "colorPicker": {
      const colorPickerProto = node.element.colorPicker as ColorPickerProto
      widgetProps.disabled = widgetProps.disabled || colorPickerProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <ColorPicker
            key={colorPickerProto.id}
            element={colorPickerProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }
    case "componentInstance":
      // Because of how width is handled for custom components, we need the
      // element wrapper to be full width.
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.FULL_WIDTH}
          isStale={isStale}
        >
          <ComponentInstance
            element={node.element.componentInstance as ComponentInstanceProto}
            {...widgetProps}
          />
        </ElementContainer>
      )

    case "dateInput": {
      const dateInputProto = node.element.dateInput as DateInputProto
      widgetProps.disabled = widgetProps.disabled || dateInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <DateInput
            key={dateInputProto.id}
            element={dateInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "fileUploader": {
      const fileUploaderProto = node.element.fileUploader as FileUploaderProto
      widgetProps.disabled = widgetProps.disabled || fileUploaderProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <FileUploader
            key={fileUploaderProto.id}
            element={fileUploaderProto}
            uploadClient={props.uploadClient}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "linkButton": {
      const linkButtonProto = node.element.linkButton as LinkButtonProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <LinkButton element={linkButtonProto} {...elementProps} />
        </ElementContainer>
      )
    }

    case "multiselect": {
      const multiSelectProto = node.element.multiselect as MultiSelectProto
      widgetProps.disabled = widgetProps.disabled || multiSelectProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <Multiselect
            key={multiSelectProto.id}
            element={multiSelectProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "numberInput": {
      const numberInputProto = node.element.numberInput as NumberInputProto
      widgetProps.disabled = widgetProps.disabled || numberInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <NumberInput
            key={numberInputProto.id}
            element={numberInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "plotlyChart": {
      const plotlyProto = node.element.plotlyChart as PlotlyChartProto
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.LARGE_ELEMENT}
          isStale={isStale}
        >
          <PlotlyChart
            key={plotlyProto.id}
            element={plotlyProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "radio": {
      const radioProto = node.element.radio as RadioProto
      widgetProps.disabled = widgetProps.disabled || radioProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <Radio key={radioProto.id} element={radioProto} {...widgetProps} />
        </ElementContainer>
      )
    }

    case "selectbox": {
      const selectboxProto = node.element.selectbox as SelectboxProto
      widgetProps.disabled = widgetProps.disabled || selectboxProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <Selectbox
            key={selectboxProto.id}
            element={selectboxProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "slider": {
      const sliderProto = node.element.slider as SliderProto
      widgetProps.disabled = widgetProps.disabled || sliderProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <Slider
            key={sliderProto.id}
            element={sliderProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "textArea": {
      const textAreaProto = node.element.textArea as TextAreaProto
      widgetProps.disabled = widgetProps.disabled || textAreaProto.disabled

      // The st.text_area element has a legacy implementation where the height
      // is measuring only the input box so the pixel height must be set in the element
      // and the container must be allowed to expand. Additionally, we don't want the
      // flex with height to be set on the element container.
      const useStretchHeight = node.element.heightConfig?.useStretch
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.MEDIUM,
        styleOverrides: useStretchHeight
          ? { height: "100%", flex: "1 1 8rem" }
          : // Content height text area in vertical layout cannot have flex.
            { height: "auto", ...(isInHorizontalLayout ? {} : { flex: "" }) },
      })

      return (
        <ElementContainer node={node} config={config} isStale={isStale}>
          <TextArea
            key={textAreaProto.id}
            element={textAreaProto}
            outerElement={node.element}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "textInput": {
      const textInputProto = node.element.textInput as TextInputProto
      widgetProps.disabled = widgetProps.disabled || textInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <TextInput
            key={textInputProto.id}
            element={textInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "dateTimeInput": {
      const dateTimeInputProto = node.element
        .dateTimeInput as DateTimeInputProto
      widgetProps.disabled =
        widgetProps.disabled || dateTimeInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <DateTimeInput
            key={dateTimeInputProto.id}
            element={dateTimeInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "timeInput": {
      const timeInputProto = node.element.timeInput as TimeInputProto
      widgetProps.disabled = widgetProps.disabled || timeInputProto.disabled
      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.MEDIUM_ELEMENT}
          isStale={isStale}
        >
          <TimeInput
            key={timeInputProto.id}
            element={timeInputProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }

    case "bidiComponent": {
      const bidiComponentProto = node.element
        .bidiComponent as BidiComponentProto

      return (
        <ElementContainer
          node={node}
          config={ElementContainerConfig.DEFAULT}
          isStale={isStale}
        >
          <BidiComponent
            key={bidiComponentProto.id}
            element={bidiComponentProto}
            {...widgetProps}
          />
        </ElementContainer>
      )
    }
    default:
      throw new Error(`Unrecognized Element type ${node.element.type}`)
  }
}

// Render ElementNodes (i.e. leaf nodes) wrapped in Maybe for conditional rendering.
const ElementNodeRenderer = (
  props: ElementNodeRendererProps
): ReactElement => {
  const { scriptRunState, scriptRunId, fragmentIdsThisRun } =
    useContext(ScriptRunContext)
  const { node } = props

  const elementType = node.element.type || ""

  const enable = shouldComponentBeEnabled(elementType, scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    scriptRunState,
    scriptRunId,
    fragmentIdsThisRun
  )

  // TODO: It would be great if we could return an empty fragment if isHidden is true, to keep the
  // DOM clean. But this would require the keys passed to ElementNodeRenderer at Block.tsx to be a
  // stable hash of some sort.
  return (
    <Maybe enable={enable}>
      <RawElementNodeRenderer {...props} isStale={isStale} />
    </Maybe>
  )
}

export default ElementNodeRenderer
