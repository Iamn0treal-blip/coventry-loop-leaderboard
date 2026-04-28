import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function parseTimeToSeconds(timeText) {
  if (typeof timeText !== "string") return null;

  const cleaned = timeText.trim();
  if (!cleaned) return null;

  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");

    if (parts.length < 2 || parts.length > 3) return null;
    if (parts.some((part) => part.trim() === "")) return null;

    const numbers = parts.map(Number);
    if (numbers.some((number) => Number.isNaN(number) || number < 0)) return null;

    if (numbers.length === 2) {
      const [minutes, seconds] = numbers;
      if (seconds >= 60) return null;
      return minutes * 60 + seconds;
    }

    const [hours, minutes, seconds] = numbers;
    if (minutes >= 60 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const seconds = Number(cleaned);
  if (Number.isNaN(seconds) || seconds < 0) return null;
  return seconds;
}

function formatSeconds(totalSeconds) {
  if (typeof totalSeconds !== "number" || Number.isNaN(totalSeconds)) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const roundedSeconds = Math.round(seconds * 10) / 10;

  const formatSecondPart = (value) => {
    if (Number.isInteger(value)) return String(value).padStart(2, "0");
    return value.toFixed(1).padStart(4, "0");
  };

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${formatSecondPart(roundedSeconds)}`;
  }

  return `${minutes}:${formatSecondPart(roundedSeconds)}`;
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const defaultMethodOptions = [
  "Running",
  "Biking",
  "Walking",
  "Unicycle",
  "Skateboard",
  "Scooter",
  "Skiing",
  "Snowshoe",
];

const blankForm = {
  name: "",
  time: "",
  method: "Running",
  customMethod: "",
  date: getTodayDateString(),
  notes: "",
};

export default function CoventryLoopLeaderboard() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("records")
      .select("*")
      .order("seconds", { ascending: true });

    if (error) {
      setError(`Could not load records: ${error.message}`);
      setRecords([]);
    } else {
      setRecords(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const sortedRecords = useMemo(() => {
    return [...records]
      .map((record) => ({
        ...record,
        seconds:
          typeof record.seconds === "number"
            ? record.seconds
            : parseTimeToSeconds(record.time),
      }))
      .filter((record) => record.seconds !== null)
      .sort((a, b) => a.seconds - b.seconds);
  }, [records]);

const submittedMethods = useMemo(() => {
  return Array.from(new Set(sortedRecords.map((record) => record.method))).sort();
}, [sortedRecords]);

const submitMethodOptions = useMemo(() => {
  return [
    ...Array.from(new Set([...defaultMethodOptions, ...submittedMethods])).sort(),
    "Other",
  ];
}, [submittedMethods]);

const availableMethods = useMemo(() => {
  return ["All Methods", ...submittedMethods];
}, [submittedMethods]);

  const displayedRecords = useMemo(() => {
    if (methodFilter === "All Methods") return sortedRecords;
    return sortedRecords.filter((record) => record.method === methodFilter);
  }, [methodFilter, sortedRecords]);

  const currentRecord = displayedRecords[0];

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const parsedTime = parseTimeToSeconds(form.time);
    const submittedMethod =
      form.method === "Other" ? form.customMethod.trim() : form.method.trim();

    if (!form.name.trim()) {
      setError("Please enter a name.");
      return;
    }

    if (parsedTime === null) {
      setError("Please enter a valid time, like 6:42, 1:05:20, or 23.5 seconds.");
      return;
    }

    if (!submittedMethod) {
      setError("Please enter a method, like running, biking, walking, or unicycle.");
      return;
    }

    if (!form.date) {
      setError("Please enter the date the record happened.");
      return;
    }

    setSaving(true);

    const newRecord = {
      name: form.name.trim(),
      time: form.time.trim(),
      seconds: parsedTime,
      method: submittedMethod,
      date: form.date,
      notes: form.notes.trim(),
    };

    const { error } = await supabase.from("records").insert([newRecord]);

    if (error) {
      setError(`Could not save record: ${error.message}`);
    } else {
      setForm({ ...blankForm, date: getTodayDateString() });
      await loadRecords();
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Coventry Loop Records
              </p>

              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                Coventry Loop Leaderboard
              </h1>

              <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
                Submit your fastest lap around the Coventry Loop. Running, biking,
                walking, unicycle, stroller-push, snowshoe, or any other method counts.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
              <p className="text-sm text-slate-300">
                {methodFilter === "All Methods" ? "Overall record" : `${methodFilter} record`}
              </p>

              <p className="mt-1 text-2xl font-bold">
                {currentRecord ? formatSeconds(Number(currentRecord.seconds)) : "No records"}
              </p>

              {currentRecord && (
                <p className="mt-1 text-sm text-slate-300">
                  {currentRecord.name} · {currentRecord.method} ·{" "}
                  {formatDate(currentRecord.date)}
                </p>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Submit a time</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a name, time, method, and date to join the board.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Name
                </span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Time
                </span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                  value={form.time}
                  onChange={(event) => updateForm("time", event.target.value)}
                  placeholder="Example: 6:42"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Use minutes:seconds, hours:minutes:seconds, or seconds.
                </p>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Date
                </span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Method
                </span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                  value={form.method}
                  onChange={(event) => updateForm("method", event.target.value)}
                >
                  {submitMethodOptions.map((method) => (
                  <option key={method}>{method}</option>
                  ))}
                </select>
              </label>

              {form.method === "Other" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Custom method
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                    value={form.customMethod}
                    onChange={(event) => updateForm("customMethod", event.target.value)}
                    placeholder="Example: Rollerblades"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Optional note
                </span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-slate-400 transition focus:ring-2"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Weather, route condition, witnesses, etc."
                />
              </label>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Add to leaderboard"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Leaderboard</h2>

                <p className="text-sm text-slate-500">
                  {methodFilter === "All Methods"
                    ? "Fastest times appear first across all methods."
                    : `Fastest ${methodFilter.toLowerCase()} times appear first.`}
                </p>
              </div>

              <label className="block min-w-[190px]">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Show method
                </span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                  value={methodFilter}
                  onChange={(event) => setMethodFilter(event.target.value)}
                >
                  {availableMethods.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-sm text-slate-500">Showing</p>
                <p className="text-lg font-semibold">
                  {loading ? "Loading..." : `${displayedRecords.length} records`}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-sm text-slate-500">
                  {methodFilter === "All Methods"
                    ? "Fastest shown"
                    : `Fastest ${methodFilter}`}
                </p>

                <p className="text-lg font-semibold">
                 {currentRecord
                 ? `${formatSeconds(Number(currentRecord.seconds))} by ${currentRecord.name}`
                  : "No records yet"}
                </p>
              </div>
            </div>

            {/* Mobile card view */}
<div className="space-y-3 md:hidden">
  {displayedRecords.map((record, index) => (
    <div
      key={record.id}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">#{index + 1}</p>
          <p className="text-lg font-bold text-slate-900">{record.name}</p>
        </div>

        <p className="rounded-full bg-slate-900 px-3 py-1 font-mono text-sm font-semibold text-white">
          {formatSeconds(Number(record.seconds))}
        </p>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Method:</span>{" "}
          {record.method}
        </p>
        <p>
          <span className="font-medium text-slate-800">Date:</span>{" "}
          {formatDate(record.date)}
        </p>
        {record.notes && (
          <p>
            <span className="font-medium text-slate-800">Note:</span>{" "}
            {record.notes}
          </p>
        )}
      </div>
    </div>
  ))}
</div>

{/* Desktop table view */}
<div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
  <table className="w-full border-collapse bg-white text-left text-sm">
    <thead className="bg-slate-100 text-slate-700">
      <tr>
        <th className="px-4 py-3 font-semibold">Rank</th>
        <th className="px-4 py-3 font-semibold">Name</th>
        <th className="px-4 py-3 font-semibold">Time</th>
        <th className="px-4 py-3 font-semibold">Method</th>
        <th className="px-4 py-3 font-semibold">Date</th>
        <th className="px-4 py-3 font-semibold">Note</th>
      </tr>
    </thead>

    <tbody>
      {displayedRecords.map((record, index) => (
        <tr key={record.id} className="border-t border-slate-200">
          <td className="px-4 py-3 font-bold">#{index + 1}</td>
          <td className="px-4 py-3">{record.name}</td>
          <td className="px-4 py-3 font-mono font-semibold">
            {formatSeconds(Number(record.seconds))}
          </td>
          <td className="px-4 py-3">{record.method}</td>
          <td className="px-4 py-3">{formatDate(record.date)}</td>
          <td className="px-4 py-3 text-slate-500">
            {record.notes || "—"}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

            {!loading && displayedRecords.length === 0 && (
              <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                No records match this method yet.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}