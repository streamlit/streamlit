/**
 * Represents some text in a div.
 */

import React from 'react';
import './Div.css';

 /**
  * Functional element representing some text in a div.
  */
 const Div = ({element, width}) => (
   <div className={element.get('classes')} style={{width}}>
     {element.get('text').replace('\r', '').split('\n').map((line, indx) => (
       <div key={indx}>
         {
           // Replace spaces with unicode nonbreaking spaces.
           line /*.replace(/ /g, '\u2007')*/
         }
       </div>
     ))}
   </div>
 )

export default Div;
