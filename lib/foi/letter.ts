import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FOI_EXEMPTIONS } from "./constants";

const NAVY = rgb(0.078, 0.149, 0.247);
const GOLD = rgb(0.639, 0.522, 0.173);
const GREY = rgb(0.35, 0.39, 0.45);

export interface FoiLetterData {
  reference: string;
  status: string;
  requesterName: string;
  organisationName: string;
  description: string;
  submittedAtIso: string;
  decidedAtIso: string | null;
  decisionNote: string | null;
  denialExemptions: string[] | null;
  appealNote: string | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Formal PDF decision letter, generated on demand from the request record
 *  - satisfies the act's requirement that decisions are delivered in PDF. */
export async function generateFoiLetter(data: FoiLetterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 68;
  let y = height - 76;

  const wrap = (text: string, size: number, font = serif) => {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width - margin * 2) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      lines.push(line);
    }
    return lines;
  };

  const draw = (text: string, size: number, font = serif, color = NAVY, gap = 4) => {
    for (const line of wrap(text, size, font)) {
      if (y < 80) {
        page = pdf.addPage([595.28, 841.89]);
        y = height - 76;
      }
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + gap;
    }
  };

  // Letterhead
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: GOLD });
  draw("DEPARTMENT OF JUSTICE", 20, serifBold);
  draw("Roleplay Community \u00b7 Freedom of Information Programme", 9, serif, GREY, 10);
  page.drawLine({
    start: { x: margin, y: y + 2 },
    end: { x: width - margin, y: y + 2 },
    thickness: 1,
    color: GOLD,
  });
  y -= 22;

  const isAppeal = data.status.startsWith("appeal");
  const granted = data.status === "completed" || data.status === "appeal_completed";
  const heading = isAppeal
    ? granted
      ? "APPEAL DECISION - GRANTED"
      : "APPEAL DECISION - DENIED"
    : granted
      ? "DECISION - REQUEST COMPLETED"
      : "DECISION - REQUEST DENIED";

  draw(heading, 14, serifBold, NAVY, 12);
  draw(`Reference: ${data.reference}`, 11, serif, GREY);
  draw(`Requester: ${data.requesterName}`, 11, serif, GREY);
  draw(`Agency: ${data.organisationName}`, 11, serif, GREY);
  draw(`Submitted: ${fmt(data.submittedAtIso)}`, 11, serif, GREY);
  if (data.decidedAtIso) draw(`Decided: ${fmt(data.decidedAtIso)}`, 11, serif, GREY, 14);

  draw("Request", 11, serifBold, NAVY, 6);
  draw(data.description, 11, serif, NAVY, 12);

  draw(isAppeal ? "Appeal outcome" : "Decision", 11, serifBold, NAVY, 6);
  draw((isAppeal ? data.appealNote : data.decisionNote) ?? "", 11, serif, NAVY, 12);

  if (!isAppeal && !granted && (data.denialExemptions ?? []).length > 0) {
    draw("Statutory exemption(s) relied upon", 11, serifBold, NAVY, 6);
    for (const key of data.denialExemptions ?? []) {
      const label = FOI_EXEMPTIONS.find((e) => e.key === key)?.label ?? "";
      draw(`(${key}) ${label}`, 10, serif, NAVY, 5);
    }
    y -= 8;
    draw(
      "You may appeal this decision to the agency through the Freedom of Information page. If the appeal is denied, the act provides for a civil suit in the United States District Court.",
      10,
      serif,
      GREY,
    );
  }
  if (isAppeal && !granted) {
    draw(
      "This appeal decision is final at agency level. The act provides for a civil suit in the United States District Court.",
      10,
      serif,
      GREY,
    );
  }

  return pdf.save();
}
