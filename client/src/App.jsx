import { useCallback, useEffect, useState } from 'react';
import {
  clearSession,
  createRecord,
  deleteRecord,
  fetchMe,
  fetchRecords,
  fetchSummary,
  getStoredUser,
  getToken,
  login,
  notifySaved,
  nowTimeParts,
  savedWhen,
  setSession,
  todayParts,
} from './api.js';

const STATUSES = ['Success', 'Fail', 'Paid', 'Pending'];
const ATTENDANCE = ['present', 'absent', 'holiday', 'leave', 'weekoff'];

function normalizeAttendance(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (value === 'week off' || value === 'weekoff') return 'weekoff';
  return value;
}

function attendanceLabel(status) {
  if (status === 'weekoff') return 'week off';
  return status;
}

const PAGES = [
  { id: 'home', label: 'Home', note: 'Desktop overview' },
  { id: 'schedule', label: 'Schedule', note: 'Working hours entry' },
  { id: 'salary', label: 'Salary', note: 'Payment desk' },
  { id: 'rewards', label: 'Rewards', note: 'Zipher · Festival · Data' },
  { id: 'events', label: 'Events & Quiz', note: 'Upcoming · Assessment' },
  { id: 'attendance', label: 'Attendance', note: 'Gate status marks' },
  { id: 'performance', label: 'Ratings', note: 'Stars · Data lines' },
  { id: 'guidelines', label: 'Guidelines', note: 'Saved descriptions' },
  { id: 'summary', label: 'Details', note: 'Full summary report' },
];

function useRecords(kind, rewardType) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      setItems(await fetchRecords(kind, rewardType));
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [kind, rewardType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (payload) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const record = await createRecord({ kind, rewardType, payload });
      setNotice(`Saved · ${savedWhen(record)}`);
      notifySaved();
      await refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setError('');
    setNotice('');
    try {
      await deleteRecord(id);
      setNotice('Deleted');
      notifySaved();
      await refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  return { items, refresh, refreshing, save, saving, remove, error, notice };
}

function LiveSignal() {
  const [left, setLeft] = useState(5);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const remain = Math.max(0, 5 - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain === 0) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const alert = left === 0;

  return (
    <div className={`signal ${alert ? 'is-red' : 'is-green'}`} aria-live="polite">
      <span className="lamp" />
      {alert ? (
        <strong>
          LIVE <span className="stop">⛔</span>
        </strong>
      ) : (
        <strong>LIVE · {left}s</strong>
      )}
    </div>
  );
}

function Panel({ index, title, kicker, onRefresh, refreshing, children, wide }) {
  return (
    <section className={`panel ${wide ? 'span-2' : ''}`}>
      <header className="panel-head">
        <div>
          <span className="index">{String(index).padStart(2, '0')}</span>
          <h2>{title}</h2>
          {kicker ? <p className="kicker">{kicker}</p> : null}
        </div>
        {onRefresh ? (
          <button type="button" className="refresh" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Feedback({ error, notice }) {
  if (!error && !notice) return null;
  return <p className={error ? 'feedback bad' : 'feedback ok'}>{error || notice}</p>;
}

function PcIcon() {
  return (
    <svg className="pc-icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="8" width="36" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <rect x="10" y="12" width="28" height="16" rx="1.5" fill="currentColor" opacity="0.22" />
      <path d="M18 36h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 40h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 32v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="profile-icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.16" />
      <circle cx="24" cy="18" r="8" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M10 40c3.2-8 10-12 14-12s10.8 4 14 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileChip({ email, className = '' }) {
  return (
    <div className={`profile-chip ${className}`.trim()}>
      <ProfileIcon />
      <span>{email}</span>
    </div>
  );
}

function BrandLines({ title = 'Zipher Virtual Desktop', showMeta = true }) {
  return (
    <div className="brand-head">
      <p className="brand-title-row">
        <PcIcon />
        <span className="brand-title">{title}</span>
        {showMeta ? <span className="brand-encrypted">Encrypted desk REC-8236-ZIP</span> : null}
      </p>
      {showMeta ? (
        <p className="brand-presenting">
          Presenting <strong>Reshmi RZ8236</strong>
        </p>
      ) : null}
    </div>
  );
}

function SavedList({ items, empty, render, onDelete }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <ul className="saved">
      {items.slice(0, 6).map((item) => (
        <li key={item._id}>
          <div>{render(item)}</div>
          <div className="saved-actions">
            <time>{savedWhen(item)}</time>
            {onDelete ? (
              <button type="button" className="delete" onClick={() => onDelete(item._id)}>
                Delete
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StraightLine({ value }) {
  const good = Number(value) >= 50;
  return (
    <svg className="metric-line" viewBox="0 0 300 18" aria-hidden="true">
      <line x1="0" y1="9" x2="300" y2="9" className="metric-base" />
      <line
        x1="0"
        y1="9"
        x2={Math.max(8, (Number(value) / 100) * 300)}
        y2="9"
        className={good ? 'metric-good' : 'metric-down'}
      />
    </svg>
  );
}

function Gate({ status, dateLabel }) {
  const known = ATTENDANCE.includes(status);
  return (
    <div className="gate-wrap">
      <div className={`gate ${known ? `is-${status}` : 'is-idle'}`}>
        <div className="arch" />
        <div className="doors">
          <span />
          <span />
        </div>
        <div className="mark-slot">
          {status === 'present' ? <span className="date-plate">{dateLabel}</span> : null}
          {status === 'absent' || status === 'leave' ? (
            <span className="mark mark-red" aria-label="Red mark" />
          ) : null}
          {status === 'holiday' || status === 'weekoff' ? (
            <span className="mark mark-green" aria-label="Green mark" />
          ) : null}
          {!known ? <span className="gate-hint">GATE</span> : null}
        </div>
      </div>
      <p className="gate-caption">
        {status === 'present' && 'Present · date and month fetched on the gate'}
        {status === 'absent' && 'Absent · red mark on the gate'}
        {status === 'leave' && 'Leave · red mark on the gate'}
        {status === 'holiday' && 'Holiday · green mark on the gate'}
        {status === 'weekoff' && 'Week off · green mark on the gate'}
        {!known && 'Type present, absent, holiday, leave, or week off'}
      </p>
    </div>
  );
}

function SchedulePage() {
  const state = useRecords('schedule');
  const [text, setText] = useState('');
  const [clock, setClock] = useState(() => nowTimeParts());

  useEffect(() => {
    const tick = () => setClock(nowTimeParts());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page-grid">
      <Panel
        wide
        index={1}
        title="Enter Data / Text Entry"
        kicker="Working hours schedule · time fetches automatically"
        onRefresh={() => {
          setClock(nowTimeParts());
          state.refresh();
        }}
        refreshing={state.refreshing}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const live = nowTimeParts();
            setClock(live);
            const ok = await state.save({ text, from: live.from, to: live.to });
            if (ok) setText('');
          }}
        >
          <label>
            Working hours schedule
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Mon–Fri desk hours, shift notes, handover"
              rows={5}
              required
            />
          </label>
          <div className="split">
            <label>
              From
              <input type="time" value={clock.from} readOnly />
            </label>
            <label>
              To
              <input type="time" value={clock.to} readOnly />
            </label>
          </div>
          <p className="fetched">
            Fetched time · <strong>{clock.from}</strong> to <strong>{clock.to}</strong>
          </p>
          <button type="submit" className="save" disabled={state.saving}>
            {state.saving ? 'Saving…' : 'Save schedule'}
          </button>
          <Feedback error={state.error} notice={state.notice} />
        </form>
        <SavedList
          items={state.items}
          onDelete={state.remove}
          empty="No schedule saved yet."
          render={(item) => (
            <>
              <strong>{item.payload.text}</strong>
              {item.payload.from || item.payload.to ? (
                <span className="muted">
                  {' '}
                  · {item.payload.from || '—'} to {item.payload.to || '—'}
                </span>
              ) : null}
            </>
          )}
        />
      </Panel>
    </div>
  );
}

function parseMoney(value) {
  const cleaned = String(value || '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim();
  return Number(cleaned);
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SalaryPage() {
  const state = useRecords('salary');
  const [amount, setAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [status, setStatus] = useState('Pending');

  return (
    <div className="page-grid">
      <Panel
        wide
        index={2}
        title="Salary Payment"
        kicker="Payment amount, international gateway, recipient name, status"
        onRefresh={state.refresh}
        refreshing={state.refreshing}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const numeric = parseMoney(amount);
            if (!Number.isFinite(numeric) || numeric <= 0) return;
            const ok = await state.save({ amount: numeric, recipientName, status });
            if (ok) {
              setAmount('');
              setRecipientName('');
              setStatus('Pending');
            }
          }}
        >
          <div className="split">
            <label>
              <span className="label-row">
                Payment Amount
                <button type="button" className="refresh mini" onClick={state.refresh} disabled={state.refreshing}>
                  {state.refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </span>
              <div className="money-field">
                <span className="money-prefix" aria-hidden="true">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^\d.$]/g, '');
                    setAmount(next);
                  }}
                  placeholder="0.00"
                  required
                />
              </div>
            </label>
            <label>
              Payment mode
              <input value="International gateway" readOnly />
            </label>
          </div>
          <label>
            Recipient Details · Name
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Name"
              required
            />
          </label>
          <fieldset className="statuses">
            <legend>Payment status</legend>
            {STATUSES.map((item) => (
              <label
                key={item}
                className={
                  status === item
                    ? `status-choice is-${item.toLowerCase()} on`
                    : `status-choice is-${item.toLowerCase()}`
                }
              >
                <input
                  type="radio"
                  name="pay-status"
                  checked={status === item}
                  onChange={() => setStatus(item)}
                />
                {item}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="save" disabled={state.saving}>
            {state.saving ? 'Saving…' : 'Save payment'}
          </button>
          <Feedback error={state.error} notice={state.notice} />
        </form>
        <SavedList
          items={state.items}
          onDelete={state.remove}
          empty="No salary payment saved yet."
          render={(item) => (
            <>
              <strong>{formatMoney(item.payload.amount)}</strong>
              <span className="muted">
                {' '}
                · {item.payload.recipientName} · {item.payload.mode}
              </span>
              <em className={`pill is-${String(item.payload.status).toLowerCase()}`}>{item.payload.status}</em>
            </>
          )}
        />
      </Panel>
    </div>
  );
}

function RewardCard({ index, title, rewardType, placeholder }) {
  const state = useRecords('reward', rewardType);
  const [rewardTitle, setRewardTitle] = useState('');
  const [note, setNote] = useState('');

  return (
    <Panel index={index} title={title} onRefresh={state.refresh} refreshing={state.refreshing}>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await state.save({ title: rewardTitle, note });
          if (ok) {
            setRewardTitle('');
            setNote('');
          }
        }}
      >
        <label>
          Reward
          <input
            value={rewardTitle}
            onChange={(event) => setRewardTitle(event.target.value)}
            placeholder={placeholder}
            required
          />
        </label>
        <label>
          Note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </label>
        <button type="submit" className="save" disabled={state.saving}>
          {state.saving ? 'Saving…' : 'Save reward'}
        </button>
        <Feedback error={state.error} notice={state.notice} />
      </form>
      <SavedList
        items={state.items}
        onDelete={state.remove}
        empty="No reward saved yet."
        render={(item) => (
          <>
            <strong>{item.payload.title}</strong>
            {item.payload.note ? <span className="muted"> · {item.payload.note}</span> : null}
          </>
        )}
      />
    </Panel>
  );
}

function RewardsPage() {
  return (
    <div className="page-grid">
      <RewardCard index={3} title="Zipher Rewards" rewardType="zipher" placeholder="Quarter close reward" />
      <RewardCard index={4} title="Festival Rewards" rewardType="festival" placeholder="Festival reward" />
      <RewardCard
        index={5}
        title="Data Performance Rewards"
        rewardType="data"
        placeholder="Accuracy reward"
      />
    </div>
  );
}

function EventsQuizPage() {
  const events = useRecords('event');
  const quiz = useRecords('quiz');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [topic, setTopic] = useState('');
  const [score, setScore] = useState('');
  const [quizNote, setQuizNote] = useState('');

  return (
    <div className="page-grid">
      <Panel index={6} title="Upcoming Events" onRefresh={events.refresh} refreshing={events.refreshing}>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await events.save({ title, when, note });
            if (ok) {
              setTitle('');
              setWhen('');
              setNote('');
            }
          }}
        >
          <label>
            Event
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Event date
            <input value={when} onChange={(event) => setWhen(event.target.value)} placeholder="12 November" />
          </label>
          <label>
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <button type="submit" className="save" disabled={events.saving}>
            {events.saving ? 'Saving…' : 'Save event'}
          </button>
          <Feedback error={events.error} notice={events.notice} />
        </form>
        <SavedList
          items={events.items}
          onDelete={events.remove}
          empty="No upcoming event saved yet."
          render={(item) => (
            <>
              <strong>{item.payload.title}</strong>
              {item.payload.when ? <span className="muted"> · {item.payload.when}</span> : null}
              {item.payload.note ? <span className="muted"> · {item.payload.note}</span> : null}
            </>
          )}
        />
      </Panel>

      <Panel index={7} title="Quiz Assessment" onRefresh={quiz.refresh} refreshing={quiz.refreshing}>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await quiz.save({ topic, score, note: quizNote });
            if (ok) {
              setTopic('');
              setScore('');
              setQuizNote('');
            }
          }}
        >
          <label>
            Quiz
            <input value={topic} onChange={(event) => setTopic(event.target.value)} required />
          </label>
          <label>
            Score
            <input value={score} onChange={(event) => setScore(event.target.value)} placeholder="18/20" />
          </label>
          <label>
            Note
            <textarea value={quizNote} onChange={(event) => setQuizNote(event.target.value)} rows={3} />
          </label>
          <button type="submit" className="save" disabled={quiz.saving}>
            {quiz.saving ? 'Saving…' : 'Save assessment'}
          </button>
          <Feedback error={quiz.error} notice={quiz.notice} />
        </form>
        <SavedList
          items={quiz.items}
          onDelete={quiz.remove}
          empty="No quiz assessment saved yet."
          render={(item) => (
            <>
              <strong>{item.payload.topic}</strong>
              {item.payload.score ? <span className="muted"> · {item.payload.score}</span> : null}
              {item.payload.note ? <span className="muted"> · {item.payload.note}</span> : null}
            </>
          )}
        />
      </Panel>
    </div>
  );
}

function AttendancePage() {
  const state = useRecords('attendance');
  const [typed, setTyped] = useState('');
  const word = normalizeAttendance(typed);
  const status = ATTENDANCE.includes(word) ? word : '';
  const today = todayParts();

  return (
    <div className="page-grid">
      <Panel
        wide
        index={8}
        title="Attendance"
        kicker="Present fetches the date and month. Absent and leave put a red mark. Holiday and week off put a green mark."
        onRefresh={state.refresh}
        refreshing={state.refreshing}
      >
        <div className="attendance-layout">
          <Gate status={status} dateLabel={today.label} />
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!status) return;
              const ok = await state.save({ status });
              if (ok) setTyped('');
            }}
          >
            <label>
              Write attendance
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="present / week off"
                required
              />
            </label>
            {status === 'present' ? (
              <p className="fetched">
                Fetched date · <strong>{today.day}</strong> · month · <strong>{today.month}</strong> {today.year}
              </p>
            ) : null}
            <button type="submit" className="save" disabled={state.saving || !status}>
              {state.saving ? 'Saving…' : 'Save attendance'}
            </button>
            <Feedback error={state.error} notice={state.notice} />
          </form>
        </div>
        <SavedList
          items={state.items}
          onDelete={state.remove}
          empty="No attendance saved yet."
          render={(item) => (
            <span className={`attend-row is-${item.payload.status}`}>
              <i />
              <strong>{attendanceLabel(item.payload.status)}</strong>
            </span>
          )}
        />
      </Panel>
    </div>
  );
}

function ScoreControl({ label, value, onChange }) {
  const good = value >= 50;
  return (
    <div className="score">
      <div className="score-top">
        <span>{label}</span>
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
        />
        <em className={good ? 'good' : 'down'}>{good ? 'Good' : 'Down'}</em>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        aria-label={`${label} line`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <StraightLine value={value} />
    </div>
  );
}

function PerformancePage() {
  const rating = useRecords('rating');
  const performance = useRecords('performance');
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [perf, setPerf] = useState(72);
  const [accuracy, setAccuracy] = useState(64);
  const [deadline, setDeadline] = useState(40);

  return (
    <div className="page-grid">
      <Panel
        index={9}
        title="Overall Ratings"
        kicker="Star ratings"
        onRefresh={rating.refresh}
        refreshing={rating.refreshing}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await rating.save({ stars, note });
            if (ok) {
              setStars(0);
              setNote('');
            }
          }}
        >
          <div className="stars" role="group" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= stars ? 'star on' : 'star'}
                onClick={() => setStars(value)}
                aria-label={`${value} star`}
              >
                ⭐
              </button>
            ))}
          </div>
          <label>
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <button type="submit" className="save" disabled={rating.saving}>
            {rating.saving ? 'Saving…' : 'Save rating'}
          </button>
          <Feedback error={rating.error} notice={rating.notice} />
        </form>
        <SavedList
          items={rating.items}
          onDelete={rating.remove}
          empty="No rating saved yet."
          render={(item) => (
            <>
              <strong>{'⭐'.repeat(item.payload.stars)}</strong>
              {item.payload.note ? <span className="muted"> · {item.payload.note}</span> : null}
            </>
          )}
        />
      </Panel>

      <Panel
        index={10}
        title="Your Data Performance"
        kicker="Three separate straight lines. 50+ green. Under 50 red."
        onRefresh={performance.refresh}
        refreshing={performance.refreshing}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            await performance.save({ performance: perf, accuracy, deadline });
          }}
        >
          <ScoreControl label="Performance" value={perf} onChange={setPerf} />
          <ScoreControl label="Accuracy" value={accuracy} onChange={setAccuracy} />
          <ScoreControl label="Deadline" value={deadline} onChange={setDeadline} />
          <button type="submit" className="save" disabled={performance.saving}>
            {performance.saving ? 'Saving…' : 'Save performance'}
          </button>
          <Feedback error={performance.error} notice={performance.notice} />
        </form>
        <SavedList
          items={performance.items}
          onDelete={performance.remove}
          empty="No performance saved yet."
          render={(item) => (
            <div className="mini-lines">
              <span>Performance {item.payload.performance}</span>
              <StraightLine value={item.payload.performance} />
              <span>Accuracy {item.payload.accuracy}</span>
              <StraightLine value={item.payload.accuracy} />
              <span>Deadline {item.payload.deadline}</span>
              <StraightLine value={item.payload.deadline} />
            </div>
          )}
        />
      </Panel>
    </div>
  );
}

function GuidelinesPage() {
  const state = useRecords('guideline');
  const [description, setDescription] = useState('');

  return (
    <div className="page-grid">
      <Panel
        wide
        index={11}
        title="Zipher General Guidelines"
        kicker="Whatever you type is saved with the date and month."
        onRefresh={state.refresh}
        refreshing={state.refreshing}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await state.save({ description });
            if (ok) setDescription('');
          }}
        >
          <label>
            Description
            <textarea
              className="description-box"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              placeholder="Type the guideline"
              required
            />
          </label>
          <button type="submit" className="save" disabled={state.saving}>
            {state.saving ? 'Saving…' : 'Save guideline'}
          </button>
          <Feedback error={state.error} notice={state.notice} />
        </form>
        <SavedList
          items={state.items}
          onDelete={state.remove}
          empty="No guideline saved yet."
          render={(item) => <strong className="pre">{item.payload.description}</strong>}
        />
      </Panel>
    </div>
  );
}

function Row({ title, meta, when, onDelete }) {
  return (
    <li>
      <div>
        <strong>{title}</strong>
        {meta ? <span className="muted"> · {meta}</span> : null}
      </div>
      <div className="saved-actions">
        <time>{when}</time>
        {onDelete ? (
          <button type="button" className="delete" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Block({ title, children, count }) {
  return (
    <article className="summary-block">
      <h3>
        {title}
        <span>{count}</span>
      </h3>
      {count === 0 ? <p className="empty">Nothing saved in this section.</p> : <ul className="saved">{children}</ul>}
    </article>
  );
}

function SummaryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setData(await fetchSummary());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onSave = () => refresh();
    window.addEventListener('zipher-saved', onSave);
    return () => window.removeEventListener('zipher-saved', onSave);
  }, [refresh]);

  const grouped = data?.grouped;
  const rewards = [
    ...(grouped?.rewards.zipher || []).map((item) => ({ ...item, bucket: 'Zipher' })),
    ...(grouped?.rewards.festival || []).map((item) => ({ ...item, bucket: 'Festival' })),
    ...(grouped?.rewards.data || []).map((item) => ({ ...item, bucket: 'Data performance' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="page-grid">
      <Panel
        wide
        index={12}
        title="Details"
        kicker="Salary, upcoming events, and rewards, each with date and month."
      >
        <Feedback error={error} notice="" />
        <div className="summary-grid">
          <Block title="Salary payment" count={grouped?.salary.length || 0}>
            {grouped?.salary.map((item) => (
              <Row
                key={item._id}
                title={`${formatMoney(item.payload.amount)} · ${item.payload.recipientName}`}
                meta={`${item.payload.mode} · ${item.payload.status}`}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Upcoming events" count={grouped?.event.length || 0}>
            {grouped?.event.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={[item.payload.when, item.payload.note].filter(Boolean).join(' · ')}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Rewards" count={rewards.length}>
            {rewards.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={[item.bucket, item.payload.note].filter(Boolean).join(' · ')}
                when={savedWhen(item)}
              />
            ))}
          </Block>
        </div>
      </Panel>

      <Panel
        wide
        index={13}
        title="Full Summary"
        kicker="Encrypted desk REC-8236-ZIP · Presenting Reshmi RZ8236"
      >
        <Feedback error={error} notice="" />
        <div className="summary-grid">
          <Block title="Working hours" count={grouped?.schedule.length || 0}>
            {grouped?.schedule.map((item) => (
              <Row
                key={item._id}
                title={item.payload.text}
                meta={item.payload.from || item.payload.to ? `${item.payload.from || '—'} to ${item.payload.to || '—'}` : ''}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Salary payment" count={grouped?.salary.length || 0}>
            {grouped?.salary.map((item) => (
              <Row
                key={item._id}
                title={`${item.payload.recipientName} · ${item.payload.status}`}
                meta={`${formatMoney(item.payload.amount)} · ${item.payload.mode}`}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Zipher rewards" count={grouped?.rewards.zipher.length || 0}>
            {grouped?.rewards.zipher.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={item.payload.note}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Festival rewards" count={grouped?.rewards.festival.length || 0}>
            {grouped?.rewards.festival.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={item.payload.note}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Data performance rewards" count={grouped?.rewards.data.length || 0}>
            {grouped?.rewards.data.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={item.payload.note}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Upcoming events" count={grouped?.event.length || 0}>
            {grouped?.event.map((item) => (
              <Row
                key={item._id}
                title={item.payload.title}
                meta={[item.payload.when, item.payload.note].filter(Boolean).join(' · ')}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Quiz assessment" count={grouped?.quiz.length || 0}>
            {grouped?.quiz.map((item) => (
              <Row
                key={item._id}
                title={item.payload.topic}
                meta={[item.payload.score, item.payload.note].filter(Boolean).join(' · ')}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Attendance" count={grouped?.attendance.length || 0}>
            {grouped?.attendance.map((item) => (
              <Row key={item._id} title={attendanceLabel(item.payload.status)} when={savedWhen(item)} />
            ))}
          </Block>
          <Block title="Overall ratings" count={grouped?.rating.length || 0}>
            {grouped?.rating.map((item) => (
              <Row
                key={item._id}
                title={'⭐'.repeat(item.payload.stars)}
                meta={item.payload.note}
                when={savedWhen(item)}
              />
            ))}
          </Block>
          <Block title="Data performance" count={grouped?.performance.length || 0}>
            {grouped?.performance.map((item) => (
              <li key={item._id}>
                <div className="mini-lines">
                  <span>Performance {item.payload.performance}</span>
                  <StraightLine value={item.payload.performance} />
                  <span>Accuracy {item.payload.accuracy}</span>
                  <StraightLine value={item.payload.accuracy} />
                  <span>Deadline {item.payload.deadline}</span>
                  <StraightLine value={item.payload.deadline} />
                </div>
                <div className="saved-actions">
                  <time>{savedWhen(item)}</time>
                </div>
              </li>
            ))}
          </Block>
          <Block title="General guidelines" count={grouped?.guideline.length || 0}>
            {grouped?.guideline.map((item) => (
              <Row key={item._id} title={item.payload.description} when={savedWhen(item)} />
            ))}
          </Block>
        </div>
      </Panel>
    </div>
  );
}

function HomePage({ onOpen }) {
  return (
    <>
      <section className="home-hero">
        <BrandLines />
        <div className="home-actions">
          <button type="button" className="save" onClick={() => onOpen('schedule')}>
            Open schedule
          </button>
          <button type="button" className="ghost" onClick={() => onOpen('summary')}>
            View full summary
          </button>
        </div>
      </section>

      <div className="card-grid">
        {PAGES.filter((page) => page.id !== 'home').map((page, index) => (
          <button key={page.id} type="button" className="jump-card" onClick={() => onOpen(page.id)}>
            <span className="num">{String(index + 1).padStart(2, '0')}</span>
            <strong>{page.label}</strong>
            <span>{page.note}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function AuthGate({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const data = await login(email, password);
            setSession(data.token, data.user);
            onSuccess(data.user);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <BrandLines showMeta={false} />

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
            minLength={6}
          />
        </label>

        <button type="submit" className="save auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Login'}
        </button>
        <Feedback error={error} notice="" />
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [page, setPage] = useState('home');
  const [alert, setAlert] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = PAGES.find((item) => item.id === page) || PAGES[0];

  const openPage = (id) => {
    setPage(id);
    setMenuOpen(false);
  };

  useEffect(() => {
    let alive = true;
    async function boot() {
      if (!getToken()) {
        setChecking(false);
        return;
      }
      try {
        const data = await fetchMe();
        if (alive) setUser(data.user);
      } catch {
        if (alive) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (alive) setChecking(false);
      }
    }
    boot();
    const onLost = () => setUser(null);
    window.addEventListener('zipher-auth-lost', onLost);
    return () => {
      alive = false;
      window.removeEventListener('zipher-auth-lost', onLost);
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= 5000) {
        setAlert(true);
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (checking) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <BrandLines showMeta={false} />
          <p className="side-meta">Checking login…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onSuccess={setUser} />;
  }

  return (
    <div className={alert ? `app-shell is-alert${menuOpen ? ' menu-open' : ''}` : `app-shell${menuOpen ? ' menu-open' : ''}`}>
      <button
        type="button"
        className="menu-backdrop"
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />

      <aside className="sidebar" id="app-sidebar">
        <div className="side-brand">
          <div className="side-brand-top">
            <BrandLines />
            <button
              type="button"
              className="menu-close"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              ✕
            </button>
          </div>
          <ProfileChip email={user.email} className="side-user" />
          <button
            type="button"
            className="ghost logout"
            onClick={() => {
              clearSession();
              setUser(null);
              setPage('home');
              setAlert(false);
              setMenuOpen(false);
            }}
          >
            Logout
          </button>
        </div>

        <nav className="side-nav" aria-label="Pages">
          {PAGES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? 'nav-btn active' : 'nav-btn'}
              onClick={() => openPage(item.id)}
            >
              <span className="nav-num">{String(index).padStart(2, '0')}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="top-strip">
          <div className="top-left">
            <button
              type="button"
              className="hamburger"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              onClick={() => setMenuOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <h2 className="page-title">{current.label}</h2>
              <p className="page-sub">{current.note}</p>
            </div>
          </div>
          <div className="top-right">
            <ProfileChip email={user.email} className="top-email" />
            <LiveSignal />
          </div>
        </header>

        <main className="content">
          {page === 'home' && <HomePage onOpen={openPage} />}
          {page === 'schedule' && <SchedulePage />}
          {page === 'salary' && <SalaryPage />}
          {page === 'rewards' && <RewardsPage />}
          {page === 'events' && <EventsQuizPage />}
          {page === 'attendance' && <AttendancePage />}
          {page === 'performance' && <PerformancePage />}
          {page === 'guidelines' && <GuidelinesPage />}
          {page === 'summary' && <SummaryPage />}
        </main>
      </div>
    </div>
  );
}
