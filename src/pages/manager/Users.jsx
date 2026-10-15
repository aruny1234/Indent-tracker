import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useData } from '../../context/DataContext.jsx';
import { PageHeader, Modal, ErrorText } from '../../components/ui.jsx';
import { createEmployee, updateEmployee } from '../../services/db.js';

const AUTH_MSG = {
  'auth/email-already-in-use': 'A login with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
};

function UserModal({ user, departments, onClose }) {
  const { profile } = useAuth();
  const isNew = !user;
  const [f, setF] = useState({
    name: user?.name || '', email: user?.email || '', password: '', employeeId: user?.employeeId || '',
    department: user?.department || '', role: user?.role || 'employee', active: user?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isSelf = user?.uid === profile.uid;

  async function save() {
    setErr('');
    if (!f.name.trim()) return setErr('Enter the name.');
    if (isNew && (!f.email.trim() || f.password.length < 6)) return setErr('Enter an email and a password of at least 6 characters.');
    setBusy(true);
    try {
      if (isNew) await createEmployee(f, profile);
      else await updateEmployee(user.uid, { name: f.name.trim(), employeeId: f.employeeId.trim(), department: f.department.trim(), role: f.role, active: f.active });
      onClose();
    } catch (e) {
      setErr(AUTH_MSG[e.code] || e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? 'Add user' : `Edit ${user.name}`} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : isNew ? 'Add user' : 'Save changes'}</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="u-name">Full name</label><input id="u-name" className="field" value={f.name} onChange={set('name')} /></div>
        {isNew ? (
          <>
            <div><label className="label" htmlFor="u-email">Email (login)</label><input id="u-email" type="email" className="field" value={f.email} onChange={set('email')} /></div>
            <div><label className="label" htmlFor="u-pw">Temporary password</label><input id="u-pw" type="text" className="field" value={f.password} onChange={set('password')} /></div>
          </>
        ) : (
          <div className="sm:col-span-2 text-sm text-steel">Login: {user.email}</div>
        )}
        <div><label className="label" htmlFor="u-emp">Employee ID</label><input id="u-emp" className="field" value={f.employeeId} onChange={set('employeeId')} /></div>
        <div>
          <label className="label" htmlFor="u-dept">Department</label>
          <input id="u-dept" className="field" list="dept-list" value={f.department} onChange={set('department')} />
          <datalist id="dept-list">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="u-role">Role</label>
          <select id="u-role" className="field" value={f.role} onChange={set('role')} disabled={isSelf}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        {!isNew && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={set('active')} disabled={isSelf} /> Active (can sign in)
          </label>
        )}
      </div>
      {isNew && <p className="mt-4 text-xs text-steel">Share the temporary password with the employee. They can change it with "Forgot password" on the sign-in page.</p>}
      <div className="mt-4"><ErrorText>{err}</ErrorText></div>
    </Modal>
  );
}

export default function Users() {
  const { users, indents } = useData();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new user
  const counts = useMemo(() => {
    const m = {};
    indents.forEach((i) => { if (i.assignedUserId) m[i.assignedUserId] = (m[i.assignedUserId] || 0) + 1; });
    return m;
  }, [indents]);
  const departments = useMemo(() => [...new Set(users.map((u) => u.department).filter(Boolean))].sort(), [users]);
  const sorted = [...users].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.filter((u) => u.active).length} active users`}
        actions={<button className="btn-primary" onClick={() => setEditing(null)}>Add user</button>} />
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas">
            <tr><th className="th">Name</th><th className="th">Employee ID</th><th className="th">Department</th><th className="th">Role</th><th className="th text-right">Assigned items</th><th className="th">Status</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((u) => (
              <tr key={u.uid} className={u.active ? '' : 'text-steel'}>
                <td className="td"><div className="font-medium">{u.name}</div><div className="text-xs text-steel">{u.email}</div></td>
                <td className="td">{u.employeeId || '—'}</td>
                <td className="td">{u.department || '—'}</td>
                <td className="td">{u.role === 'manager' ? 'Manager' : 'Employee'}</td>
                <td className="td text-right tabular-nums">{counts[u.uid] || 0}</td>
                <td className="td">{u.active ? 'Active' : 'Deactivated'}</td>
                <td className="td text-right"><button className="btn-ghost py-1" onClick={() => setEditing(u)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing !== undefined && <UserModal user={editing} departments={departments} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
