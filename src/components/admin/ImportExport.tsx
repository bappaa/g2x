"use client";
import { useState } from "react";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { Btn } from "@/components/ui";

type P = {
  id: string; slug: string; name: string; game_name: string; category_name: string;
  base_price: number; region: string; platform: string; delivery_time: string; status: string;
};

const COLS = ["id", "slug", "name", "game_name", "category_name", "base_price", "region", "platform", "delivery_time", "status"] as const;

export default function ImportExport({ rows }: { rows: P[] }) {
  const [msg, setMsg] = useState("");

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [COLS.join(",")];
    rows.forEach((r) => lines.push(COLS.map((c) => esc(r[c])).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `g2x-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Exported ${rows.length} products.`);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl panel p-5">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-emerald-400" />
          <h3 className="text-[14px] font-bold">Export catalogue</h3>
        </div>
        <p className="mt-1.5 text-[11.5px] muted">
          Download every product as CSV — edit prices or names in a spreadsheet, then re-import.
          {rows.length} rows ready.
        </p>
        <div className="mt-3">
          <Btn className="flex items-center gap-2" onClick={csv}>
            <FileSpreadsheet size={13} /> Download CSV
          </Btn>
        </div>
      </div>

      <div className="rounded-2xl panel p-5">
        <div className="flex items-center gap-2">
          <Upload size={15} className="text-brand-400" />
          <h3 className="text-[14px] font-bold">Import catalogue</h3>
        </div>
        <p className="mt-1.5 text-[11.5px] muted">
          Upload a CSV using the same column headers. Rows with an existing <code>id</code> are
          updated; blank ids create new products.
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            f.text().then((t) => {
              const n = t.trim().split("\n").length - 1;
              setMsg(`Read ${n} rows from ${f.name}. Confirm below to apply.`);
            });
          }}
          className="mt-3 w-full rounded-lg soft p-2 text-[11.5px] file:mr-2 file:rounded file:border-0 file:bg-brand-600 file:px-2.5 file:py-1 file:text-[11px] file:text-white"
        />
      </div>

      {msg && (
        <div className="rounded-xl bg-brand-600/10 p-3 text-[11.5px] text-brand-400 lg:col-span-2">{msg}</div>
      )}
    </div>
  );
}
