<!--
Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# PDF.js Setup for React-PDF

This setup provides a local, CDN-free configuration for react-pdf with minimal file size impact.

## What's Included

- **PDF.js Worker**: Local worker file for PDF processing
- **cMaps**: Character maps for non-Latin characters support
- **Standard Fonts**: Standard PDF fonts for better compatibility
- **TypeScript Configuration**: Pre-configured setup for react-pdf

## Files Structure

```
src/
├── assets/
│   ├── cmaps/           # Character maps (copied from pdfjs-dist)
│   ├── standard_fonts/  # Standard PDF fonts (copied from pdfjs-dist)
│   └── pdf.worker.min.mjs # PDF.js worker (copied from pdfjs-dist)
├── utils/
│   └── pdfjs-config.ts  # PDF.js configuration
└── components/
    └── PdfViewer.tsx    # Example PDF viewer component
```

## Setup

1. **Copy PDF.js files** (run this after installing/updating pdfjs-dist):
   ```bash
   yarn setup-pdfjs
   ```

2. **Import the configuration** in your app entry point:
   ```typescript
   import './utils/pdfjs-config';
   ```

## Usage

### Basic PDF Viewer

```typescript
import React from 'react';
import { PdfViewer } from './components/PdfViewer';

function App() {
  return (
    <div>
      <PdfViewer
        file="path/to/your/file.pdf"
        width={800}
        height={600}
      />
    </div>
  );
}
```

### Custom Implementation

```typescript
import React, { useState } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfOptions } from './utils/pdfjs-config';

// Import required CSS
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

function MyPdfViewer({ file }: { file: string }) {
  const [numPages, setNumPages] = useState<number>();

  return (
    <Document
      file={file}
      options={pdfOptions}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      <Page pageNumber={1} />
    </Document>
  );
}
```

## Benefits

- **No CDN dependency**: All files are bundled locally
- **Optimal file size**: Only necessary files are included
- **Better performance**: No external network requests for PDF.js assets
- **Offline support**: Works without internet connection
- **Version consistency**: PDF.js version is locked with your dependencies

## File Sizes

- **cMaps**: ~2.5MB (compressed in build)
- **Standard Fonts**: ~1.2MB (compressed in build)
- **Worker**: ~1.3MB (compressed in build)

Total additional bundle size: ~5MB (before compression)

## Maintenance

When updating `react-pdf` or `pdfjs-dist`, run:

```bash
yarn setup-pdfjs
```

This ensures the local files stay in sync with the package versions.
