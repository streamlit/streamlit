/**
 * Component display a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import { AutoSizer, MultiGrid } from 'react-virtualized';

/**
* Represents a Pandas Dataframe on the screen.
*/
// class DataFrame extends PureComponent {
//   constructor(props) {
//     super(props);
//     this._cellRenderer = this._cellRenderer.bind(this)
//   }
//
//   render() {
//     const height = 300;
//     const border = 2;
//     return (
//       <div style={{height}}>
//         <AutoSizer>
//             {({width}) => (
//               <div style={{width:width, border:'1px solid black'}}>
//                 <MultiGrid
//                   className="dataFrame"
//                   cellRenderer={this._cellRenderer}
//                   fixedColumnCount={1}
//                   fixedRowCount={1}
//                   columnWidth={({index}) => {
//                     return 30 + 2 * index;
//                   }}
//                   columnCount={50}
//                   enableFixedColumnScroll
//                   enableFixedRowScroll
//                   height={height}
//                   rowHeight={30}
//                   rowCount={50}
//                   width={width - border}
//                 />
//             </div>
//           )}
//         </AutoSizer>
//       </div>
//     );
//   }
//
//   // Renders out each cell
//   _cellRenderer({columnIndex, key, rowIndex, style}) {
//     let backgroundColor = '#ddd';
//     if ((columnIndex + rowIndex) % 2 === 0) {
//       backgroundColor = '#eee';
//     }
//     const the_style = {
//       ...style,
//       // width: 75,
//       // height: 40,
//       // border: '1px solid black',
//       backgroundColor: backgroundColor
//     };
//     return (
//       <div key={key} style={the_style}>
//         {columnIndex}, {rowIndex}, {key}
//       </div>
//     );
//   }
// }

 /**
  * Functional element representing a DataFrame.
  */
const DataFrame = ({element}) => {
  console.log('Rendering this DataFrame');
  console.log('MAKE SURE THIS DOESNT HAPPEN TOO OFTEN!')
  return (
    <div style={{'backgroundColor': 'lightBlue'}}>
      <div>
        This is a DataFrame.
      </div>
      <div>
        {JSON.stringify(element)}
      </div>
    </div>
  );
};

export default DataFrame;
