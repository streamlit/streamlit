import styled from "@emotion/styled"

export const StyledActionButtonContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,
  alignItems: "center",
  // line height should be the same as the icon size
  lineHeight: theme.iconSizes.md,
}))

export interface StyledActionButtonIconProps {
  icon: string
}

export const StyledActionButtonIcon = styled.div<StyledActionButtonIconProps>(
  ({ theme, icon }) => ({
    background: `url("${icon}") no-repeat center / contain`,

    // NOTE: We intentionally don't use any of the preset theme iconSizes here
    // so that icon scaling is unchanged from what we receive from the
    // withS4ACommunication hoc.
    width: "1rem",
    height: "1rem",
  })
)
