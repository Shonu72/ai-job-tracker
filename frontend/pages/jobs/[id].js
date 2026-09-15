import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../lib/api';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Calendar, 
  Sparkles, 
  FileText, 
  Send, 
  Copy, 
  Check, 
  History, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  Briefcase
} from 'lucide-react';

const STATUSES = [
  { key: 'Applied', label: 'Applied', badgeClass: 'badge-applied' },
  { key: 'Interview', label: 'Interview', badgeClass: 'badge-interview' },
  { key: 'Offer', label: 'Offer', badgeClass: 'badge-offer' },
  { key: 'Reject', label: 'Rejected', badgeClass: 'badge-reject' },
];

export default function ApplicationDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState('');
  const [note, setNote] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    if (!id) return;
    try {
      const data = await api(`/api/applications/${id}`);
      setApp(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function changeStatus(status) {
    setError('');
    try {
      await api(`/api/applications/${id}/status`, { 
        method: 'PATCH', 
        body: { status, note: note || undefined } 
      });
      setNote('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function generate(type) {
    setGenerating(type);
    setError('');
    try {
      await api(`/api/applications/${id}/generate-draft`, { 
        method: 'POST', 
        body: { type } 
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating('');
    }
  }

  async function markSent(draftId) {
    try {
      await api(`/api/drafts/${draftId}/status`, { 
        method: 'PATCH', 
        body: { status: 'sent' } 
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCopy(contents, draftId) {
    navigator.clipboard.writeText(contents);
    setCopiedId(draftId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!app) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        {error ? (
          <div className="error-banner" style={{ maxWidth: 480, margin: '0 auto' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>Loading application details...</div>
        )}
      </div>
    );
  }

  const currentBadge = STATUSES.find((s) => s.key === app.status)?.badgeClass || 'badge-applied';

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <nav className="navbar">
        <Link href="/dashboard" className="brand-logo">
          <div className="brand-icon">
            <Briefcase size={20} />
          </div>
          <span>AI Tracker</span>
        </Link>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Back to Board
        </Link>
      </nav>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Title Banner */}
      <div className="glass-card" style={{ marginBottom: 24, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800 }}>{app.role}</h1>
              <span className={`badge ${currentBadge}`} style={{ fontSize: 13, padding: '4px 12px' }}>
                {app.status}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: 'var(--text-muted)', fontSize: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} color="var(--primary)" />
                <strong style={{ color: '#ffffff' }}>{app.company}</strong>
              </div>

              {app.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} />
                  <span>{app.location}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} />
                <span>Applied {new Date(app.application_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24 }}>
        
        {/* Left Column: AI Drafts & Status Pipeline */}
        <div>
          {/* Status Pipeline & Note Card */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--primary)" /> Update Pipeline Status
            </h3>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {STATUSES.map(({ key, label, badgeClass }) => {
                const isActive = key === app.status;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => changeStatus(key)}
                  >
                    {isActive && <Check size={14} />} {label}
                  </button>
                );
              })}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                className="input-field"
                placeholder="Add optional note for status change (e.g. Recruiter phone screen scheduled for Friday)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          {/* AI Generator Suite */}
          <div className="glass-card" style={{ marginBottom: 24, border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(135deg, rgba(18, 24, 38, 0.95), rgba(30, 27, 75, 0.4))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc' }}>
                  <Sparkles size={20} /> AI Draft Generator (Vertex AI Gemini)
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  Grounded in job posting requirements & past draft style
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent-purple))' }}
                onClick={() => generate('cover_letter')}
                disabled={generating === 'cover_letter'}
              >
                <FileText size={16} />
                {generating === 'cover_letter' ? 'Generating Cover Letter...' : 'Generate Cover Letter'}
              </button>

              <button
                type="button"
                className="btn btn-accent"
                onClick={() => generate('follow_up_email')}
                disabled={generating === 'follow_up_email'}
              >
                <Send size={16} />
                {generating === 'follow_up_email' ? 'Generating Follow-up...' : 'Generate Follow-up Email'}
              </button>
            </div>
          </div>

          {/* Generated Drafts List */}
          <div className="glass-card">
            <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="var(--accent-cyan)" /> Drafts & Communication ({app.drafts?.length || 0})
            </h3>

            {(!app.drafts || app.drafts.length === 0) ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', border: '2px dashed rgba(255,255,255,0.06)', borderRadius: 12 }}>
                No drafts generated yet. Click above to generate a Gemini cover letter or follow-up email!
              </div>
            ) : (
              app.drafts.map((d) => (
                <div key={d.id} className="glass-card" style={{ background: 'rgba(10, 15, 26, 0.6)', marginBottom: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15, color: '#ffffff' }}>
                        {d.draft_type === 'cover_letter' ? 'Cover Letter' : 'Follow-up Email'}
                      </strong>
                      {d.generated_by_ai && <span className="badge badge-ai"><Sparkles size={12} /> Gemini Grounded</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${d.status === 'sent' ? 'badge-offer' : 'badge-applied'}`}>
                        {d.status}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(d.contents, d.id)}
                        title="Copy text"
                      >
                        {copiedId === d.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        {copiedId === d.id ? 'Copied!' : 'Copy'}
                      </button>
                      {d.status !== 'sent' && (
                        <button
                          type="button"
                          className="btn btn-accent btn-sm"
                          onClick={() => markSent(d.id)}
                        >
                          <Send size={13} /> Mark Sent
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="draft-content-box">{d.contents}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Audit Timeline & Activity */}
        <div>
          <div className="glass-card" style={{ position: 'sticky', top: 96 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="var(--accent-purple)" /> Event History & Audit
            </h3>

            {(!app.events || app.events.length === 0) ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No events logged yet.</div>
            ) : (
              <div className="timeline">
                {app.events.map((e) => (
                  <div key={e.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                      {e.from_status ? `${e.from_status} → ` : 'Created: '}
                      <span className="status-applied">{e.to_status}</span>
                    </div>
                    {e.note && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                        "{e.note}"
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {new Date(e.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
