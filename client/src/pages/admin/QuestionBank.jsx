import { useState } from 'react';
import Select from '../../components/Select.jsx';
import { Archive, ArchiveRestore, FileQuestion, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { createQuestionApi, deleteQuestionApi, listQuestionsApi, questionCategoriesApi, updateQuestionApi } from '../../api/tests.js';
import { errorInfo } from '../../api/http.js';
import { Alert, EmptyState, Field, Modal, PageHead, Pagination, Skeletons, useAsync, useToast } from '../../components/ui.jsx';

const DIFFICULTY_TONE = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

function QuestionForm({ question, categories, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(question);
  const [form, setForm] = useState({
    type: question?.type || 'mcq',
    text: question?.text || '',
    category: question?.category || '',
    difficulty: question?.difficulty || 'medium',
    marks: question?.marks || 1,
    options: question?.options || ['', '', '', ''],
    correctIndex: question?.correctIndex ?? 0,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setOption = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const removeOption = (i) =>
    setForm((f) => ({
      ...f,
      options: f.options.filter((_, j) => j !== i),
      correctIndex: f.correctIndex === i ? 0 : f.correctIndex > i ? f.correctIndex - 1 : f.correctIndex,
    }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    const body = {
      text: form.text,
      category: form.category,
      difficulty: form.difficulty,
      marks: Number(form.marks),
      ...(form.type === 'mcq' && { options: form.options.map((o) => o.trim()).filter(Boolean), correctIndex: form.correctIndex }),
    };
    try {
      if (editing) await updateQuestionApi(question.id, body);
      else await createQuestionApi({ ...body, type: form.type });
      toast(editing ? 'Question updated' : 'Question added', 'success');
      onSaved();
    } catch (err) {
      const info = errorInfo(err);
      setError(info.message);
      setErrors(Object.fromEntries(info.errors.map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit question' : 'Add question'} onClose={onClose} wide>
      <form onSubmit={save} noValidate className="stack" style={{ gap: 14 }}>
        {!editing && (
          <Field id="type" label="Type">
            {(a) => (
              <Select {...a} value={form.type} onChange={set('type')}>
                <option value="mcq">Multiple choice</option>
                <option value="coding">Coding</option>
              </Select>
            )}
          </Field>
        )}
        <Field id="text" label="Question" error={errors.text}>
          {(a) => <textarea {...a} value={form.text} onChange={set('text')} style={{ minHeight: '5.5rem' }} maxLength={2000} required />}
        </Field>
        <div className="form-grid">
          <Field id="category" label="Category" error={errors.category} hint="Pick an existing one or type a new one.">
            {(a) => (
              <>
                <input {...a} list="categories" value={form.category} onChange={set('category')} required />
                <datalist id="categories">
                  {(categories || []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field id="difficulty" label="Difficulty">
              {(a) => (
                <Select {...a} value={form.difficulty} onChange={set('difficulty')}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              )}
            </Field>
            <Field id="marks" label="Marks" error={errors.marks}>
              {(a) => <input {...a} type="number" min="1" max="10" value={form.marks} onChange={set('marks')} />}
            </Field>
          </div>
        </div>

        {form.type === 'mcq' && (
          <fieldset className="options" style={{ gap: 8 }}>
            <legend className="label" style={{ marginTop: 0 }}>
              Options — select the correct answer
            </legend>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name="correct" checked={form.correctIndex === i} onChange={() => setForm((f) => ({ ...f, correctIndex: i }))} aria-label={`Option ${i + 1} is correct`} />
                <input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} aria-label={`Option ${String.fromCharCode(65 + i)} text`} maxLength={300} />
                {form.options.length > 2 && (
                  <button type="button" className="icon-btn" onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {form.options.length < 6 && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}>
                <Plus size={14} aria-hidden="true" /> Add option
              </button>
            )}
            {(errors.options || errors.correctIndex) && <p className="field-error">{errors.options || errors.correctIndex}</p>}
          </fieldset>
        )}
        {form.type === 'coding' && <p className="hint">Coding questions are answered as free text and are not auto-scored.</p>}

        {error && !Object.keys(errors).length && <Alert tone="danger">{error}</Alert>}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save question'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// IPP-F-014: admin question-bank management.
export default function QuestionBank() {
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', category: '', type: '', difficulty: '', active: '' });
  const [draftQ, setDraftQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // question | 'new' | null
  const { data: categories, reload: reloadCats } = useAsync(questionCategoriesApi, []);
  const { data, loading, error, reload } = useAsync(() => listQuestionsApi({ ...filters, page, limit: 12 }), [JSON.stringify(filters), page]);

  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  async function toggleActive(q) {
    try {
      await updateQuestionApi(q.id, { active: !q.active });
      toast(q.active ? 'Question archived' : 'Question restored', 'success');
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }
  async function remove(q) {
    if (!window.confirm('Delete this question permanently?')) return;
    try {
      await deleteQuestionApi(q.id);
      toast('Question deleted', 'success');
      reload();
      reloadCats();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  return (
    <>
      <PageHead
        title="Question bank"
        subtitle="Questions are drawn at random from here when a student starts a test."
        actions={
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            <Plus size={17} aria-hidden="true" /> Add question
          </button>
        }
      />
      <form
        className="card filters"
        style={{ gridTemplateColumns: '2fr repeat(4, minmax(0, 1fr))' }}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, q: draftQ }));
          setPage(1);
        }}
      >
        <div className="field">
          <label htmlFor="fq">Search</label>
          <div className="input-icon">
            <Search size={17} aria-hidden="true" />
            <input id="fq" type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Search question text…" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="fc">Category</label>
          <Select id="fc" value={filters.category} onChange={setFilter('category')}>
            <option value="">All</option>
            {(categories || []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="ft">Type</label>
          <Select id="ft" value={filters.type} onChange={setFilter('type')}>
            <option value="">All</option>
            <option value="mcq">MCQ</option>
            <option value="coding">Coding</option>
          </Select>
        </div>
        <div className="field">
          <label htmlFor="fd">Difficulty</label>
          <Select id="fd" value={filters.difficulty} onChange={setFilter('difficulty')}>
            <option value="">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </div>
        <div className="field">
          <label htmlFor="fa">Status</label>
          <Select id="fa" value={filters.active} onChange={setFilter('active')}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Archived</option>
          </Select>
        </div>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Skeletons count={3} />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={FileQuestion} title="No questions found">
            Adjust the filters or add a new question.
          </EmptyState>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: 10 }} aria-live="polite">
              {data.total} questions
            </p>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Question bank</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Category</th>
                    <th scope="col">Type</th>
                    <th scope="col">Level</th>
                    <th scope="col">Marks</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((q) => (
                    <tr key={q.id} style={{ opacity: q.active ? 1 : 0.6 }}>
                      <td style={{ maxWidth: '28rem' }}>
                        <div className="clamp-2">{q.text}</div>
                        {!q.active && <span className="badge badge-neutral">Archived</span>}
                      </td>
                      <td>{q.category}</td>
                      <td style={{ textTransform: 'uppercase' }} className="small">
                        {q.type}
                      </td>
                      <td>
                        <span className={`badge ${DIFFICULTY_TONE[q.difficulty]}`}>{q.difficulty}</span>
                      </td>
                      <td>{q.marks}</td>
                      <td>
                        <div className="btn-row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button type="button" className="icon-btn" onClick={() => setEditing(q)} aria-label="Edit question" title="Edit">
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className="icon-btn" onClick={() => toggleActive(q)} aria-label={q.active ? 'Archive question' : 'Restore question'} title={q.active ? 'Archive' : 'Restore'}>
                            {q.active ? <Archive size={16} aria-hidden="true" /> : <ArchiveRestore size={16} aria-hidden="true" />}
                          </button>
                          <button type="button" className="icon-btn" onClick={() => remove(q)} aria-label="Delete question" title="Delete">
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}

      {editing && (
        <QuestionForm
          question={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            reloadCats();
          }}
        />
      )}
    </>
  );
}
