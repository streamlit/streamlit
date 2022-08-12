import { transparentize } from "color2k"
import { colors } from "../primitives/colors"

export default {
  ...colors,
  bgColor: colors.gray100,
  secondaryBg: colors.gray90,
  bodyText: colors.gray10,
  warning: colors.yellow20,
  warningBg: transparentize(colors.yellow70, 0.8),
  success: colors.green10,
  successBg: transparentize(colors.green60, 0.8),
  info: colors.blue20,
  infoBg: transparentize(colors.blue60, 0.8),
  danger: colors.red20,
  dangerBg: transparentize(colors.red60, 0.8),
  primary: colors.red70,
  disabled: colors.gray70,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green80,
  yellow: colors.yellow80,
}
