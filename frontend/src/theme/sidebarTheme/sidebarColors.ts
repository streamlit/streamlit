import { transparentize } from "color2k"
import { colors } from "../primitives/colors"

const genericColors = {
  ...colors,
  bodyText: colors.gray90,
  danger: "#9d292d",
  info: "#1e6777",
  success: "#176c36",
  warning: "#947c2d",
  primary: "#f63366",
  accent: colors.gray90,
  secondary: colors.gray60,
  disabled: colors.gray30,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green80,
  yellow: colors.yellow80,
  bgColor: "white",
}

export default {
  ...genericColors,
  // Alerts
  alertErrorBorderColor: transparentize(genericColors.red, 0.8),
  alertErrorBackgroundColor: transparentize(genericColors.red, 0.8),
  alertErrorTextColor: genericColors.danger,
  alertInfoBorderColor: transparentize(genericColors.blue, 0.9),
  alertInfoBackgroundColor: transparentize(genericColors.blue, 0.9),
  alertInfoTextColor: genericColors.info,
  alertSuccessBorderColor: transparentize(genericColors.green, 0.8),
  alertSuccessBackgroundColor: transparentize(genericColors.green, 0.8),
  alertSuccessTextColor: genericColors.success,
  alertWarningBorderColor: transparentize(genericColors.yellow, 0.2),
  alertWarningBackgroundColor: transparentize(genericColors.yellow, 0.8),
  alertWarningTextColor: genericColors.warning,

  docStringHeaderBorder: "#e6e9ef",
  docStringModuleText: "#444444",
  docStringContainerBackground: "#f0f3f9",

  tableGray: colors.gray40,
}
