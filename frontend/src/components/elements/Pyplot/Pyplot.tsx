/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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


 import React, { ReactElement, useEffect, useRef } from 'react'
 import {
    Pyplot as PyplotProto
} from "src/autogen/proto"

export interface PyplotProps {
    element: PyplotProto
    width: number
}
 
export default function Pyplot(props: PyplotProps): ReactElement {
    const mpld3 = require('mpld3')
    const { element } = props
    let { id, json } = element
    const parsedJson = JSON.parse(json)
    const elementRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const divElement = elementRef.current;
        if (divElement !== null) {
            divElement.id = id
        }
        mpld3.draw_figure(id, parsedJson)
    }, [])
    return (
        <div ref={elementRef}></div>
    )
 }