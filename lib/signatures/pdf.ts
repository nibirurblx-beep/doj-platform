import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NAVY = rgb(0.078, 0.149, 0.247);
const GOLD = rgb(0.639, 0.522, 0.173);
const GREY = rgb(0.35, 0.39, 0.45);

export interface SignatureStamp {
  signerName: string;
  employeeNumber: string;
  rank: string | null;
  organisationName: string;
  documentTitle: string;
  requestId: string;
  signaturePng: Uint8Array;
  signedAtIso: string;
}

/**
 * Appends a signature certificate page to the PDF. The certificate carries
 * the authoritative signer details and supersedes any unsigned placeholder
 * lines in the document body - the honest workaround for editing arbitrary
 * PDF text, which cannot be done reliably.
 */
export async function appendSignatureCertificate(
  originalPdf: Uint8Array,
  stamp: SignatureStamp,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdf, { ignoreEncryption: true });
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const signatureImage = await pdf.embedPng(stamp.signaturePng);

  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 64;
  let y = height - 90;

  // Header band
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: GOLD });
  page.drawText("SIGNATURE CERTIFICATE", {
    x: margin,
    y,
    size: 22,
    font: serifBold,
    color: NAVY,
  });
  y -= 18;
  page.drawText("Department of Justice Roleplay Community", {
    x: margin,
    y,
    size: 10,
    font: serif,
    color: GREY,
  });
  y -= 30;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: GOLD,
  });
  y -= 34;

  const row = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: serifBold,
      color: GREY,
    });
    page.drawText(value, {
      x: margin,
      y: y - 15,
      size: 13,
      font: serif,
      color: NAVY,
    });
    y -= 44;
  };

  row("Document", stamp.documentTitle);
  row("Signed by", stamp.signerName);
  row(
    "Employee",
    `${stamp.employeeNumber}${stamp.rank ? ` \u00b7 ${stamp.rank}` : ""} \u00b7 ${stamp.organisationName}`,
  );
  row(
    "Date and time",
    new Date(stamp.signedAtIso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC",
  );

  // Signature box
  y -= 6;
  page.drawText("SIGNATURE", {
    x: margin,
    y,
    size: 8,
    font: serifBold,
    color: GREY,
  });
  y -= 110;
  const boxWidth = 260;
  const boxHeight = 96;
  page.drawRectangle({
    x: margin,
    y,
    width: boxWidth,
    height: boxHeight,
    borderColor: NAVY,
    borderWidth: 1,
  });
  const dims = signatureImage.scaleToFit(boxWidth - 20, boxHeight - 16);
  page.drawImage(signatureImage, {
    x: margin + (boxWidth - dims.width) / 2,
    y: y + (boxHeight - dims.height) / 2,
    width: dims.width,
    height: dims.height,
  });
  y -= 40;

  // Statement
  const statement =
    "Signed electronically through the community portal. This certificate " +
    "page forms part of the document and records the signer, so it applies " +
    "regardless of any unsigned placeholder lines in the body. " +
    `Reference: ${stamp.requestId}`;
  const words = statement.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (serif.widthOfTextAtSize(candidate, 9) > width - margin * 2) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  for (const l of lines) {
    page.drawText(l, { x: margin, y, size: 9, font: serif, color: GREY });
    y -= 13;
  }

  return pdf.save();
}
