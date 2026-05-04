import { useEffect, useState } from "react";
import { securityApiFetch } from "../services/securityApiClient.csrf";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    groups: [] as string[],
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async () => {
    try {
      const data = await securityApiFetch<User[]>("/api/security/users/");
      setUsers(data);
    } catch (err) {
      console.error("Errore caricamento utenti:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await securityApiFetch<{ id: number; username: string }>("/api/security/users/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setSuccess("Utente creato con successo!");
      setFormData({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        is_active: true,
        is_staff: false,
        is_superuser: false,
        groups: [],
      });
      setShowCreateForm(false);
      loadUsers();
    } catch (err) {
      setError("Errore durante la creazione dell'utente");
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo utente?")) {
      return;
    }

    try {
      await securityApiFetch<{ deleted: boolean }>(`/api/security/users/${userId}/`, {
        method: "DELETE",
      });
      loadUsers();
    } catch (err) {
      setError("Errore durante l'eliminazione dell'utente");
      console.error(err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) {
    return <div className="text-sm text-slate-500">Caricamento utenti...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">Gestione Utenti</h1>
            <p className="mt-2 text-sm text-slate-500">Visualizza e gestisci gli utenti del sistema.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Chiudi" : "Aggiungi Utente"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Crea Nuovo Utente</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                  Username *
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-slate-700">
                  Nome
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-slate-700">
                  Cognome
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Attivo</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_staff}
                  onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Staff</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_superuser}
                  onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Superuser</span>
              </label>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Crea Utente
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Username</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Gruppi</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Attivo</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Nessun utente disponibile.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {user.groups.length > 0 ? user.groups.join(", ") : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.is_active ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Si
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id)}
                      className="rounded-md border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
