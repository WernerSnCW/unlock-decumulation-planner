import { useState, useEffect, useCallback } from 'react';

interface Investor {
  id: number;
  name: string;
  email: string | null;
  accessCode: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '/api/admin';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState('');

  // investor state
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteDataInfo, setDeleteDataInfo] = useState<{ assets: number; settings: number } | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);

  // copied feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchInvestors = useCallback(async (tok?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/investors`, {
        headers: { Authorization: `Bearer ${tok ?? token}` },
      });
      if (res.ok) {
        setInvestors(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/investors`, {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.ok) {
        setToken(password);
        setAuthed(true);
        setInvestors(await res.json());
      } else {
        setAuthError('Invalid admin password');
      }
    } catch {
      setAuthError('Could not connect to server');
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      fetchInvestors();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/investors/search?q=${encodeURIComponent(search)}`,
        { headers: headers() },
      );
      if (res.ok) setInvestors(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const validateForm = (): boolean => {
    let valid = true;
    setNameError('');
    setEmailError('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNameError('Name is required');
      valid = false;
    } else if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      valid = false;
    }

    const trimmedEmail = newEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Invalid email format');
      valid = false;
    }

    return valid;
  };

  const checkDuplicate = (): boolean => {
    const trimmedName = newName.trim().toLowerCase();
    const trimmedEmail = newEmail.trim().toLowerCase();
    return investors.some(inv =>
      inv.name.toLowerCase() === trimmedName &&
      (inv.email ?? '').toLowerCase() === trimmedEmail
    );
  };

  const doCreate = async () => {
    setCreating(true);
    setCreateMsg('');
    setDuplicateWarning(false);
    try {
      const res = await fetch(`${API_BASE}/investors`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() || undefined }),
      });
      if (res.ok) {
        const inv: Investor = await res.json();
        setCreateMsg(`Created! Access code: ${inv.accessCode}`);
        setNewName('');
        setNewEmail('');
        fetchInvestors();
      } else {
        const err = await res.json();
        setCreateMsg(`Error: ${err.error}`);
      }
    } catch {
      setCreateMsg('Failed to create investor');
    }
    setCreating(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (checkDuplicate() && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    await doCreate();
  };

  const initiateDelete = async (id: number) => {
    setDeleteId(id);
    setDeleteConfirmed(false);
    setDeleteDataInfo(null);
    setCheckingDelete(true);
    try {
      const res = await fetch(`${API_BASE}/investors/${id}/data-check`, {
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.hasData) {
          // No data — delete immediately
          await doDelete(id);
          return;
        }
        setDeleteDataInfo({ assets: data.assets, settings: data.settings });
      }
    } catch { /* ignore */ }
    setCheckingDelete(false);
  };

  const doDelete = async (id: number) => {
    try {
      await fetch(`${API_BASE}/investors/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      setDeleteId(null);
      setDeleteDataInfo(null);
      setDeleteConfirmed(false);
      setInvestors(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
    setCheckingDelete(false);
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setDeleteDataInfo(null);
    setDeleteConfirmed(false);
    setCheckingDelete(false);
  };

  const copyCode = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ---------- LOGIN SCREEN ----------
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>Admin Access</h1>
          <p>Enter the admin password to manage investors.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
            />
            <button type="submit" disabled={!password}>Sign in</button>
          </form>
          {authError && <div className="admin-error">{authError}</div>}
          <a href="/" className="admin-back-link">Back to main page</a>
        </div>
      </div>
    );
  }

  // ---------- ADMIN DASHBOARD ----------
  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Investor Management</h1>
        <button className="admin-logout" onClick={() => { setAuthed(false); setToken(''); setPassword(''); }}>
          Logout
        </button>
      </header>

      {/* Create investor */}
      <section className="admin-section">
        <h2>Create Investor</h2>
        <form className="admin-create-form" onSubmit={handleCreate}>
          <div className="admin-field">
            <input
              type="text"
              placeholder="Name (required)"
              value={newName}
              onChange={e => { setNewName(e.target.value); setNameError(''); setDuplicateWarning(false); }}
              className={nameError ? 'input-invalid' : ''}
            />
            {nameError && <span className="admin-field-error">{nameError}</span>}
          </div>
          <div className="admin-field">
            <input
              type="email"
              placeholder="Email (optional)"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError(''); setDuplicateWarning(false); }}
              className={emailError ? 'input-invalid' : ''}
            />
            {emailError && <span className="admin-field-error">{emailError}</span>}
          </div>
          <button type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : duplicateWarning ? 'Confirm Create' : 'Create'}
          </button>
        </form>
        {duplicateWarning && (
          <div className="admin-msg admin-warning">
            An investor with this name and email already exists. Press "Confirm Create" to add anyway, or change the details.
          </div>
        )}
        {createMsg && (
          <div className={`admin-msg ${createMsg.startsWith('Error') ? 'admin-error' : 'admin-success'}`}>
            {createMsg}
          </div>
        )}
      </section>

      {/* Search */}
      <section className="admin-section">
        <h2>Investors</h2>
        <div className="admin-search">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
          {search && (
            <button onClick={() => { setSearch(''); fetchInvestors(); }}>Clear</button>
          )}
        </div>
      </section>

      {/* Table */}
      <div className="admin-table-wrap">
        {loading ? (
          <p className="admin-loading">Loading...</p>
        ) : investors.length === 0 ? (
          <p className="admin-loading">No investors found.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access Code</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {investors.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.name}</td>
                  <td>{inv.email || '—'}</td>
                  <td>
                    <code className="access-code">{inv.accessCode}</code>
                    <button
                      className="copy-btn"
                      onClick={() => copyCode(inv.accessCode, inv.id)}
                    >
                      {copiedId === inv.id ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                  <td>{fmt(inv.createdAt)}</td>
                  <td>
                    {deleteId === inv.id ? (
                      checkingDelete && !deleteDataInfo ? (
                        <span className="delete-confirm">Checking...</span>
                      ) : deleteDataInfo ? (
                        <span className="delete-confirm delete-confirm-data">
                          <span className="delete-data-warning">
                            Has {deleteDataInfo.assets} asset{deleteDataInfo.assets !== 1 ? 's' : ''}
                            {deleteDataInfo.settings > 0 ? ' + saved settings' : ''}. Delete?
                          </span>
                          <button className="del-yes" onClick={() => doDelete(inv.id)}>Yes, delete all</button>
                          <button className="del-no" onClick={cancelDelete}>Cancel</button>
                        </span>
                      ) : (
                        <span className="delete-confirm">
                          Sure?{' '}
                          <button className="del-yes" onClick={() => doDelete(inv.id)}>Yes</button>
                          <button className="del-no" onClick={cancelDelete}>No</button>
                        </span>
                      )
                    ) : (
                      <button className="del-btn" onClick={() => initiateDelete(inv.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
