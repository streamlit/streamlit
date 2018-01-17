/**
 * Represents some text in a div.
 */

import React from 'react';
import './Div.css';

 /**
  * Functional element representing some text in a div.
  */
 const Div = ({element}) => (
   <div className={element.classes}>
     {element.text.replace('\r', '').split('\n').map((line, indx) => (
       <div id={indx}>
         {line}
       </div>
     ))}
   </div>
 )

export default Div;
