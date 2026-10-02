import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Item = {
  id: string;
  kind: string;
  category: string;
  title: string;
  summary: string | null;
  content: string | null;
  tags: string[];
  created_at: string;
};

const ExportInput = z.object({
  format: z.enum(["json", "markdown", "txt", "csv", "pdf", "docx"]),
  kinds: z.array(z.string()).nullable().default(null),
});

export const exportMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("memory_items")
      .select("id, kind, category, title, summary, content, tags, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.kinds && data.kinds.length > 0) query = query.in("kind", data.kinds as never);
    const { data: items, error } = await query;
    if (error) throw error;
    const rows = (items ?? []) as Item[];

    let body: string | Uint8Array;
    let mime: string;
    let ext: string;

    if (data.format === "json") {
      body = JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, items: rows }, null, 2);
      mime = "application/json";
      ext = "json";
    } else if (data.format === "markdown") {
      body = rows
        .map(
          (r) =>
            `# ${r.title}\n\n- **kind**: ${r.kind}\n- **category**: ${r.category}\n- **created**: ${r.created_at}\n- **tags**: ${(r.tags || []).join(", ")}\n\n${r.summary ? `> ${r.summary}\n\n` : ""}${r.content ?? ""}\n\n---\n`,
        )
        .join("\n");
      mime = "text/markdown";
      ext = "md";
    } else if (data.format === "txt") {
      body = rows
        .map((r) => `[${r.created_at}] (${r.kind}) ${r.title}\n${r.content ?? r.summary ?? ""}\n`)
        .join("\n----------\n");
      mime = "text/plain";
      ext = "txt";
    } else if (data.format === "csv") {
      const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
      const header = "id,kind,category,title,summary,tags,created_at\n";
      body =
        header +
        rows
          .map((r) =>
            [r.id, r.kind, r.category, r.title, r.summary ?? "", (r.tags || []).join("|"), r.created_at]
              .map(String)
              .map(esc)
              .join(","),
          )
          .join("\n");
      mime = "text/csv";
      ext = "csv";
    } else if (data.format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("VIHAR.AI Memory Export", 40, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Exported ${new Date().toLocaleString()} · ${rows.length} items`, 40, 68);
      let y = 100;
      for (const r of rows) {
        if (y > 760) {
          doc.addPage();
          y = 50;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const titleLines = doc.splitTextToSize(r.title, 520);
        doc.text(titleLines, 40, y);
        y += titleLines.length * 14 + 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`${r.kind} · ${r.category} · ${new Date(r.created_at).toLocaleString()}`, 40, y);
        y += 14;
        const text = (r.content ?? r.summary ?? "").slice(0, 1200);
        if (text) {
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(text, 520);
          if (y + lines.length * 12 > 780) {
            doc.addPage();
            y = 50;
          }
          doc.text(lines, 40, y);
          y += lines.length * 12 + 14;
        }
      }
      const ab = doc.output("arraybuffer");
      body = new Uint8Array(ab);
      mime = "application/pdf";
      ext = "pdf";
    } else {
      // docx
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
      const children = rows.flatMap((r) => [
        new Paragraph({ text: r.title, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [
            new TextRun({ text: `${r.kind} · ${r.category} · ${new Date(r.created_at).toLocaleString()}`, italics: true, size: 18 }),
          ],
        }),
        ...(r.summary
          ? [new Paragraph({ children: [new TextRun({ text: r.summary, bold: true })] })]
          : []),
        ...(r.content ? r.content.split("\n").map((ln) => new Paragraph(ln)) : []),
        new Paragraph(""),
      ]);
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: "VIHAR.AI Memory Export", heading: HeadingLevel.TITLE }),
              new Paragraph(`Exported ${new Date().toLocaleString()} — ${rows.length} items`),
              new Paragraph(""),
              ...children,
            ],
          },
        ],
      });
      const buf = await Packer.toBuffer(doc);
      body = new Uint8Array(buf);
      mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      ext = "docx";
    }

    const filename = `vihar-memory-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
    const path = `${userId}/exports/${filename}`;
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    const { error: upErr } = await supabase.storage.from("memory-uploads").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) throw upErr;
    const { data: signed, error: sErr } = await supabase.storage
      .from("memory-uploads")
      .createSignedUrl(path, 60 * 10);
    if (sErr) throw sErr;
    return { url: signed.signedUrl, filename, mime, count: rows.length };
  });

export const importMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        json: z.string().min(2).max(10_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const parsed = JSON.parse(data.json) as { items: Item[] };
    if (!Array.isArray(parsed.items)) throw new Error("invalid format");
    const rows = parsed.items.map((it) => ({
      user_id: context.userId,
      kind: it.kind,
      category: it.category ?? "other",
      title: it.title?.slice(0, 500) ?? "Imported",
      summary: it.summary?.slice(0, 2000) ?? null,
      content: it.content ?? null,
      tags: it.tags ?? [],
      source_table: "import",
      metadata: { imported_at: new Date().toISOString() },
    }));
    const { error } = await context.supabase.from("memory_items").insert(rows as never);
    if (error) throw error;
    return { ok: true, imported: rows.length };
  });
