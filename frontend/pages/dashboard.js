import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, clearToken } from '../lib/api';
import { 
  Briefcase, 
  Plus, 
  LogOut, 
  Database, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  MapPin, 
  Sparkles,
  Calendar,
  X,
  AlertCircle
} from 'lucide-react';

const STATUSES = [
  { key: 'Applied', label: 'Applied', colorClass: 'status-applied', badgeClass: 'badge-applied', icon: Clock },
  { key: 'Interview', label: 'Interview', colorClass: 'status-interview', badgeClass: 'badge-interview', icon: Sparkles },
  { key: 'Offer', label: 'Offer', colorClass: 'status-offer', badgeClass: 'badge-offer', icon: CheckCircle2 },
  { key: 'Reject', label: 'Rejected', colorClass: 'status-reject', badgeClass: 'badge-reject', icon: XCircle },
];

export default function Dashboard() {
  const router = useRouter();
  const [apps, setApps] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ company: '', role: '', location: '' });
  const [showModal, setShowModal] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/applications');
      setApps(data);
    } catch (err) {
      if (err.message.includes('token') || err.message.includes('Unauthorized') || err.message.includes('401')) {
        clearToken();
        router.push('/');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addApplication(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/applications', { method: 'POST', body: form });
      setForm({ company: '', role: '', location: '' });
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runDemoIngest() {
    setIngesting(true);
    setError('');
    setIngestSuccess('');
    try {
      // Ingest 5 evaluation dataset job postings
      const demoJobs = Array.from({ length: 5 }, (_, i) => ({
        id: `jp-${Date.now()}-${i + 1}`,
        from: '2026-06-01',
        to: '2026-06-30',
        type: i % 2 === 0 ? 'full-time' : 'contract',
        description: `Full Stack AI Engineer Position #${i + 1} - Cloud & Generative AI`
      }));

      await api('/api/ingest/jobs', { method: 'POST', body: demoJobs });

      // Create 3 sample applications
      const demoApps = [
        { company: 'Google Cloud', role: 'Staff AI Engineer', location: 'Bengaluru / Remote' },
        { company: 'Anthropic', role: 'Member of Technical Staff', location: 'San Francisco, CA' },
        { company: 'OpenAI', role: 'Backend Systems Architect', location: 'Remote' }
      ];

      for (const appItem of demoApps) {
        await api('/api/applications', { method: 'POST', body: appItem });
      }

      setIngestSuccess('Successfully ingested evaluation dataset & created demo applications!');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIngesting(false);
    }
  }

  function logout() {
    clearToken();
    router.push('/');
  }

  // Stats calculation
  const totalApps = apps.length;
  const interviewCount = apps.filter((a) => a.status === 'Interview').length;
  const offerCount = apps.filter((a) => a.status === 'Offer').length;
  const rejectCount = apps.filter((a) => a.status === 'Reject').length;

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <nav className="navbar">
        <Link href="/dashboard" className="brand-logo">
          <div className="brand-icon">
            <Briefcase size={20} />
          </div>
          <span>AI Tracker</span>
        </Link>

        <div className="nav-actions">
          <button className="btn btn-accent btn-sm" onClick={runDemoIngest} disabled={ingesting}>
            <Database size={16} />
            {ingesting ? 'Ingesting...' : 'Ingest Demo Dataset'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Log Application
          </button>
          <button className="btn btn-secondary btn-sm" onClick={logout} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Error & Success Messages */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {ingestSuccess && (
        <div className="error-banner" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' }}>
          <CheckCircle2 size={18} />
          <span>{ingestSuccess}</span>
        </div>
      )}

      {/* Overview Stats Bar */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Briefcase size={22} />
          </div>
          <div>
            <div className="stat-val">{totalApps}</div>
            <div className="stat-lbl">Total Applications</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className="stat-val">{interviewCount}</div>
            <div className="stat-lbl">In Interview</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#6ee7b7' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-val">{offerCount}</div>
            <div className="stat-lbl">Offers Received</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(248, 113, 113, 0.15)', color: '#fca5a5' }}>
            <XCircle size={22} />
          </div>
          <div>
            <div className="stat-val">{rejectCount}</div>
            <div className="stat-lbl">Rejections</div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {STATUSES.map(({ key, label, badgeClass, icon: IconComponent }) => {
          const colApps = apps.filter((a) => a.status === key);
          return (
            <div className="kanban-column" key={key}>
              <div className="column-header">
                <div className="column-title">
                  <IconComponent size={16} className={badgeClass.replace('badge-', 'status-')} />
                  <span>{label}</span>
                </div>
                <span className="count-pill">{colApps.length}</span>
              </div>

              {loading ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 12, textAlign: 'center' }}>
                  Loading...
                </div>
              ) : colApps.length === 0 ? (
                <div style={{
                  border: '2px dashed rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontSize: 13
                }}>
                  No applications
                </div>
              ) : (
                colApps.map((app) => (
                  <Link href={`/jobs/${app.id}`} key={app.id} style={{ textDecoration: 'none' }}>
                    <div className="glass-card app-card interactive">
                      <div className="app-card-role">{app.role}</div>
                      <div className="app-card-company">
                        <Building2 size={14} color="var(--text-dim)" />
                        <span>{app.company}</span>
                      </div>
                      
                      {app.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                          <MapPin size={12} />
                          <span>{app.location}</span>
                        </div>
                      )}

                      <div className="app-card-footer">
                        <span className={`badge ${badgeClass}`}>{app.status}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          {new Date(app.application_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Log Application Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 20 }}>Log New Application</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={addApplication}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  className="input-field"
                  placeholder="e.g. Google Cloud"
                  required
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Job Role Title *</label>
                <input
                  className="input-field"
                  placeholder="e.g. Senior Backend Engineer"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Location (Optional)</label>
                <input
                  className="input-field"
                  placeholder="e.g. Bengaluru / Remote"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
