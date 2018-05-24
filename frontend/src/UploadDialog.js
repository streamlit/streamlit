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

import './UploadDialog.css';

function UploadDialog({ progress, url, onClose }) {
  let body = undefined;
  let footer = undefined;
  let isOpen = true;

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

export default UploadDialog;
