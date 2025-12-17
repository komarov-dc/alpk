// Roboto Regular font with Cyrillic support in base64 format
// License: Apache License 2.0
// Source: Google Fonts (https://github.com/google/fonts)

import { robotoTTFBase64 } from "./roboto-ttf-base64";
import type { jsPDF } from "jspdf";

export function addRussianFont(doc: jsPDF): void {
  // Add Roboto font with Cyrillic support
  doc.addFileToVFS("Roboto-Regular.ttf", robotoTTFBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  // Also add as bold variant (using same font file for simplicity)
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
  doc.setFont("Roboto");
}
