/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType, ReactNode, PureComponent } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"
import Pagination from "hocs/withPagination/Pagination"

export interface Props {
  className: string
  items: any[]
  pageSize: number
  resetOnAdd: boolean
}

interface State {
  currentPage: number
  pageSize: number
  totalPages: number
}

const withPagination = (
  WrappedComponent: ComponentType<any>
): ComponentType<any> => {
  class WithPagination extends PureComponent<Props, State> {
    public constructor(props: Props) {
      super(props)

      this.state = {
        currentPage: 0,
        pageSize: props.pageSize,
        totalPages: this.calculatePageSize(this.props.items),
      }
    }

    public componentDidUpdate(prevProps: Props): void {
      if (prevProps.items.length !== this.props.items.length) {
        const totalPages = this.calculatePageSize(this.props.items)

        let { currentPage } = this.state
        if (prevProps.items.length < this.props.items.length) {
          if (this.props.resetOnAdd) {
            currentPage = 0
          }
        } else if (currentPage + 1 >= totalPages) {
          currentPage = totalPages - 1
        }
        this.setState({
          totalPages,
          currentPage,
        })
      }
    }

    private calculatePageSize(items: any[]): number {
      return Math.ceil(items.length / this.props.pageSize)
    }

    public onNext = (): void => {
      this.setState({
        currentPage: Math.min(
          this.state.currentPage + 1,
          this.state.totalPages - 1
        ),
      })
    }

    public onPrevious = (): void => {
      this.setState({
        currentPage: Math.max(0, this.state.currentPage - 1),
      })
    }

    render(): ReactNode {
      const { pageSize, currentPage, totalPages } = this.state
      const { items, className, ...props } = this.props
      const paginatedItems = items.slice(
        currentPage * pageSize,
        currentPage * pageSize + pageSize
      )

      return (
        <>
          <WrappedComponent items={paginatedItems} {...props} />
          {items.length > 4 ? (
            <Pagination
              className={className}
              pageSize={pageSize}
              totalPages={totalPages}
              currentPage={currentPage + 1}
              onNext={this.onNext}
              onPrevious={this.onPrevious}
            />
          ) : null}
        </>
      )
    }
  }

  return hoistNonReactStatics(WithPagination, WrappedComponent)
}

export default withPagination
