import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolItem,
  MediaToolManifest,
  SelectedMedia,
} from "./types";
import { normalizeVisualMode } from "./visual-modes";

const VO_MAX = 160;

function truncate(text: string, max = VO_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function selectionLabel(sel: SelectedMedia): string {
  if (sel.result_id.startsWith("library:")) {
    const id = sel.result_id.slice("library:".length);
    const name = sel.title?.trim() || id;
    return `${name} (library)`;
  }
  const name =
    sel.title?.trim() ||
    sel.url.split("/").pop()?.split("?")[0] ||
    sel.result_id;
  return name;
}

function summarizeSelections(acq: ItemAcquisition): string {
  const picks = acq.queries.flatMap((q) => q.selections);
  if (picks.length === 0) return "—";
  const labels = picks.map(selectionLabel);
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} · +${labels.length - 2} more`;
}

function summarizeSearchQueries(item: MediaToolItem, acq: ItemAcquisition): string {
  const fromAcq = [
    ...new Set(acq.queries.map((q) => q.query.trim()).filter(Boolean)),
  ];
  const queries =
    fromAcq.length > 0 ? fromAcq : item.search_queries.filter(Boolean);
  if (queries.length === 0) return "—";
  return queries.map((q) => `- ${q}`).join("\n");
}

function summarizeAcquisition(item: MediaToolItem, acq: ItemAcquisition): string {
  const mode = normalizeVisualMode(acq.resolved_visual_mode);
  const parts: string[] = [
    acq.status,
    mode,
    acq.resolved_media_type,
  ];

  if (mode === "text_graphic" && acq.text_graphic) {
    parts.push(
      `${acq.text_graphic.type}/${acq.text_graphic.style}: "${truncate(acq.text_graphic.text, 60)}"`,
    );
  } else if (item.text_graphic && !acq.text_graphic) {
    parts.push(
      `${item.text_graphic.type}: "${truncate(item.text_graphic.text, 60)}"`,
    );
  }

  if (acq.effects.length > 0) {
    parts.push(`fx: ${acq.effects.join(", ")}`);
  }
  if (acq.transition) {
    parts.push(`in: ${acq.transition}`);
  }
  if (acq.notes.trim()) {
    parts.push(`note: ${truncate(acq.notes, 80)}`);
  }

  parts.push(`selected: ${summarizeSelections(acq)}`);

  return parts.join(" · ");
}

function formatCueSection(
  item: MediaToolItem,
  acq: ItemAcquisition | undefined,
): string {
  const lines: string[] = [`## ${item.id}`, ""];

  const vo = item.spoken.trim();
  lines.push(`**VO:** ${vo ? truncate(vo) : "_(no VO — title/tail)_"}`, "");

  if (acq) {
    lines.push(`**Acquisition:** ${summarizeAcquisition(item, acq)}`, "");
  } else {
    lines.push(
      `**Acquisition:** ${item.visual_mode} · ${item.media_type} · pending`,
      "",
    );
  }

  lines.push("**Search queries:**");
  if (acq) {
    lines.push(summarizeSearchQueries(item, acq));
  } else if (item.search_queries.length > 0) {
    lines.push(item.search_queries.map((q) => `- ${q}`).join("\n"));
  } else {
    lines.push("- —");
  }

  return lines.join("\n");
}

export function buildCuesMarkdown(
  manifest: MediaToolManifest,
  acquisition: MediaAcquisitionDocument,
  manifestPath?: string,
): string {
  const generated = new Date().toISOString().slice(0, 10);
  const header = [
    `# ${manifest.episode}`,
    "",
    manifestPath ? `Manifest: \`${manifestPath}\`` : null,
    `${manifest.items.length} cues · ${acquisition.completed_count} complete · exported ${generated}`,
    "",
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const sections = manifest.items.map((item) =>
    formatCueSection(item, acquisition.items[item.id]),
  );

  return `${header}${sections.join("\n\n---\n\n")}\n`;
}

export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function cuesMarkdownFilename(episode: string): string {
  const safe = episode.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return `${safe}-cues.md`;
}
