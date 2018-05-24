import React from 'react';

import {
  // Alert,
  Button,
  // Col,
  // Container,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
  // Row,
  // UncontrolledTooltip,
} from 'reactstrap';

import {CopyToClipboard} from 'react-copy-to-clipboard';

// import { fromJS } from 'immutable';
// import url from 'url';
//
// // Display Elements
// import DataFrame from './elements/DataFrame';
// import Chart from './elements/Chart';
// import ImageList from './elements/ImageList';
// import Text from './elements/Text';
// import DocString from './elements/DocString';
// import ExceptionElement from './elements/ExceptionElement';
// import Map from './elements/Map';
// import Table from './elements/Table';
//
// // Other local imports.
// import WebsocketConnection from './WebsocketConnection';
// import StaticConnection from './StaticConnection';
// import { ForwardMsg, BackMsg, Text as TextProto }
//   from './protobuf';
// import { addRows } from './dataFrameProto';
// import { toImmutableProto, dispatchOneOf }
//   from './immutableProto';

import './UploadDialog.css';

function UploadDialog({ progress, url, onClose }) {
  let body = undefined;
  let footer = undefined;
  let isOpen = true;

  console.log('UploadDialog')
  console.log('progress', progress)
  console.log('url', url)
  console.log('onClose', onClose)

  if (url !== undefined) {
    body = (
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Report saved to:
        </div>
        <div id="streamlit-upload-url"> {url} </div>
      </ModalBody>
    );
    footer = (
      <ModalFooter>
        <CopyToClipboard text={url} onCopy={onClose}>
          <Button>Copy to clipboard</Button>
        </CopyToClipboard>{' '}
        <Button onClick={onClose}>Done</Button>
      </ModalFooter>
    );
  } else if (progress !== undefined) {
    body = (
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Saving report...
        </div>
        <div>
          <Progress animated value={progress}/>
        </div>
      </ModalBody>
    );
  } else {
    isOpen = false;
  }

  return (
    <Modal isOpen={isOpen} toggle={onClose} className={""}>
      { body }
      { footer }
    </Modal>
  );
}

// function copyTextToClipboard(text) {
//   console.log('Trying to copy', text);
//   var textArea = document.createElement("textarea");
//   textArea.value = text;
//   document.body.appendChild(textArea);

//   try {
//   } catch (err) {
//     console.error('Fallback: Oops, unable to copy', err);
//   }
//
//   document.body.removeChild(textArea);
// }
//

export default UploadDialog;
