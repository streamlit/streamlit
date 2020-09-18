import React from "react"
import { styled } from "styletron-react"

import { MaterialIcon } from "components/shared/Icon"
import { IconButton } from "components/widgets/Button"
import { colors, spacingCalculator } from "lib/widgetTheme"
import { Small } from "components/shared/TextElements"

interface Props {
  className: string
  currentPage: number
  totalPages: number
  pageSize: number
  onNext: (event: React.SyntheticEvent<HTMLElement>) => void
  onPrevious: (event: React.SyntheticEvent<HTMLElement>) => void
}

const StyledPagination = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: spacingCalculator(0.25),
  marginBottom: spacingCalculator(0.25),
})

const Paginators = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: colors.secondary,
})

const Pagination = ({
  className,
  currentPage,
  totalPages,
  onNext,
  onPrevious,
}: Props) => {
  return (
    <StyledPagination className={className}>
      <Small>{`Showing page ${currentPage} of ${totalPages}`}</Small>
      <Paginators>
        <IconButton onClick={onPrevious}>
          <MaterialIcon icon="chevron_left" />
        </IconButton>
        <IconButton onClick={onNext}>
          <MaterialIcon icon="chevron_right" />
        </IconButton>
      </Paginators>
    </StyledPagination>
  )
}

export default Pagination
