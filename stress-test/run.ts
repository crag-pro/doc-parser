import { parse } from "../src/parsers/router.js";
import { readdir, stat, writeFile } from "fs/promises";
import { join, extname } from "path";

const EMA_DIR = "/Users/mite/work/crag-lmt/data/scraped/ema-guidelines";
const ICH_DIR = "/Users/mite/work/crag-lmt/data/scraped/ich";
const MBL_DIR = "/Users/mite/work/crag-lmt/doc-parser-data-files";
const OUT_DIR = "/Users/mite/work/doc-parser/stress-test";
const TIMEOUT_MS = 30_000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function pickSample() {
  const emaAll = await readdir(EMA_DIR);
  const ichAll = await readdir(ICH_DIR);

  const emaPdfs = shuffle(emaAll.filter(f => f.toLowerCase().endsWith(".pdf"))).slice(0, 30);
  const ichPdfs = shuffle(ichAll.filter(f => f.toLowerCase().endsWith(".pdf"))).slice(0, 10);
  const otherEma = emaAll.filter(f => !f.toLowerCase().endsWith(".pdf"));
  const otherIch = ichAll.filter(f => !f.toLowerCase().endsWith(".pdf"));

  return [
    ...emaPdfs.map(f => join(EMA_DIR, f)),
    ...ichPdfs.map(f => join(ICH_DIR, f)),
    ...otherEma.map(f => join(EMA_DIR, f)),
    ...otherIch.map(f => join(ICH_DIR, f)),
  ];
}

type DocResult = {
  file: string;
  ext: string;
  sizeBytes: number;
  status: "success" | "failure" | "timeout";
  durationMs: number;
  textLength: number;
  method?: string;
  pageCount?: number | null;
  sheetCount?: number;
  slideCount?: number;
  warnings: string[];
  error?: string;
  hasNonAscii: boolean;
  firstChars?: string;
  group?: string;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function main() {
  const sampled = await pickSample();
  const mblAll = await readdir(MBL_DIR);
  const mblFiles = mblAll.map(f => join(MBL_DIR, f));
  const files = [...mblFiles.map(f => ({ f, g: "mbl" })), ...sampled.map(f => ({ f, g: f.includes("/ich/") ? "ich" : "ema" }))];
  console.log(`Sampled ${files.length} files (mbl=${mblFiles.length})`);
  const results: DocResult[] = [];

  let idx = 0;
  for (const { f: file, g: group } of files) {
    idx++;
    const ext = extname(file).toLowerCase();
    process.stdout.write(`[${idx}/${files.length}] ${group} ${ext} ${file.split("/").pop()}\n`);
    let sizeBytes = 0;
    try { sizeBytes = (await stat(file)).size; } catch {}
    const start = Date.now();
    const base: DocResult = {
      file, ext, sizeBytes, status: "failure", durationMs: 0,
      textLength: 0, warnings: [], hasNonAscii: false, group,
    };
    try {
      const r = await withTimeout(parse(file, { enrich: false }), TIMEOUT_MS);
      base.status = "success";
      base.durationMs = Date.now() - start;
      base.textLength = r.text?.length ?? 0;
      base.method = r.method;
      base.pageCount = r.pageCount;
      base.warnings = r.warnings ?? [];
      if (r.metadata?.sheetCount) base.sheetCount = Number(r.metadata.sheetCount);
      if (r.metadata?.slideCount) base.slideCount = Number(r.metadata.slideCount);
      base.hasNonAscii = /[^\x00-\x7F]/.test(r.text ?? "");
      base.firstChars = (r.text ?? "").slice(0, 300);
      console.log(`OK  ${ext} ${(sizeBytes/1024).toFixed(0)}KB ${base.durationMs}ms textLen=${base.textLength}`);
    } catch (e: any) {
      base.durationMs = Date.now() - start;
      const msg = e?.message ?? String(e);
      base.status = msg.startsWith("timeout") ? "timeout" : "failure";
      base.error = msg;
      console.log(`ERR ${ext} ${(sizeBytes/1024).toFixed(0)}KB -> ${msg.slice(0,100)}`);
    }
    results.push(base);
    await writeFile(join(OUT_DIR, "progress.json"), JSON.stringify(results, null, 2));
  }

  // Aggregate
  const byExt: Record<string, DocResult[]> = {};
  for (const r of results) (byExt[r.ext] ||= []).push(r);

  const aggregate = {
    total: results.length,
    success: results.filter(r => r.status === "success").length,
    failure: results.filter(r => r.status === "failure").length,
    timeout: results.filter(r => r.status === "timeout").length,
    byExt: Object.fromEntries(
      Object.entries(byExt).map(([ext, rs]) => {
        const ok = rs.filter(r => r.status === "success");
        const totalBytes = ok.reduce((s, r) => s + r.sizeBytes, 0);
        const totalMs = ok.reduce((s, r) => s + r.durationMs, 0);
        return [ext, {
          count: rs.length,
          success: ok.length,
          successRate: rs.length ? ok.length / rs.length : 0,
          avgParseMs: ok.length ? totalMs / ok.length : 0,
          throughputMBs: totalMs ? (totalBytes / 1024 / 1024) / (totalMs / 1000) : 0,
        }];
      })
    ),
  };

  const slowest = [...results].filter(r => r.status === "success")
    .sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);

  const failures = results.filter(r => r.status !== "success");

  const warnCounts: Record<string, number> = {};
  for (const r of results) for (const w of r.warnings) warnCounts[w] = (warnCounts[w] || 0) + 1;

  const emptySuspects = results.filter(r =>
    r.status === "success" && r.textLength < 100 && r.sizeBytes > 100 * 1024);

  const bigSuccesses = results.filter(r => r.status === "success" && r.sizeBytes > 10 * 1024 * 1024);

  const nonAsciiCount = results.filter(r => r.hasNonAscii).length;

  const report = { aggregate, slowest, failures, warnCounts, emptySuspects, bigSuccesses, nonAsciiCount, results };
  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  // Markdown
  const fmt = (n: number) => n.toFixed(2);
  const short = (p: string) => p.split("/").pop();
  let md = `# Doc-Parser Stress Test Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## MBL Priority Files\n\n`;
  for (const r of results.filter(x => x.group === "mbl")) {
    md += `### ${short(r.file)}\n- Status: ${r.status} (${r.durationMs}ms)\n- Size: ${(r.sizeBytes/1024).toFixed(0)}KB\n- Text length: ${r.textLength}\n- Method: ${r.method ?? "-"}\n- Sheets: ${r.sheetCount ?? "-"} | Pages: ${r.pageCount ?? "-"}\n- Warnings: ${r.warnings.length ? r.warnings.join("; ") : "none"}\n${r.error ? `- Error: ${r.error}\n` : ""}- First 300 chars:\n\n\`\`\`\n${(r.firstChars ?? "").replace(/`/g,"'")}\n\`\`\`\n\n`;
  }
  md += `## Totals\n\n- Attempted: ${aggregate.total}\n- Success: ${aggregate.success}\n- Failure: ${aggregate.failure}\n- Timeout: ${aggregate.timeout}\n- Non-ASCII docs: ${nonAsciiCount}\n\n`;
  md += `## Per-Format Breakdown\n\n| Ext | Count | Success | Rate | Avg ms | MB/s |\n|---|---|---|---|---|---|\n`;
  for (const [ext, s] of Object.entries(aggregate.byExt)) {
    md += `| ${ext} | ${s.count} | ${s.success} | ${fmt(s.successRate*100)}% | ${fmt(s.avgParseMs)} | ${fmt(s.throughputMBs)} |\n`;
  }
  md += `\n## Top 10 Slowest Parses\n\n| File | Size KB | Duration ms |\n|---|---|---|\n`;
  for (const r of slowest) md += `| ${short(r.file)} | ${(r.sizeBytes/1024).toFixed(0)} | ${r.durationMs} |\n`;
  md += `\n## Failures (${failures.length})\n\n`;
  if (failures.length === 0) md += `None.\n`;
  for (const r of failures) md += `- **${short(r.file)}** (${r.status}, ${(r.sizeBytes/1024).toFixed(0)}KB): ${r.error}\n`;
  md += `\n## Warnings\n\n`;
  const sortedWarns = Object.entries(warnCounts).sort((a,b) => b[1]-a[1]);
  if (sortedWarns.length === 0) md += `None.\n`;
  for (const [w, c] of sortedWarns) md += `- (${c}) ${w}\n`;
  md += `\n## Empty-Result Suspects (success, size>100KB, text<100 chars)\n\n`;
  if (emptySuspects.length === 0) md += `None.\n`;
  for (const r of emptySuspects) md += `- ${short(r.file)} (${(r.sizeBytes/1024).toFixed(0)}KB, textLen=${r.textLength})\n`;
  md += `\n## Big Successes (>10MB)\n\n`;
  if (bigSuccesses.length === 0) md += `None.\n`;
  for (const r of bigSuccesses) md += `- ${short(r.file)} (${(r.sizeBytes/1024/1024).toFixed(1)}MB, ${r.durationMs}ms, textLen=${r.textLength})\n`;

  await writeFile(join(OUT_DIR, "report.md"), md);
  console.log(`\nWrote report.json and report.md to ${OUT_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
