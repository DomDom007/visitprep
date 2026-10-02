// Visitprep: log symptoms over weeks, then walk into a 10-minute appointment with a one-page summary and your questions.
import { useMemo, useState } from "react";
import { uid, useStored } from "./lib/store";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "visitprep";
type Entry = { id: string; date: string; symptoms: Record<string, number>; triggers: string[]; meds: string; note: string };
const SYMPTOMS = ["Headache", "Dizziness", "Fatigue", "Nausea", "Joint pain", "Poor sleep"];
const TRIGGERS = ["Stress", "Poor sleep", "Skipped meal", "Screen time", "Weather", "Exercise", "Caffeine", "Alcohol"];
function sample(): Entry[] {
  const out: Entry[] = []; let s = 3;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 27; i >= 0; i--) {
    const stress = r() < 0.35, sleep = r() < 0.3;
    const h = Math.max(0, Math.round((stress ? 5 : 1) + (sleep ? 2 : 0) + r() * 2 - 1));
    out.push({ id: uid(), date: addDays(todayISO(), -i), symptoms: { Headache: h > 1 ? h : 0, Fatigue: Math.round(2 + (sleep ? 3 : 0) + r() * 2), Dizziness: r() < 0.15 ? 3 : 0 }, triggers: [...(stress ? ["Stress"] : []), ...(sleep ? ["Poor sleep"] : []), ...(r() < 0.3 ? ["Screen time"] : [])], meds: h > 4 ? "Paracetamol 1 g" : "", note: "" });
  }
  return out;
}

export default function Visitprep() {
  const [entries, setEntries] = useStored<Entry[]>(T, "entries", sample());
  const [tracked, setTracked] = useStored<string[]>(T, "tracked", ["Headache", "Fatigue", "Dizziness"]);
  const [questions, setQuestions] = useStored<string[]>(T, "qs", ["Could my headaches be linked to blood pressure?", "Is it safe to keep taking paracetamol this often?"]);
  const [profile, setProfile] = useStored(T, "profile", { name: "", born: "", conditions: "", regular: "", allergies: "", appt: addDays(todayISO(), 5) });
  const [days, setDays] = useStored(T, "days", 28);
  const [today, setToday] = useState<Entry>(() => entries.find(e => e.date === todayISO()) ?? { id: uid(), date: todayISO(), symptoms: {}, triggers: [], meds: "", note: "" });
  const [q, setQ] = useState("");
  const [newSym, setNewSym] = useState("");

  const recent = useMemo(() => entries.filter(e => e.date >= addDays(todayISO(), -days + 1)).sort((a, b) => a.date.localeCompare(b.date)), [entries, days]);
  const stat = (s: string) => {
    const vals = recent.map(e => e.symptoms[s] ?? 0), on = vals.filter(v => v > 0);
    const half = Math.floor(vals.length / 2), a = vals.slice(0, half), b = vals.slice(half);
    const avg = (x: number[]) => (x.length ? x.reduce((p, c) => p + c, 0) / x.length : 0);
    return { days: on.length, worst: Math.max(0, ...vals), avg: avg(on), trend: avg(b) - avg(a), vals };
  };
  // Which triggers show up on bad days more than on good days.
  const trig = (s: string) => TRIGGERS.map(t => {
    const bad = recent.filter(e => (e.symptoms[s] ?? 0) >= 4), good = recent.filter(e => (e.symptoms[s] ?? 0) < 4);
    const pb = bad.length ? bad.filter(e => e.triggers.includes(t)).length / bad.length : 0, pg = good.length ? good.filter(e => e.triggers.includes(t)).length / good.length : 0;
    return { t, pb, lift: pb - pg };
  }).filter(x => x.pb >= 0.4 && x.lift > 0.2).sort((a, b) => b.lift - a.lift);
  const medDays = recent.filter(e => e.meds.trim()).length;
  const save = () => setEntries([today, ...entries.filter(e => e.date !== today.date)]);

  return (
    <div className="stack">
      <Section title="Today">
        <div className="vp-today">
          {tracked.map(s => (
            <label key={s} className="vp-sym"><span>{s}</span>
              <input type="range" min={0} max={10} value={today.symptoms[s] ?? 0} onChange={e => setToday({ ...today, symptoms: { ...today.symptoms, [s]: +e.target.value } })} />
              <b className="num" style={{ color: (today.symptoms[s] ?? 0) >= 7 ? "var(--bad)" : undefined }}>{today.symptoms[s] ?? 0}</b></label>
          ))}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 12 }}>{TRIGGERS.map(t => <button key={t} className="btn small" aria-pressed={today.triggers.includes(t)} style={today.triggers.includes(t) ? { background: "var(--ink)", color: "var(--bg)" } : undefined} onClick={() => setToday({ ...today, triggers: today.triggers.includes(t) ? today.triggers.filter(x => x !== t) : [...today.triggers, t] })}>{t}</button>)}</div>
        <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <label className="field"><span>Medicines taken for it</span><input id="vp-meds" className="input" value={today.meds} onChange={e => setToday({ ...today, meds: e.target.value })} /></label>
          <label className="field" style={{ flexGrow: 2 }}><span>Note</span><input id="vp-note" className="input" value={today.note} onChange={e => setToday({ ...today, note: e.target.value })} /></label>
          <button className="btn primary" onClick={save}>Save today</button>
        </div>
        <form className="row" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); if (newSym.trim() && !tracked.includes(newSym.trim())) setTracked([...tracked, newSym.trim()]); setNewSym(""); }}>
          <select className="input" style={{ maxWidth: 200 }} aria-label="Add a symptom" value="" onChange={e => e.target.value && !tracked.includes(e.target.value) && setTracked([...tracked, e.target.value])}><option value="">Track another symptom</option>{SYMPTOMS.filter(s => !tracked.includes(s)).map(s => <option key={s}>{s}</option>)}</select>
          <input className="input" style={{ maxWidth: 200 }} aria-label="Custom symptom" placeholder="or type one" value={newSym} onChange={e => setNewSym(e.target.value)} /><button className="btn small" type="submit">Add</button>
        </form>
      </Section>

      <section className="panel vp-sheet">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div><p className="eyebrow">For my appointment {profile.appt && `on ${prettyDate(profile.appt)}`}</p><h2 style={{ margin: "4px 0" }}>{profile.name || "Symptom summary"}</h2></div>
          <div className="row no-print"><select id="vp-days" className="input" style={{ width: "auto" }} value={days} onChange={e => setDays(+e.target.value)} aria-label="Period">{[14, 28, 56, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}</select><button className="btn small primary" onClick={() => window.print()}>Print</button></div>
        </div>
        {(profile.conditions || profile.regular || profile.allergies) && <p className="note">{profile.born && `Born ${profile.born}. `}{profile.conditions && `Known conditions: ${profile.conditions}. `}{profile.regular && `Regular medicines: ${profile.regular}. `}{profile.allergies && `Allergies: ${profile.allergies}.`}</p>}
        <Stats><Stat value={recent.length} label="Days logged" /><Stat value={medDays} label="Days with medicine taken" tone={medDays > days / 3 ? "warn" : undefined} /></Stats>
        <div className="stack" style={{ gap: 16, marginTop: 16 }}>
          {tracked.map(s => { const st = stat(s), tr = trig(s); return (
            <div key={s} className="vp-row">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}><strong>{s}</strong><span className="note">{st.days} of {recent.length} days · worst {st.worst}/10 · average {st.avg.toFixed(1)} when present · {st.trend > 0.5 ? "getting worse" : st.trend < -0.5 ? "getting better" : "steady"}</span></div>
              <div className="vp-spark">{st.vals.map((v, i) => <span key={i} style={{ height: `${v * 10}%`, background: v >= 7 ? "var(--bad)" : v >= 4 ? "var(--warn)" : "var(--accent)" }} />)}</div>
              {tr.length > 0 && <p className="note">Often on bad days: {tr.map(x => `${x.t.toLowerCase()} (${Math.round(x.pb * 100)}% of bad days)`).join(", ")}.</p>}
            </div>); })}
        </div>
        <div style={{ marginTop: 16 }}><p className="eyebrow">My questions</p><ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>{questions.map((x, i) => <li key={i}>{x} <button className="btn ghost small danger no-print" onClick={() => setQuestions(questions.filter((_, k) => k !== i))}>×</button></li>)}</ol>
          <form className="row no-print" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (q.trim()) setQuestions([...questions, q.trim()]); setQ(""); }}><input id="vp-q" className="input" style={{ flex: 1 }} aria-label="Question" value={q} onChange={e => setQ(e.target.value)} placeholder="Add a question for the doctor" /><button className="btn small" type="submit">Add</button></form>
        </div>
      </section>

      <Section title="About you" className="no-print">
        <div className="row">
          <label className="field"><span>Name</span><input id="vp-name" className="input" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
          <label className="field"><span>Year of birth</span><input id="vp-born" className="input" value={profile.born} onChange={e => setProfile({ ...profile, born: e.target.value })} /></label>
          <label className="field"><span>Appointment date</span><input id="vp-appt" type="date" className="input" value={profile.appt} onChange={e => setProfile({ ...profile, appt: e.target.value })} /></label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="field"><span>Known conditions</span><input id="vp-cond" className="input" value={profile.conditions} onChange={e => setProfile({ ...profile, conditions: e.target.value })} /></label>
          <label className="field"><span>Regular medicines</span><input id="vp-reg" className="input" value={profile.regular} onChange={e => setProfile({ ...profile, regular: e.target.value })} /></label>
          <label className="field"><span>Allergies</span><input id="vp-all" className="input" value={profile.allergies} onChange={e => setProfile({ ...profile, allergies: e.target.value })} /></label>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Visitprep organises what you notice. It does not diagnose. If symptoms are sudden or severe, seek care right away.</p>
      </Section>
      <style>{`.vp-today{display:grid;gap:10px}.vp-sym{display:grid;grid-template-columns:130px 1fr 36px;gap:12px;align-items:center}.vp-sym b{font-size:20px;text-align:right}
      .vp-sheet{background:#fff;color:#151933}.vp-sheet .note,.vp-sheet .stat span,.vp-sheet .eyebrow{color:#555C78}.vp-row{padding-bottom:12px;border-bottom:1px solid #e3e5ec}.vp-spark{display:flex;gap:2px;align-items:flex-end;height:40px;margin:8px 0}.vp-spark span{flex:1;min-height:2px;border-radius:1px}
      @media print{body *{visibility:hidden}.vp-sheet,.vp-sheet *{visibility:visible}.vp-sheet{position:absolute;inset:0 auto auto 0;width:100%}.no-print{display:none!important}}`}</style>
    </div>
  );
}
