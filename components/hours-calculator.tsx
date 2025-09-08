"use client"

import { useMemo, useState, useEffect } from "react"

/**
 * Hours Calculator – Hotel Submission
 * Single‑file React app (TailwindCSS). Host on Netlify/Vercel/GitHub Pages.
 *
 * Features:
 * - Multiple days and multiple shifts per day
 * - Automatic calculation (HH:MM and decimal hours)
 * - Breaks (minutes), overnight hours crossing midnight
 * - Field validation and error highlights
 * - Export CSV, Copy summary (email), Print/Save PDF
 * - Save draft in browser (LocalStorage)
 * - AM/PM time format support
 *
 * How to use:
 * 1) Fill header (Hotel, Manager, Employee, Week/Date).
 * 2) For each day, add 1..n shifts. Enter Start, End, Break.
 * 3) See totals per day/week in footer.
 * 4) Click "Download CSV" to attach to email; or "Copy summary"; or "Print/PDF".
 */

// ---------- Helpers ----------
const pad = (n) => String(n).padStart(2, "0")

function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null

  const timeStr = t.trim().toUpperCase()

  // Check for AM/PM format first
  const ampmMatch = timeStr.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i)
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1])
    const minutes = Number.parseInt(ampmMatch[2])
    const period = ampmMatch[3].toUpperCase()

    if (hours < 1 || hours > 12) return null
    if (period === "AM" && hours === 12) hours = 0
    if (period === "PM" && hours !== 12) hours += 12

    return hours * 60 + minutes
  }

  // Fall back to 24-hour format
  const match24 = timeStr.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match24) return null

  const hh = Number(match24[1])
  const mm = Number(match24[2])
  return hh * 60 + mm
}

function minutesToHHMM(min) {
  const sign = min < 0 ? "-" : ""
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${pad(h)}:${pad(m)}`
}

function minutesToAMPM(min) {
  const abs = Math.abs(min)
  let hours = Math.floor(abs / 60) % 24
  const minutes = abs % 60
  const period = hours >= 12 ? "PM" : "AM"

  if (hours === 0) hours = 12
  else if (hours > 12) hours -= 12

  return `${hours}:${pad(minutes)} ${period}`
}

function minutesToDecimalHours(min) {
  return Math.round((min / 60) * 100) / 100 // 2 casas
}

function calcShiftMinutes(startStr, endStr, breakMin = 0) {
  const s = parseTimeToMinutes(startStr)
  const e = parseTimeToMinutes(endStr)
  if (s == null || e == null) return { minutes: 0, valid: false }
  let dur = e - s
  if (dur < 0) dur += 24 * 60 // cruza meia-noite
  const pause = Number.isFinite(+breakMin) ? Math.max(0, +breakMin) : 0
  const total = Math.max(0, dur - pause)
  return { minutes: total, valid: true }
}

function defaultWeek(startDateISO) {
  // creates 7 days starting from startDateISO
  const base = startDateISO ? new Date(startDateISO) : new Date()
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      shifts: [newShift()],
      notes: "",
    }
  })
  return days
}

function newShift() {
  return { start: "", end: "", breakMin: 0 }
}

// ---------- Main App ----------
export default function HoursCalculator() {
  const [meta, setMeta] = useState(() => ({
    hotel: "",
    manager: "",
    employee: "",
    weekStart: new Date().toISOString().slice(0, 10),
  }))

  const [days, setDays] = useState(() => defaultWeek(new Date().toISOString().slice(0, 10)))

  const [consent, setConsent] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("hours_calc_v1")
        if (saved) {
          const parsedData = JSON.parse(saved)
          setDays(parsedData)
        }
      } catch (error) {
        console.error("Failed to load saved data:", error)
      }
    }
  }, [])

  const totals = useMemo(() => {
    let grandMin = 0
    const perDay = days.map((day) => {
      let m = 0
      let valid = true
      day.shifts.forEach((s) => {
        const { minutes, valid: ok } = calcShiftMinutes(s.start, s.end, s.breakMin)
        m += minutes
        if (!ok) valid = false
      })
      grandMin += m
      return { minutes: m, valid }
    })
    return { perDay, grandMin, grandHHMM: minutesToHHMM(grandMin), grandDec: minutesToDecimalHours(grandMin) }
  }, [days])

  function updateDay(idx, updater) {
    setDays((prev) => {
      const clone = structuredClone(prev)
      updater(clone[idx])
      persist(clone)
      return clone
    })
  }

  function persist(d) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("hours_calc_v1", JSON.stringify(d))
      } catch (error) {
        console.error("Failed to save data:", error)
      }
    }
  }

  function clearAll() {
    if (!confirm("Delete all form data?")) return
    const fresh = defaultWeek(meta.weekStart)
    setDays(fresh)
    persist(fresh)
    setConsent(false)
  }

  function shiftRow(dayIdx, shiftIdx, field, value) {
    updateDay(dayIdx, (day) => {
      day.shifts[shiftIdx][field] = field === "breakMin" ? (value === "" ? "" : Number(value)) : value
    })
  }

  function addShift(dayIdx) {
    updateDay(dayIdx, (day) => day.shifts.push(newShift()))
  }

  function removeShift(dayIdx, shiftIdx) {
    updateDay(dayIdx, (day) => day.shifts.splice(shiftIdx, 1))
  }

  function addDay(afterIdx) {
    setDays((prev) => {
      const clone = structuredClone(prev)
      const base = new Date(clone[afterIdx].date)
      base.setDate(base.getDate() + 1)
      clone.splice(afterIdx + 1, 0, { date: base.toISOString().slice(0, 10), shifts: [newShift()], notes: "" })
      persist(clone)
      return clone
    })
  }

  function removeDay(idx) {
    setDays((prev) => {
      if (prev.length <= 1) return prev
      const clone = structuredClone(prev)
      clone.splice(idx, 1)
      persist(clone)
      return clone
    })
  }

  function onMetaChange(field, value) {
    setMeta((m) => ({ ...m, [field]: value }))
  }

  function buildCSV() {
    const header = [
      "Hotel",
      "Manager",
      "Employee",
      "Date",
      "Shift#",
      "Start",
      "End",
      "Break(min)",
      "Hours(HH:MM)",
      "Hours(dec)",
      "Day-notes",
    ]
    const rows = []
    days.forEach((day, di) => {
      let dayMinutes = 0
      day.shifts.forEach((s, si) => {
        const { minutes, valid } = calcShiftMinutes(s.start, s.end, s.breakMin)
        dayMinutes += minutes
        rows.push([
          meta.hotel,
          meta.manager,
          meta.employee,
          day.date,
          si + 1,
          s.start,
          s.end,
          s.breakMin ?? 0,
          valid ? minutesToHHMM(minutes) : "",
          valid ? minutesToDecimalHours(minutes) : "",
          si === 0 ? day.notes || "" : "",
        ])
      })
      if (day.shifts.length === 0) {
        rows.push([meta.hotel, meta.manager, meta.employee, day.date, "-", "", "", 0, "00:00", 0, day.notes || ""])
      }
    })
    // Totals
    rows.push([])
    rows.push(["WEEKLY TOTAL", "", "", "", "", "", "", minutesToHHMM(totals.grandMin), totals.grandDec, ""])
    return [header, ...rows]
      .map((r) => r.map((v) => (v === undefined || v === null ? "" : String(v))).join(","))
      .join("\n")
  }

  function downloadCSV() {
    const csv = buildCSV()
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const fileName = `hours_${meta.employee || "employee"}_${days[0]?.date || "date"}.csv`
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyEmailSummary() {
    const lines = []
    lines.push(`Hotel: ${meta.hotel}`)
    lines.push(`Manager: ${meta.manager}`)
    lines.push(`Employee: ${meta.employee}`)
    lines.push(`Week starting: ${meta.weekStart}`)
    lines.push("")
    days.forEach((d, i) => {
      const dayTotal = d.shifts.reduce((acc, s) => acc + calcShiftMinutes(s.start, s.end, s.breakMin).minutes, 0)
      lines.push(`${d.date}  —  ${minutesToHHMM(dayTotal)} (${minutesToDecimalHours(dayTotal)}h)`)
      d.shifts.forEach((s, j) => {
        const { minutes } = calcShiftMinutes(s.start, s.end, s.breakMin)
        lines.push(
          `   Shift ${j + 1}: ${s.start}–${s.end}  Break: ${s.breakMin || 0}  = ${minutesToHHMM(minutes)} (${minutesToDecimalHours(minutes)}h)`,
        )
      })
      if (d.notes) lines.push(`   Notes: ${d.notes}`)
    })
    lines.push("")
    lines.push(`WEEKLY TOTAL: ${totals.grandHHMM} (${totals.grandDec}h)`)
    const txt = lines.join("\n")
    navigator.clipboard.writeText(txt).then(() => {
      alert("Summary copied to clipboard. Paste into email body.")
    })
  }

  function printPDF() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 bg-white rounded-2xl shadow-sm p-6 print:shadow-none print:border">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Brand section */}
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Space Coast Services" className="h-14 w-auto flex-shrink-0" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">Hours Calculator</h1>
                <p className="text-sm text-slate-600 font-medium">Hotel Submission</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                onClick={downloadCSV}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm text-sm font-medium transition-colors"
              >
                📊 Download CSV
              </button>
              <button
                onClick={copyEmailSummary}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm text-sm font-medium transition-colors"
              >
                📋 Copy Summary
              </button>
              <button
                onClick={printPDF}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm text-sm font-medium transition-colors"
              >
                🖨️ Print / PDF
              </button>
              <button
                onClick={clearAll}
                className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-sm text-sm font-medium transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </header>

        {/* Meta */}
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-2xl shadow print:border print:shadow-none">
          <Input
            label="Hotel"
            value={meta.hotel}
            onChange={(v) => onMetaChange("hotel", v)}
            placeholder="Ex: Holiday Inn — Lake City"
          />
          <Input
            label="Manager"
            value={meta.manager}
            onChange={(v) => onMetaChange("manager", v)}
            placeholder="Manager name"
          />
          <Input
            label="Employee"
            value={meta.employee}
            onChange={(v) => onMetaChange("employee", v)}
            placeholder="Employee name"
          />
          <Input label="Week start" type="date" value={meta.weekStart} onChange={(v) => onMetaChange("weekStart", v)} />
          <div className="lg:col-span-3 flex items-start gap-2 mt-2">
            <input
              id="consent"
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent" className="text-sm text-slate-600">
              I confirm that the hours entered are accurate and have been verified by the responsible manager.
            </label>
          </div>
        </section>

        {/* Days */}
        <section className="mt-6 space-y-6">
          {days.map((day, di) => (
            <div key={di} className="bg-white rounded-2xl shadow p-4 print:break-inside-avoid">
              <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Input
                    label="Date"
                    type="date"
                    value={day.date}
                    onChange={(v) =>
                      updateDay(di, (d) => {
                        d.date = v
                      })
                    }
                    small
                  />
                  <div className="text-sm text-slate-600">
                    Daily total:{" "}
                    <b>
                      {minutesToHHMM(
                        days[di].shifts.reduce((a, s) => a + calcShiftMinutes(s.start, s.end, s.breakMin).minutes, 0),
                      )}
                    </b>{" "}
                    (
                    {minutesToDecimalHours(
                      days[di].shifts.reduce((a, s) => a + calcShiftMinutes(s.start, s.end, s.breakMin).minutes, 0),
                    )}
                    h)
                  </div>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={() => addShift(di)}
                    className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50"
                  >
                    + Shift
                  </button>
                  <button
                    onClick={() => addDay(di)}
                    className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50"
                  >
                    + Day
                  </button>
                  <button
                    onClick={() => removeDay(di)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                  >
                    Remove day
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Start</th>
                      <th className="p-2 text-left">End</th>
                      <th className="p-2 text-left">Break (min)</th>
                      <th className="p-2 text-left">Hours (HH:MM)</th>
                      <th className="p-2 text-left">Hours (dec)</th>
                      <th className="p-2 text-left print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.shifts.map((s, si) => {
                      const r = calcShiftMinutes(s.start, s.end, s.breakMin)
                      const invalid = !r.valid && (s.start || s.end)
                      return (
                        <tr key={si} className={invalid ? "bg-rose-50" : ""}>
                          <td className="p-2">{si + 1}</td>
                          <td className="p-2">
                            <TimeInput value={s.start} onChange={(v) => shiftRow(di, si, "start", v)} />
                          </td>
                          <td className="p-2">
                            <TimeInput value={s.end} onChange={(v) => shiftRow(di, si, "end", v)} />
                          </td>
                          <td className="p-2">
                            <NumberInput
                              value={s.breakMin}
                              onChange={(v) => shiftRow(di, si, "breakMin", v)}
                              min={0}
                              step={5}
                            />
                          </td>
                          <td className="p-2">
                            {r.valid ? minutesToHHMM(r.minutes) : <span className="text-rose-600">— invalid</span>}
                          </td>
                          <td className="p-2">{r.valid ? minutesToDecimalHours(r.minutes) : ""}</td>
                          <td className="p-2 print:hidden">
                            <button
                              onClick={() => removeShift(di, si)}
                              className="px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Daily notes</label>
                <textarea
                  value={day.notes}
                  onChange={(e) =>
                    updateDay(di, (d) => {
                      d.notes = e.target.value
                    })
                  }
                  className="w-full rounded-xl border p-2"
                  rows={2}
                  placeholder="Ex.: coverage, holiday, delay due to maintenance, etc."
                />
              </div>
            </div>
          ))}
        </section>

        {/* Footer Totals */}
        <footer className="mt-6 bg-white rounded-2xl shadow p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-600">Weekly total</div>
              <div className="text-xl font-semibold">
                {totals.grandHHMM} <span className="text-slate-500">({totals.grandDec} h)</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 max-w-xl">
              Tip: hours that cross midnight are supported. Use either 24-hour format (22:00) or 12-hour format (10:00
              PM). Ex.: Start 10:00 PM, End 6:00 AM, Break 30 → the system calculates 7:30 (7.5h).
            </div>
          </div>
        </footer>

        <div className="mt-10 text-center text-xs text-slate-400 print:hidden">
          © {new Date().getFullYear()} Space Coast Services Mgt — Timesheet Lite
        </div>
      </div>

      <style jsx>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

// ---------- UI components ----------
function Input({ label, value, onChange, placeholder, type = "text", small = false }) {
  return (
    <label className={small ? "text-xs" : "text-sm"}>
      <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border p-2 ${small ? "text-sm" : ""}`}
      />
    </label>
  )
}

function TimeInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="9:00 AM"
      className="w-32 rounded-lg border p-2"
      title="Supports both formats: 9:00 AM or 21:00"
    />
  )
}

function NumberInput({ value, onChange, min = 0, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 rounded-lg border p-2"
    />
  )
}
