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
          <svg viewBox="0 0 8 8" width="1em" className="streamlit-upload-check">
            <use xlinkHref={'./open-iconic.min.svg#check'} />
          </svg>
          Copied report URL to clipboard.
        </div>
        <div id="streamlit-upload-url"> {url} </div>
      </ModalBody>
    );
    footer = (
      <ModalFooter>
        <CopyToClipboard text={url} onCopy={onClose}>
          <Button color="primary">Copy</Button>
        </CopyToClipboard>{' '}
        <Button color="secondary" onClick={onClose}>Done</Button>
      </ModalFooter>
    );
  } else if (progress !== undefined) {
    body = (
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Uploading the report...
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
      <ModalHeader toggle={onClose}>Report Upload</ModalHeader>
      { body }
      { footer }
    </Modal>
  );
}

export default UploadDialog;
