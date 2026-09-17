import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  getLead,
  setLeadArchived,
  setLeadHot,
  setLeadNote,
} from "~/lib/leads";
import {
  bookAppointment,
  sendSellerMessage,
  startConversation,
} from "~/lib/conversations";
import type {
  AppointmentSnapshot,
  ConversationMessage,
  QualificationRecord,
} from "~/lib/conversations";
import {
  formatCurrency,
  qualificationBand,
  QUALIFICATION_DIMS,
  scoreToBand,
} from "~/lib/scoring";

type LeadDetailData = NonNullable<Awaited<ReturnType<typeof getLead>>>;

export const Route = createFileRoute("/app/leads_/$id")({
  head: (({ loaderData }: {
    loaderData?: LeadDetailData | null;
  }) => ({
    meta: [
      {
        title: loaderData?.owner_name
          ? `DealFlow AI · Lead — ${loaderData.owner_name}`
          : "DealFlow AI · Lead",
      },
    ],
  })) as never,
  loader: async ({ params }) =>
    getLead({ data: { id: Number(params.id) } }),
  component: LeadDetailPage,
});

const bandBadge: Record<string, string> = {
  HOT: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  WARM: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  NURTURE:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const bandText: Record<string, string> = {
  HOT: "text-red-600 dark:text-red-400",
  WARM: "text-amber-600 dark:text-amber-400",
  NURTURE: "text-blue-600 dark:text-blue-400",
  LOW: "text-gray-500 dark:text-gray-400",
};

const statusBadge: Record<string, string> = {
  new: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  contacted:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  qualified:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  booked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
};

function Fact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}

/** Human-friendly timestamp like "Sep 14, 2:41 PM". */
function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LeadDetailPage() {
  const router = useRouter();
  const initial = Route.useLoaderData();
  const [lead, setLead] = useState<LeadDetailData>(initial!);
  const [messages, setMessages] = useState<ConversationMessage[]>(
    initial?.conversation.messages ?? [],
  );
  const [simulated, setSimulated] = useState<boolean>(
    initial?.conversation.simulated ?? false,
  );
  const [qualification, setQualification] = useState<QualificationRecord | null>(
    initial?.qualification ?? null,
  );
  const [appointment, setAppointment] = useState<AppointmentSnapshot | null>(
    initial?.appointment ?? null,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  // Milestone 5 lead actions: MARK HOT / ADD NOTE / ARCHIVE
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(initial?.notes ?? "");
  const [noteBusy, setNoteBusy] = useState(false);

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          to="/app/leads"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          ← Back to Leads
        </Link>
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Lead not found, or it doesn't belong to your account.
        </div>
      </div>
    );
  }

  const band = scoreToBand(lead.lead_score);
  const address =
    [lead.property_address, lead.city, lead.state, lead.zip]
      .filter(Boolean)
      .join(", ") || "—";
  const createdDate = lead.created_at.slice(0, 10) || "—";
  const leadId = Number(lead.id);
  const hasThread = messages.length > 0;

  async function handleStart() {
    if (sending || hasThread) return;
    setSending(true);
    setThreadError(null);
    try {
      const res = await startConversation({ data: { leadId } });
      if (!res) {
        setThreadError("Couldn't start this conversation.");
      } else if ("error" in res) {
        setThreadError(res.error);
      } else {
        setMessages(res.messages);
        setSimulated(res.simulated);
        setLead((prev) => (prev ? { ...prev, status: "contacted" } : prev));
      }
    } catch {
      setThreadError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setThreadError(null);
    try {
      const res = await sendSellerMessage({ data: { leadId, message: text } });
      if (!res) {
        setThreadError("Couldn't send this message.");
      } else if ("error" in res) {
        setThreadError(res.error);
      } else {
        setMessages(res.messages);
        setSimulated(res.simulated);
        setQualification(res.qualification ?? null);
        setLead((prev) =>
          prev ? { ...prev, status: res.lead.status ?? prev.status } : prev,
        );
        setInput("");
      }
    } catch {
      setThreadError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleBook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (booking || !bookDate || !bookTime) return;
    setBooking(true);
    setBookError(null);
    try {
      const res = await bookAppointment({
        data: { leadId, date: bookDate, time: bookTime },
      });
      if (!res) {
        setBookError("Couldn't book this call.");
      } else if ("error" in res) {
        setBookError(res.error);
      } else {
        setAppointment(res.appointment);
        setLead((prev) =>
          prev ? { ...prev, status: res.lead.status ?? prev.status } : prev,
        );
        setBookDate("");
        setBookTime("");
        await router.invalidate();
      }
    } catch {
      setBookError("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const qualBand = qualification ? qualificationBand(qualification.total_score) : null;

  /* ----------------- milestone 5: lead actions ----------------- */

  async function handleToggleHot() {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await setLeadHot({
        data: { leadId, hot: !lead.flagged_hot },
      });
      if (res) {
        setLead((prev) =>
          prev ? { ...prev, flagged_hot: res.flagged_hot } : prev,
        );
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleOpenNote() {
    setNoteDraft(lead.notes);
    setNoteOpen(true);
  }

  async function handleSaveNote() {
    if (noteBusy) return;
    setNoteBusy(true);
    setActionError(null);
    try {
      const res = await setLeadNote({ data: { leadId, note: noteDraft } });
      if (!res) {
        setActionError("Couldn't save this note.");
      } else if ("error" in res) {
        setActionError(res.error);
      } else {
        setLead((prev) => (prev ? { ...prev, notes: res.note } : prev));
        setNoteOpen(false);
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function handleToggleArchive() {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await setLeadArchived({
        data: { leadId, archived: !lead.archived },
      });
      if (res) {
        setLead((prev) =>
          prev ? { ...prev, archived: res.archived } : prev,
        );
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/leads"
        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        ← Back to Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {lead.owner_name ?? "Unnamed owner"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {address}
          </p>
          {lead.status ? (
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                statusBadge[lead.status] ?? statusBadge.new
              }`}
            >
              {lead.status}
            </span>
          ) : null}
          {lead.flagged_hot ? (
            <span className="mt-2 ml-1.5 inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-400">
              HOT
            </span>
          ) : null}
          {lead.archived ? (
            <span className="mt-2 ml-1.5 inline-flex rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              Archived
            </span>
          ) : null}
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold tabular-nums ${band ? bandText[band] : "text-gray-400"}`}>
            {lead.lead_score ?? "—"}
          </p>
          {band ? (
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandBadge[band]}`}
            >
              {band}
            </span>
          ) : null}
        </div>
      </div>

      {/* Actions: BOOK CALL (investor action) + MARK HOT / ADD NOTE / ARCHIVE */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {appointment ? (
          <button
            type="button"
            disabled
            title="Call booked"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            Appointment booked: {appointment.date} {appointment.time}
          </button>
        ) : (
          <form
            onSubmit={handleBook}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="date"
              value={bookDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBookDate(e.target.value)}
              aria-label="Appointment date"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              type="time"
              value={bookTime}
              onChange={(e) => setBookTime(e.target.value)}
              aria-label="Appointment time"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={booking || !bookDate || !bookTime}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {booking ? "Booking…" : "BOOK CALL"}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={handleToggleHot}
          disabled={actionBusy}
          className={
            lead.flagged_hot
              ? "rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              : "rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          }
        >
          {lead.flagged_hot ? "UNMARK HOT" : "MARK HOT"}
        </button>
        <button
          type="button"
          onClick={handleOpenNote}
          disabled={actionBusy || noteBusy}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {lead.notes ? "EDIT NOTE" : "ADD NOTE"}
        </button>
        <button
          type="button"
          onClick={handleToggleArchive}
          disabled={actionBusy}
          className={
            lead.archived
              ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              : "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          }
        >
          {lead.archived ? "Restore" : "Archive"}
        </button>
      </div>
      {actionError ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {actionError}
        </p>
      ) : null}
      {bookError ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {bookError}
        </p>
      ) : null}

      {/* Investor note (ADD NOTE / EDIT NOTE) */}
      {lead.notes || noteOpen ? (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Note
            </h2>
            {!noteOpen && lead.notes ? (
              <button
                type="button"
                onClick={handleOpenNote}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Edit
              </button>
            ) : null}
          </div>
          {noteOpen ? (
            <div className="mt-3">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                maxLength={2000}
                aria-label="Lead note"
                placeholder="Context for you and your team (private — never sent to the seller)…"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={noteBusy}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {noteBusy ? "Saving…" : "Save note"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteOpen(false);
                    setNoteDraft(lead.notes);
                  }}
                  disabled={noteBusy}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {lead.notes}
            </p>
          )}
        </div>
      ) : null}

      {/* Lead facts */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-900">
        <Fact label="Property type" value={lead.property_type ?? "—"} />
        <Fact
          label="Estimated value"
          value={formatCurrency(lead.estimated_value)}
        />
        <Fact
          label="Estimated equity"
          value={formatCurrency(lead.estimated_equity)}
        />
        <Fact label="Status" value={lead.status ?? "—"} />
        <Fact label="Added on" value={createdDate} />
      </dl>

      {/* Seller conversation */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Seller conversation
          </h2>
          {simulated && (
            <p className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              AI simulation mode — configure an AI provider to enable live responses
              conversations
            </p>
          )}
        </div>

        {!hasThread ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No conversation yet. Start one and the AI assistant will qualify
              the seller on condition, timeline, motivation, price flexibility
              and availability for a call.
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={sending}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Starting…" : "Start conversation"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.sender === "ai" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.sender === "ai"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                      {m.sender === "ai" ? "DealFlow AI" : "Seller"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{m.message}</p>
                    <p
                      className={`mt-1 text-[10px] opacity-60 ${
                        m.sender === "ai" ? "text-right" : ""
                      }`}
                    >
                      {formatTime(m.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder="Type the seller's reply… (you're playing the seller)"
                aria-label="Seller message"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send as seller"}
              </button>
            </form>
          </div>
        )}
        {threadError ? (
          <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
            {threadError}
          </p>
        ) : null}
      </section>

      {/* Seller qualification */}
      {qualification ? (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Seller qualification
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Recomputed after each message
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
            {QUALIFICATION_DIMS.map((dim) => {
              const value = qualification[dim.key];
              return (
                <div key={dim.key}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {dim.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                    {value}
                    <span className="text-sm font-normal text-gray-400">
                      /5
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Total{" "}
              <span className="tabular-nums">
                {qualification.total_score}/25
              </span>
            </p>
            {qualBand ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandBadge[qualBand]}`}
              >
                {qualBand}
              </span>
            ) : null}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {qualBand === "HOT" || qualBand === "WARM"
                ? "Qualified — ready for the investor to book a call."
                : "Not yet qualified — keep qualifying."}
            </span>
          </div>
          {qualification.summary ? (
            <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {qualification.summary}
            </p>
          ) : null}
          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            Qualification scores are the assistant's read of the conversation —
            the investor's team decides all offers and bookings.
          </p>
        </section>
      ) : null}

      {/* Signal breakdown */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Screening signals
          </h2>
          {lead.lead_score != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Score = {lead.lead_score}/100 from screening signals
            </p>
          )}
        </div>
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {lead.signals.map((s) => (
            <li
              key={s.key}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.applied
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600"
                  }`}
                >
                  {s.applied ? "✓" : "•"}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {s.label}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      +{s.points} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {s.applied
                      ? "Detected — screening signal, not a claim."
                      : "Not detected for this lead."}
                  </p>
                </div>
              </div>
              <span
                className={`mt-1 shrink-0 text-xs font-semibold ${
                  s.applied ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"
                }`}
              >
                {s.applied ? `+${s.points}` : "0"}
              </span>
            </li>
          ))}
          {lead.signals.length === 0 && (
            <li className="py-4 text-sm text-gray-500 dark:text-gray-400">
              No signal data recorded for this lead.
            </li>
          )}
        </ul>
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Screening signals are hypotheses drawn from lead data — indicators to
          investigate, not verified claims about the seller. Qualification
          happens in the AI seller conversation.
        </p>
      </div>
    </div>
  );
}
