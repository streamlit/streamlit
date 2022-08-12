import {
  render as reactTestingLibraryRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react" // eslint-disable-line import/no-extraneous-dependencies
import {
  mount as enzymeMount,
  MountRendererProps,
  ReactWrapper,
  shallow as enzymeShallow,
  ShallowRendererProps,
  ShallowWrapper,
} from "enzyme" // eslint-disable-line import/no-extraneous-dependencies
import React, { Component, FC, ReactElement } from "react"
import ThemeProvider from "src/components/core/ThemeProvider"
import { lightTheme, Theme } from "src/theme"

export function mount<C extends Component, P = C["props"], S = C["state"]>(
  node: ReactElement<P>,
  options?: MountRendererProps,
  theme?: Theme
): ReactWrapper<P, S, C> {
  const opts: MountRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeMount(node, opts)
}

export function shallow<C extends Component, P = C["props"], S = C["state"]>(
  node: ReactElement<P>,
  options?: ShallowRendererProps,
  theme?: Theme
): ShallowWrapper<P, S, C> {
  const opts: ShallowRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || lightTheme.emotion,
    },
  }

  return enzymeShallow(node, opts)
}

const RenderWrapper: FC = ({ children }) => {
  return <ThemeProvider theme={lightTheme.emotion}>{children}</ThemeProvider>
}

/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our ThemeProvider.
 */
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "queries">
): RenderResult {
  return reactTestingLibraryRender(ui, {
    wrapper: RenderWrapper,
    ...options,
  })
}
