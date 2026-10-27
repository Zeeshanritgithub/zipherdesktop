import net from 'net';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = process.env.PORT || 5000;
const LOCAL_URI = 'mongodb://127.0.0.1:27017/zipher';
const JWT_SECRET = process.env.JWT_SECRET || 'zipher-rz8236-desk-secret';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

const recordSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: [
        'schedule',
        'salary',
        'reward',
        'event',
        'quiz',
        'attendance',
        'rating',
        'performance',
        'guideline',
      ],
    },
    rewardType: {
      type: String,
      enum: ['zipher', 'festival', 'data'],
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    day: { type: String, required: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

recordSchema.index({ kind: 1, createdAt: -1 });
recordSchema.index({ userId: 1, kind: 1, createdAt: -1 });

const Record = mongoose.model('Record', recordSchema);

function signToken(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: String(user._id), email: user.email, name: user.name || '' };
}

function requireAuth(req, _res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw Object.assign(new Error('Login required.'), { status: 401 });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (error) {
    if (error.status) return next(error);
    next(Object.assign(new Error('Session expired. Login again.'), { status: 401 }));
  }
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validateCredentials(email, password) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw bad('Enter a valid email.');
  if (cleanPassword.length < 6) throw bad('Password must be at least 6 characters.');
  return { email: cleanEmail, password: cleanPassword };
}

function stampNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return { day: pick('day'), month: pick('month'), year: pick('year') };
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function text(value, label, { required = false, max = 4000 } = {}) {
  const cleaned = String(value ?? '').trim();
  if (required && !cleaned) throw bad(`${label} is required.`);
  if (cleaned.length > max) throw bad(`${label} is too long.`);
  return cleaned;
}

function score(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw bad(`${label} must be a number.`);
  return Math.max(0, Math.min(100, Math.round(number)));
}

function buildRecord(body) {
  const kind = text(body.kind, 'Section', { required: true, max: 40 });
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw bad('Enter the details before saving.');
  }

  if (kind === 'schedule') {
    return {
      kind,
      payload: {
        text: text(payload.text, 'Working hours schedule', { required: true }),
        from: text(payload.from, 'Start time', { max: 20 }),
        to: text(payload.to, 'End time', { max: 20 }),
      },
    };
  }

  if (kind === 'salary') {
    const amount = Number(String(payload.amount ?? '').replace(/[$,\s]/g, ''));
    const status = text(payload.status, 'Payment status', { required: true, max: 20 });
    const allowed = ['Success', 'Fail', 'Paid', 'Pending'];
    if (!Number.isFinite(amount) || amount <= 0) throw bad('Enter a valid payment amount.');
    if (!allowed.includes(status)) throw bad('Choose a payment status.');
    return {
      kind,
      payload: {
        amount: Math.round(amount * 100) / 100,
        mode: 'International gateway',
        recipientName: text(payload.recipientName, 'Name', { required: true, max: 120 }),
        status,
      },
    };
  }

  if (kind === 'reward') {
    const rewardType = text(body.rewardType, 'Reward type', { required: true, max: 20 });
    if (!['zipher', 'festival', 'data'].includes(rewardType)) throw bad('Reward type is invalid.');
    return {
      kind,
      rewardType,
      payload: {
        title: text(payload.title, 'Reward title', { required: true, max: 160 }),
        note: text(payload.note, 'Reward note'),
      },
    };
  }

  if (kind === 'event') {
    return {
      kind,
      payload: {
        title: text(payload.title, 'Event name', { required: true, max: 160 }),
        when: text(payload.when, 'Event date', { max: 120 }),
        note: text(payload.note, 'Event note'),
      },
    };
  }

  if (kind === 'quiz') {
    return {
      kind,
      payload: {
        topic: text(payload.topic, 'Quiz topic', { required: true, max: 160 }),
        score: text(payload.score, 'Score', { max: 40 }),
        note: text(payload.note, 'Assessment note'),
      },
    };
  }

  if (kind === 'attendance') {
    let status = text(payload.status, 'Attendance', { required: true, max: 30 })
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (status === 'week off' || status === 'weekoff') status = 'weekoff';
    if (!['present', 'absent', 'holiday', 'leave', 'weekoff'].includes(status)) {
      throw bad('Type present, absent, holiday, leave, or week off.');
    }
    return { kind, payload: { status } };
  }

  if (kind === 'rating') {
    const stars = Number(payload.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw bad('Choose a star rating from 1 to 5.');
    }
    return {
      kind,
      payload: {
        stars,
        note: text(payload.note, 'Rating note'),
      },
    };
  }

  if (kind === 'performance') {
    return {
      kind,
      payload: {
        performance: score(payload.performance, 'Performance'),
        accuracy: score(payload.accuracy, 'Accuracy'),
        deadline: score(payload.deadline, 'Deadline'),
      },
    };
  }

  if (kind === 'guideline') {
    return {
      kind,
      payload: {
        description: text(payload.description, 'Guideline', { required: true }),
      },
    };
  }

  throw bad('Unknown section.');
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(800);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

let dbMode = 'unknown';

async function connectDatabase() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    dbMode = 'mongodb';
    return;
  }

  if (await portOpen(27017)) {
    await mongoose.connect(LOCAL_URI);
    dbMode = 'local';
    return;
  }

  const memory = await MongoMemoryServer.create();
  globalThis.__zipherMemory = memory;
  await mongoose.connect(memory.getUri('zipher'));
  dbMode = 'memory';
}

function groupRecords(records) {
  const grouped = {
    schedule: [],
    salary: [],
    rewards: { zipher: [], festival: [], data: [] },
    event: [],
    quiz: [],
    attendance: [],
    rating: [],
    performance: [],
    guideline: [],
  };

  for (const record of records) {
    if (record.kind === 'reward') {
      grouped.rewards[record.rewardType]?.push(record);
    } else if (grouped[record.kind]) {
      grouped[record.kind].push(record);
    }
  }

  return grouped;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Zipher Virtual Desktop',
    presenter: 'Reshmi RZ8236',
    encrypted: 'REC-8236-ZIP',
    db: dbMode,
  });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { email, password } = validateCredentials(req.body.email, req.body.password);
    const name = text(req.body.name, 'Name', { max: 80 });
    const existing = await User.findOne({ email });
    if (existing) throw bad('This email is already registered. Login instead.');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = validateCredentials(req.body.email, req.body.password);
    const user = await User.findOne({ email });
    if (!user) throw Object.assign(new Error('Wrong email or password.'), { status: 401 });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Object.assign(new Error('Wrong email or password.'), { status: 401 });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw Object.assign(new Error('Login required.'), { status: 401 });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/records', requireAuth, async (req, res, next) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.kind) filter.kind = String(req.query.kind);
    if (req.query.rewardType) filter.rewardType = String(req.query.rewardType);
    const records = await Record.find(filter).sort({ createdAt: -1 }).lean();
    res.json(records);
  } catch (error) {
    next(error);
  }
});

app.post('/api/records', requireAuth, async (req, res, next) => {
  try {
    const record = await Record.create({
      ...buildRecord(req.body),
      ...stampNow(),
      userId: req.user.id,
    });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/records/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw bad('Invalid entry.');
    const record = await Record.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!record) {
      const error = new Error('Entry not found.');
      error.status = 404;
      throw error;
    }
    res.json({ ok: true, id: record._id });
  } catch (error) {
    next(error);
  }
});

app.get('/api/summary', requireAuth, async (req, res, next) => {
  try {
    const records = await Record.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json({
      presenter: 'Reshmi RZ8236',
      encrypted: 'REC-8236-ZIP',
      count: records.length,
      grouped: groupRecords(records),
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || 'Server error' });
});

async function ensureDefaultUser() {
  const email = 'zipher90@gmail.com';
  const password = 'RZ8236';
  const passwordHash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email },
    { email, passwordHash, name: 'Reshmi RZ8236' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Default login ready: ${email}`);
}

connectDatabase()
  .then(async () => {
    await ensureDefaultUser();
    app.listen(PORT, () => {
      console.log(`Zipher API on http://localhost:${PORT} (${dbMode})`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
