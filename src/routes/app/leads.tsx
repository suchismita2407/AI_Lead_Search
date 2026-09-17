import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { createLead, importLeadsCsv, listArchivedLeads, listLeads } from "~/lib/leads";
import type { ImportLeadsResult } from "~/lib/leads";
import { BANDS } from "~/lib/scoring";
import type { LeadBand } from "~/lib/scoring";

export const Route = createFileRoute("/app/leads")({
  head: () => ({
    meta: [{ title: "DealFlow AI · Leads" }],
  }),
  loader: async () => ({
    leads: await listLeads(),
    archived: await listArchivedLeads(),
  }),
  component: LeadsPage,
});

const bandBadge: Record<LeadBand, string> = {
  HOT: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  WARM: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  NURTURE:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const bandDot: Record<LeadBand, string> = {
  HOT: "bg-red-500",
  WARM: "bg-amber-500",
  NURTURE: "bg-blue-500",
  LOW: "bg-gray-400",
};

function LeadsPage() {
  const router = useRouter();
  const { leads, archived } = Route.useLoaderData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportLeadsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [tab, setTab] = useState<LeadBand | "ALL" | "ARCHIVED">("ALL");
  const [query, setQuery] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);
  const [singleLead, setSingleLead] = useState({ ownerName: "", address: "", city: "", state: "", zip: "", propertyType: "", estimatedValue: "", estimatedEquity: "", ownershipYears: "", vacancy: false, needsWork: false, distress: false, absenteeOwner: false, listingWithdrawal: false });

  const counts = BANDS.reduce<Record<LeadBand, number>>(
    (acc, band) => {
      acc[band] = leads.filter((l) => l.band === band).length;
      return acc;
    },
    { HOT: 0, WARM: 0, NURTURE: 0, LOW: 0 },
  );

  async function handleAnalyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const res = await importLeadsCsv({ data: { csv: text } });
      setSummary(res);
      await router.invalidate();
    } catch {
      setError(
        "Upload failed. Check that the file is a valid CSV and try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    setFileLabel(file ? file.name : null);
  }

  function numberOrNull(value: string) {
    if (!value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  async function handleAddLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingLead) return;
    setAddingLead(true);
    setAddLeadError(null);
    try {
      const res = await createLead({ data: {
        ...singleLead,
        estimatedValue: numberOrNull(singleLead.estimatedValue),
        estimatedEquity: numberOrNull(singleLead.estimatedEquity),
        ownershipYears: numberOrNull(singleLead.ownershipYears),
      } });
      if ("error" in res) setAddLeadError(res.error);
      else {
        setSingleLead({ ownerName: "", address: "", city: "", state: "", zip: "", propertyType: "", estimatedValue: "", estimatedEquity: "", ownershipYears: "", vacancy: false, needsWork: false, distress: false, absenteeOwner: false, listingWithdrawal: false });
        setShowAddLead(false);
        await router.invalidate();
      }
    } catch {
      setAddLeadError("Could not add the lead. Try again.");
    } finally {
      setAddingLead(false);
    }
  }

  const source = tab === "ARCHIVED" ? archived : leads;
  const filtered = source.filter((lead) => {
    if (tab !== "ALL" && tab !== "ARCHIVED" && lead.band !== tab) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [lead.owner_name, lead.property_address, lead.city].some((v) =>
      (v ?? "").toLowerCase().includes(q),
    );
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Leads
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload a seller list, get it scored by screening signals, and work
            the hot ones first.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => { setShowAddLead((value) => !value); setAddLeadError(null); }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {showAddLead ? "Close form" : "+ Add single lead"}
          </button>
          <a href="/sample-leads.csv" download="sample-leads.csv" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">↓ Download sample CSV</a>
        </div>
      </div>

      {showAddLead ? (
        <form onSubmit={handleAddLead} className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add one lead</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Enter only information you lawfully collected or the owner provided. Screening flags are your hypotheses, not verified facts.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([['ownerName','Owner name','Jane Smith'], ['address','Property address *','123 Main St'], ['city','City *','Austin'], ['state','State *','TX'], ['zip','ZIP code','78701'], ['propertyType','Property type','Single-family']] as const).map(([key, label, placeholder]) => (
              <label key={key} className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}
                <input value={singleLead[key]} onChange={(e) => setSingleLead((value) => ({ ...value, [key]: e.target.value }))} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </label>
            ))}
            {([['estimatedValue','Estimated value'], ['estimatedEquity','Estimated equity'], ['ownershipYears','Years owned']] as const).map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}
                <input type="number" min="0" value={singleLead[key]} onChange={(e) => setSingleLead((value) => ({ ...value, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </label>
            ))}
          </div>
          <fieldset className="mt-4"><legend className="text-xs font-semibold text-gray-600 dark:text-gray-300">Your screening observations</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {([['vacancy','Vacant'], ['needsWork','Needs work'], ['distress','Distress signal'], ['absenteeOwner','Absentee owner'], ['listingWithdrawal','Recent listing withdrawal']] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300"><input type="checkbox" checked={singleLead[key]} onChange={(e) => setSingleLead((value) => ({ ...value, [key]: e.target.checked }))} />{label}</label>)}
          </div></fieldset>
          {addLeadError ? <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{addLeadError}</p> : null}
          <button disabled={addingLead} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{addingLead ? "Adding…" : "Add and score lead"}</button>
        </form>
      ) : null}

      {/* Upload control */}
      <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            <span className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
              Choose CSV
            </span>
          </label>
          <span className="max-w-[16rem] truncate text-sm text-gray-500 dark:text-gray-400">
            {fileLabel ?? "No file selected"}
          </span>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={uploading || !fileLabel}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Analyzing…" : "Analyze leads"}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Columns: owner_name, address, city, state, zip (required); property
          type, estimated value/equity, ownership years, and screening signal
          columns (0/1) are optional. Re-uploading updates existing addresses
          instead of adding duplicates.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>

      {/* Upload summary */}
      {summary && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-medium">
            {summary.total} leads analyzed
            {summary.inserted > 0 && ` · ${summary.inserted} added`}
            {summary.updated > 0 && ` · ${summary.updated} updated`}
            {summary.skipped > 0 && ` · ${summary.skipped} skipped`}
            {" · "}
            <span className="font-semibold text-red-600 dark:text-red-400">
              HOT {summary.bands.HOT}
            </span>
            {" · "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              WARM {summary.bands.WARM}
            </span>
            {" · "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              NURTURE {summary.bands.NURTURE}
            </span>
            {" · "}
            <span className="font-semibold text-gray-600 dark:text-gray-300">
              LOW {summary.bands.LOW}
            </span>
          </p>
          <p className="mt-1 text-xs opacity-80">
            Scores are computed from screening signals — hypotheses drawn from
            the lead data, not claims about the seller.
          </p>
        </div>
      )}

      {/* Search + filter tabs */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owner, address, or city…"
          aria-label="Search leads"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...BANDS, "ARCHIVED"] as const).map((b) => {
            const active = tab === b;
            const label = b === "ALL" ? "All" : b === "ARCHIVED" ? "Archived" : b;
            const n =
              b === "ALL"
                ? leads.length
                : b === "ARCHIVED"
                  ? archived.length
                  : (counts as Record<LeadBand, number>)[b as LeadBand] ?? 0;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setTab(b)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                {label} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Property
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Score
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Band
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {leads.length === 0
                    ? "No leads yet. Upload a CSV to start scoring sellers."
                    : "No leads match the current search or filter."}
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const band = lead.band;
              return (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/app/leads/$id"
                      params={{ id: String(lead.id) }}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {lead.owner_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {lead.property_address ?? "—"}
                    {lead.city ? `, ${lead.city}` : ""}
                    {lead.state ? `, ${lead.state}` : ""}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 dark:text-white">
                    {lead.lead_score ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {band ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandBadge[band]}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${bandDot[band]}`} />
                        {band}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {tab === "ARCHIVED" ? (
                      <span className="inline-flex rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        Archived
                      </span>
                    ) : (
                      lead.status ?? "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
