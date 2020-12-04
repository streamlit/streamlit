import { ReactElement } from "react"
import {
  mount as enzymeMount,
  shallow as enzymeShallow,
  ShallowRendererProps,
  MountRendererProps,
  ShallowWrapper,
  ReactWrapper,
} from "enzyme" // eslint-disable-line import/no-extraneous-dependencies
import { mainTheme, Theme } from "theme"
import ThemeProvider from "components/core/ThemeProvider"

export function mount(
  arg: ReactElement,
  options?: MountRendererProps,
  theme?: Theme
): ReactWrapper {
  const opts: MountRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || mainTheme,
    },
  }

  return enzymeMount(arg, opts)
}

export function shallow(
  arg: ReactElement,
  options?: ShallowRendererProps,
  theme?: Theme
): ShallowWrapper {
  const opts: ShallowRendererProps = {
    ...(options || {}),
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: theme || mainTheme,
    },
  }

  return enzymeShallow(arg, opts)
}
