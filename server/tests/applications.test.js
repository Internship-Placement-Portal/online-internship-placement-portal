const fs = require('fs');
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const config = require('../src/config/env');
const Listing = require('../src/models/Listing');
const Application = require('../src/models/Application');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');
const scanService = require('../src/services/scanService');
const mailer = require('../src/services/mailer');
const { startDb, stopDb, clearDb, createUser, listingBody, futureDate } = require('./helpers');

before(startDb);
after(async () => {
  fs.rmSync(config.upload.dir, { recursive: true, force: true });
  await stopDb();
});
beforeEach(clearDb);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const filesOnDisk = () => (fs.existsSync(config.upload.dir) ? fs.readdirSync(config.upload.dir).length : 0);

async function setup() {
  const student = await createUser({ role: 'student' });
  const recruiter = await createUser({ role: 'recruiter' });
  const listing = await Listing.create({
    ...listingBody(),
    deadline: new Date(`${futureDate()}T23:59:59.999Z`),
    company: 'Acme',
    recruiter: recruiter.user._id,
    status: 'approved',
  });
  return { student, recruiter, listing };
}

const apply = (who, listingId, file = PDF, opts = { filename: 'cv.pdf', contentType: 'application/pdf' }) =>
  request(app).post('/api/applications').set(who.auth).field('listingId', String(listingId)).attach('resume', file, opts);

describe('apply with resume (IPP-F-010)', () => {
  it('records an application linking student, listing and resume, and stores the file', async () => {
    const { student, listing } = await setup();
    const before = filesOnDisk();
    const res = await apply(student, listing._id);
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe('Applied');
    expect(res.body.application.resumeOriginalName).toBe('cv.pdf');
    expect(JSON.stringify(res.body)).not.toContain('resumeKey');
    expect(filesOnDisk()).toBe(before + 1);
    const doc = await Application.findOne({}).select('+resumeKey');
    expect(String(doc.student)).toBe(String(student.user._id));
    expect(String(doc.listing)).toBe(String(listing._id));
    expect(doc.resumeKey).toMatch(/^[a-f0-9]{32}\.pdf$/);
  });

  it('tells the student on the listing page whether they already applied', async () => {
    const { student, listing } = await setup();
    const before = await request(app).get(`/api/listings/${listing._id}`).set(student.auth);
    expect(before.body.listing.application).toBe(null);
    const { body } = await apply(student, listing._id);
    const after = await request(app).get(`/api/listings/${listing._id}`).set(student.auth);
    expect(after.body.listing.application).toEqual({ id: body.application.id, status: 'Applied' });
  });

  it('blocks duplicate applications without storing a second file', async () => {
    const { student, listing } = await setup();
    await apply(student, listing._id);
    const n = filesOnDisk();
    const dup = await apply(student, listing._id);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_APPLIED');
    expect(filesOnDisk()).toBe(n);
    expect(await Application.countDocuments()).toBe(1);
  });

  it('rejects unavailable listings: unknown, unapproved, expired', async () => {
    const { student, recruiter } = await setup();
    const draft = await Listing.create({ ...listingBody(), company: 'X', recruiter: recruiter.user._id, deadline: new Date(Date.now() + 864e5), status: 'draft' });
    const expired = await Listing.create({ ...listingBody(), company: 'X', recruiter: recruiter.user._id, deadline: new Date(Date.now() - 864e5), status: 'approved' });
    expect((await apply(student, '64b000000000000000000000')).status).toBe(404);
    expect((await apply(student, draft._id)).status).toBe(404);
    const exp = await apply(student, expired._id);
    expect(exp.status).toBe(409);
    expect(exp.body.code).toBe('LISTING_EXPIRED');
  });

  it('is student only and requires authentication and a listingId', async () => {
    const { student, recruiter, listing } = await setup();
    expect((await apply(recruiter, listing._id)).status).toBe(403);
    expect((await request(app).post('/api/applications').field('listingId', String(listing._id)).attach('resume', PDF, 'cv.pdf')).status).toBe(401);
    expect((await request(app).post('/api/applications').set(student.auth).attach('resume', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })).status).toBe(400);
  });
});

describe('resume validation and scanning (IPP-SR-005)', () => {
  it('rejects non-PDF extension, wrong mime type and a missing file', async () => {
    const { student, listing } = await setup();
    expect((await apply(student, listing._id, PDF, { filename: 'cv.docx', contentType: 'application/pdf' })).status).toBe(400);
    expect((await apply(student, listing._id, PDF, { filename: 'cv.pdf', contentType: 'text/plain' })).status).toBe(400);
    const none = await request(app).post('/api/applications').set(student.auth).field('listingId', String(listing._id));
    expect(none.status).toBe(400);
    expect(await Application.countDocuments()).toBe(0);
  });

  it('rejects files that are not really PDFs even if named .pdf', async () => {
    const { student, listing } = await setup();
    const fake = Buffer.from('MZ\x90\x00 this is an executable pretending to be a pdf %%EOF');
    const res = await apply(student, listing._id, fake);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
    const truncated = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj but no end marker here');
    expect((await apply(student, listing._id, truncated)).status).toBe(400);
  });

  it('rejects files over 5 MB with 413', async () => {
    const { student, listing } = await setup();
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10, 0x20), Buffer.from('\n%%EOF')]);
    const res = await apply(student, listing._id, big);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('accepts a file just under the limit', async () => {
    const { student, listing } = await setup();
    const ok = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(4 * 1024 * 1024, 0x20), Buffer.from('\n%%EOF')]);
    expect((await apply(student, listing._id, ok)).status).toBe(201);
  });

  it('blocks PDFs with embedded JavaScript and stores nothing', async () => {
    const { student, listing } = await setup();
    const n = filesOnDisk();
    const evil = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert(1)) >>\nendobj\n%%EOF');
    const res = await apply(student, listing._id, evil);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(filesOnDisk()).toBe(n);
  });

  it('runs registered scanner hooks and fails closed when a scanner errors', async () => {
    const { student, listing } = await setup();
    const unregister = scanService.registerScanner(async () => ({ clean: false, reason: 'Malware detected' }));
    expect((await apply(student, listing._id)).status).toBe(422);
    unregister();

    const unregister2 = scanService.registerScanner(async () => {
      throw new Error('scanner down');
    });
    const res = await apply(student, listing._id);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SCAN_UNAVAILABLE');
    unregister2();
    expect((await apply(student, listing._id)).status).toBe(201);
  });

  it('sanitises path tricks in the original file name', async () => {
    const { student, listing } = await setup();
    const res = await apply(student, listing._id, PDF, { filename: '../../etc/pass<script>.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.application.resumeOriginalName).not.toContain('/');
    expect(res.body.application.resumeOriginalName).not.toContain('<');
  });
});

describe('applications lists and resume access (IPP-F-010, IPP-F-011)', () => {
  it('lets the student list their applications with listing info', async () => {
    const { student, listing } = await setup();
    await apply(student, listing._id);
    const res = await request(app).get('/api/applications/mine').set(student.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].listing.title).toBe('Backend Developer Intern');
  });

  it('lets the owning recruiter list and filter applicants; other recruiters get 403', async () => {
    const { student, recruiter, listing } = await setup();
    const other = await createUser({ role: 'recruiter' });
    await apply(student, listing._id);
    const res = await request(app).get(`/api/listings/${listing._id}/applications`).set(recruiter.auth);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].student.email).toBe(student.user.email);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect((await request(app).get(`/api/listings/${listing._id}/applications?status=Selected`).set(recruiter.auth)).body.total).toBe(0);
    expect((await request(app).get(`/api/listings/${listing._id}/applications`).set(other.auth)).status).toBe(403);
    expect((await request(app).get(`/api/listings/${listing._id}/applications`).set(student.auth)).status).toBe(403);
  });

  it('serves the PDF only to the applicant and the owning recruiter', async () => {
    const { student, recruiter, listing } = await setup();
    const otherStudent = await createUser({ role: 'student' });
    const otherRecruiter = await createUser({ role: 'recruiter' });
    const admin = await createUser({ role: 'admin' });
    const { body } = await apply(student, listing._id);
    const url = `/api/applications/${body.application.id}/resume`;

    const mine = await request(app).get(url).set(student.auth).buffer().parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toMatch(/application\/pdf/);
    expect(mine.body.equals(PDF)).toBe(true);
    expect((await request(app).get(url).set(recruiter.auth)).status).toBe(200);
    expect((await request(app).get(url).set(otherStudent.auth)).status).toBe(403);
    expect((await request(app).get(url).set(otherRecruiter.auth)).status).toBe(403);
    expect((await request(app).get(url).set(admin.auth)).status).toBe(403);
    expect((await request(app).get(url)).status).toBe(401);
  });
});

describe('status management + notifications (IPP-F-011, IPP-F-012)', () => {
  it('persists the change, shows it to the student, audits it and notifies in-app and by email', async () => {
    const { student, recruiter, listing } = await setup();
    const { body } = await apply(student, listing._id);
    const id = body.application.id;
    mailer.outbox.length = 0;

    const res = await request(app).patch(`/api/applications/${id}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('Shortlisted');
    expect(res.body.application.statusHistory).toHaveLength(2);

    const mine = await request(app).get('/api/applications/mine').set(student.auth);
    expect(mine.body.items[0].status).toBe('Shortlisted');

    const notes = await request(app).get('/api/notifications').set(student.auth);
    expect(notes.body.unread).toBe(1);
    expect(notes.body.items[0].message).toContain('Shortlisted');
    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0].to).toBe(student.user.email);

    const log = await AuditLog.findOne({ action: 'APPLICATION_STATUS_CHANGED' });
    expect(String(log.actor)).toBe(String(recruiter.user._id));
    expect(log.metadata.from).toBe('Applied');
    expect(log.metadata.to).toBe('Shortlisted');
  });

  it('validates status values, rejects no-op changes and enforces ownership', async () => {
    const { student, recruiter, listing } = await setup();
    const other = await createUser({ role: 'recruiter' });
    const { body } = await apply(student, listing._id);
    const url = `/api/applications/${body.application.id}/status`;
    expect((await request(app).patch(url).set(recruiter.auth).send({ status: 'Maybe' })).status).toBe(400);
    expect((await request(app).patch(url).set(recruiter.auth).send({ status: 'Applied' })).status).toBe(409);
    expect((await request(app).patch(url).set(other.auth).send({ status: 'Selected' })).status).toBe(403);
    expect((await request(app).patch(url).set(student.auth).send({ status: 'Selected' })).status).toBe(403);
    expect((await request(app).patch('/api/applications/64b000000000000000000000/status').set(recruiter.auth).send({ status: 'Selected' })).status).toBe(404);
    expect((await Application.findById(body.application.id)).status).toBe('Applied');
  });

  it('a failing email provider is retried and never breaks the status update', async () => {
    let calls = 0;
    const ok = await mailer.sendWithRetry({ to: 'a@b.c', subject: 's', text: 't' }, {
      retries: 2,
      baseDelayMs: 1,
      sender: async () => {
        calls += 1;
        throw new Error('smtp down');
      },
    });
    expect(ok).toBe(false);
    expect(calls).toBe(3);
    let attempts = 0;
    const eventually = await mailer.sendWithRetry({ to: 'a@b.c', subject: 's', text: 't' }, {
      baseDelayMs: 1,
      sender: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('flaky');
      },
    });
    expect(eventually).toBe(true);
  });

  it('notifications: list, mark one read, mark all read, and never leak across users', async () => {
    const { student, recruiter, listing } = await setup();
    const other = await createUser({ role: 'student' });
    const { body } = await apply(student, listing._id);
    await request(app).patch(`/api/applications/${body.application.id}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    await request(app).patch(`/api/applications/${body.application.id}/status`).set(recruiter.auth).send({ status: 'Selected' });

    const list = await request(app).get('/api/notifications').set(student.auth);
    expect(list.body.total).toBe(2);
    expect(list.body.unread).toBe(2);
    expect((await request(app).get('/api/notifications').set(other.auth)).body.total).toBe(0);

    const id = list.body.items[0].id;
    expect((await request(app).patch(`/api/notifications/${id}/read`).set(other.auth)).status).toBe(404);
    expect((await request(app).patch(`/api/notifications/${id}/read`).set(student.auth)).body.notification.read).toBe(true);
    expect((await request(app).get('/api/notifications?unread=true').set(student.auth)).body.total).toBe(1);
    await request(app).post('/api/notifications/read-all').set(student.auth);
    expect((await request(app).get('/api/notifications').set(student.auth)).body.unread).toBe(0);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect(await Notification.countDocuments()).toBe(2);
  });
});

describe('interview scheduling (IPP-F-013)', () => {
  const when = () => new Date(Date.now() + 3 * 864e5).toISOString();

  it('only works for shortlisted candidates and is visible to the student', async () => {
    const { student, recruiter, listing } = await setup();
    const { body } = await apply(student, listing._id);
    const id = body.application.id;
    const payload = { date: when(), mode: 'online', link: 'https://meet.example.com/abc', notes: 'Bring your portfolio' };

    const early = await request(app).put(`/api/applications/${id}/interview`).set(recruiter.auth).send(payload);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('NOT_SHORTLISTED');

    await request(app).patch(`/api/applications/${id}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    const res = await request(app).put(`/api/applications/${id}/interview`).set(recruiter.auth).send(payload);
    expect(res.status).toBe(200);
    expect(res.body.application.interview.mode).toBe('online');

    const seen = await request(app).get(`/api/applications/${id}`).set(student.auth);
    expect(seen.body.application.interview.link).toBe('https://meet.example.com/abc');
    expect(seen.body.application.interview.notes).toBe('Bring your portfolio');
    expect(await Notification.countDocuments({ type: 'interview_scheduled' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'INTERVIEW_SCHEDULED' })).toBe(1);
  });

  it('validates date, mode and link, supports in-person without a link, and allows rescheduling', async () => {
    const { student, recruiter, listing } = await setup();
    const { body } = await apply(student, listing._id);
    const id = body.application.id;
    await request(app).patch(`/api/applications/${id}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    const put = (b) => request(app).put(`/api/applications/${id}/interview`).set(recruiter.auth).send(b);

    expect((await put({ date: '2020-01-01T10:00:00Z', mode: 'online', link: 'https://x.test' })).status).toBe(400);
    expect((await put({ date: when(), mode: 'phone' })).status).toBe(400);
    expect((await put({ date: when(), mode: 'online' })).status).toBe(400);
    expect((await put({ date: when(), mode: 'online', link: 'javascript:alert(1)' })).status).toBe(400);
    expect((await put({ date: when(), mode: 'in-person', notes: 'Room 4, HQ' })).status).toBe(200);
    expect((await put({ date: when(), mode: 'in-person', notes: 'Room 7, HQ' })).status).toBe(200);
    expect((await Notification.findOne({ type: 'interview_scheduled' }).sort({ createdAt: -1 })).message).toContain('rescheduled');
  });

  it('is limited to the owning recruiter', async () => {
    const { student, recruiter, listing } = await setup();
    const other = await createUser({ role: 'recruiter' });
    const { body } = await apply(student, listing._id);
    const id = body.application.id;
    await request(app).patch(`/api/applications/${id}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    const b = { date: when(), mode: 'in-person' };
    expect((await request(app).put(`/api/applications/${id}/interview`).set(other.auth).send(b)).status).toBe(403);
    expect((await request(app).put(`/api/applications/${id}/interview`).set(student.auth).send(b)).status).toBe(403);
  });
});
