import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, ErrorText } from '../../components/ui.jsx';
import { parseIndentFile, classifyRecords } from '../../utils/excel.js';
import { saveImport, watchImportHistory } from '../../services/db.js';
import { fmtDate, fmtDateTime } from '../../utils/dates.js';

const TABS = [
  { id: 'all', label: 'All rows' },
  { id: 'new', label: 'New' },
  { id: 'update', label: 'Updated' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'invalid', label: 'Invalid' },
];
const CAT_STYLE = {
  new: 'text-emerald-700', update: 'text-sky-700', duplicate: 'text-steel', invalid: 'text-red-700',
};
const CAT_LABEL = { new: 'New', update: 'Update', duplicate: 'Duplicate', invalid: 'Invalid' };

function History() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => watchImportHistory(setRows, (e) => setErr(e.message)), []);
  return (
    <section className="panel mt-8 overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 font-semibold">Import history</h2>
      {err && <p className="px-4 py-3 text-sm text-red-700">{err}</p>}
      {!rows.length ? (
        <p className="px-4 py-6 text-sm text-steel">No imports yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="th">When</th><th className="th">File</th><th className="th">Imported by</th>
                <th className="th text-right">Rows</th><th className="th text-right">New</th><th className="th text-right">Updated</th>
                <th className="th text-right">Duplicate</th><th className="th text-right">Invalid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="td whitespace-nowrap">{fmtDateTime(h.importedAt)}</td>
                  <td className="td">{h.fileName}</td>
                  <td className="td">{h.importedBy}</td>
                  <td className="td text-right">{h.totalRows}</td>
                  <td className="td text-right">{h.newRows}</td>
                  <td className="td text-right">{h.updatedRows}</td>
                  <td className="td text-right">{h.duplicateRows ?? '—'}</td>
                  <td className={`td text-right ${h.invalidRows ? 'text-red-700' : ''}`}>{h.invalidRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ImportPage() {
  const { profile } = useAuth();
  const { indents, loaded } = useData();
  const [stage, setStage] = useState('idle'); // idle | parsing | preview | saving | done
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('all');
  const [summary, setSummary] = useState(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, update: 0, duplicate: 0, invalid: 0 };
    rows.forEach((r) => c[r.category]++);
    return c;
  }, [rows]);
  const visible = tab === 'all' ? rows : rows.filter((r) => r.category === tab);

  async function handle(f) {
    if (!f) return;
    setErr('');
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return setErr('Choose an Excel file (.xlsx or .xls) or a .csv export.');
    setStage('parsing');
    setFile(f);
    try {
      const result = await parseIndentFile(f);
      if (!result.records.length) throw new Error('The file has a header row but no data rows.');
      const existing = new Map(indents.map((i) => [i.id, i]));
      setParsed(result);
      setRows(classifyRecords(result.records, existing));
      setTab('all');
      setStage('preview');
    } catch (e) {
      setErr(e.message);
      setStage('idle');
    }
  }

  async function save() {
    setStage('saving');
    setErr('');
    try {
      setSummary(await saveImport(rows, file.name, profile));
      setStage('done');
    } catch (e) {
      setErr(`Saving failed: ${e.message}`);
      setStage('preview');
    }
  }

  function reset() {
    setStage('idle'); setFile(null); setParsed(null); setRows([]); setSummary(null); setErr('');
  }

  const toSave = counts.new + counts.update;

  return (
    <div>
      <PageHeader title="Import NetSuite Excel" subtitle="Upload the Purchase Requisition export. You can check every row before anything is saved." />

      {(stage === 'idle' || stage === 'parsing') && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${drag ? 'border-teal bg-teal-light' : 'border-line bg-white hover:border-steel'}`}
        >
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={!loaded || stage === 'parsing'} onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="text-base font-medium">{stage === 'parsing' ? 'Reading file…' : 'Drop the Excel file here, or click to choose'}</span>
          <span className="mt-1 text-sm text-steel">.xlsx, .xls or .csv. Needs at least the Document Number, Item and Date columns.</span>
          {!loaded && <span className="mt-2 text-xs text-steel">Loading existing indents…</span>}
        </label>
      )}

      <div className="mt-4"><ErrorText>{err}</ErrorText></div>

      {(stage === 'preview' || stage === 'saving') && parsed && (
        <div className="space-y-4">
          <div className="panel p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><span className="font-medium">{file.name}</span><span className="text-steel">, sheet "{parsed.sheetName}", headers on row {parsed.headerRow}</span></div>
              <button className="btn-ghost" onClick={reset}>Choose another file</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {parsed.detected.map((d) => (
                <span key={d.field} className={d.header ? 'text-steel' : 'text-amber-700'}>
                  {d.label}: {d.header ? <span className="text-ink">found</span> : 'not found'}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-teal font-medium text-ink' : 'border-transparent text-steel hover:text-ink'}`}>
                {t.label} <span className="tabular-nums">({counts[t.id]})</span>
              </button>
            ))}
          </div>

          <div className="panel overflow-hidden">
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas">
                  <tr>
                    <th className="th">Row</th><th className="th">Result</th><th className="th">Document Number</th><th className="th">Item</th>
                    <th className="th">Display Name</th><th className="th text-right">Qty</th><th className="th">Date</th><th className="th">Status</th><th className="th">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.slice(0, 500).map((r) => (
                    <tr key={r.rowNumber} className={r.category === 'invalid' ? 'bg-red-50/60' : ''}>
                      <td className="td tabular-nums text-steel">{r.rowNumber}</td>
                      <td className={`td font-medium ${CAT_STYLE[r.category]}`}>{CAT_LABEL[r.category]}</td>
                      <td className="td whitespace-nowrap">{r.documentNumber || '—'}</td>
                      <td className="td whitespace-nowrap">{r.itemCode || '—'}</td>
                      <td className="td min-w-[200px]">{r.displayName}</td>
                      <td className="td text-right tabular-nums">{r.quantity ?? ''} {r.units}</td>
                      <td className="td whitespace-nowrap tabular-nums">{fmtDate(r.date)}</td>
                      <td className="td whitespace-nowrap">{r.netsuiteStatus}</td>
                      <td className="td min-w-[220px] text-xs text-steel">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length > 500 && <p className="px-4 py-3 text-xs text-steel">Showing the first 500 of {visible.length} rows. All rows will be saved.</p>}
              {!visible.length && <p className="px-4 py-6 text-sm text-steel">No rows in this group.</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-steel">
              {counts.new} new and {counts.update} updated rows will be saved. Updates change only NetSuite fields; assignment, dates and remarks stay as they are.
              {counts.invalid > 0 && ` ${counts.invalid} invalid rows will be skipped.`}
            </p>
            <button className="btn-primary" disabled={!toSave || stage === 'saving'} onClick={save}>
              {stage === 'saving' ? 'Saving…' : toSave ? `Save ${toSave} rows` : 'Nothing new to save'}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && summary && (
        <div className="panel p-5">
          <h2 className="text-lg font-semibold">Import saved</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
            {[
              ['Total rows', summary.totalRows], ['New records', summary.newRows], ['Updated records', summary.updatedRows],
              ['Duplicate records', summary.duplicateRows], ['Invalid records', summary.invalidRows],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-steel">{k}</dt><dd className="text-2xl font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn-primary" to="/indents?assignee=__none">Assign new indents</Link>
            <button className="btn-secondary" onClick={reset}>Import another file</button>
          </div>
        </div>
      )}

      <History />
    </div>
  );
}
