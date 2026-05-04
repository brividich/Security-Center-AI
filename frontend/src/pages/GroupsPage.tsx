import { useEffect, useState } from "react";
import { securityApiFetch } from "../services/securityApiClient.csrf";

export interface Group {
  id: number;
  name: string;
  user_count: number;
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadGroups = async () => {
    try {
      const data = await securityApiFetch<Group[]>("/api/security/groups/");
      setGroups(data);
    } catch (err) {
      console.error("Errore caricamento gruppi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!groupName.trim()) {
      setError("Il nome del gruppo è obbligatorio");
      return;
    }

    try {
      await securityApiFetch<{ id: number; name: string }>("/api/security/groups/", {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim() }),
      });
      setSuccess("Gruppo creato con successo!");
      setGroupName("");
      setShowCreateForm(false);
      loadGroups();
    } catch (err) {
      setError("Errore durante la creazione del gruppo");
      console.error(err);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo gruppo?")) {
      return;
    }

    try {
      await securityApiFetch<{ deleted: boolean }>(`/api/security/groups/${groupId}/`, {
        method: "DELETE",
      });
      loadGroups();
    } catch (err) {
      setError("Errore durante l'eliminazione del gruppo");
      console.error(err);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  if (loading) {
    return <div className="text-sm text-slate-500">Caricamento gruppi...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">Gestione Gruppi</h1>
            <p className="mt-2 text-sm text-slate-500">Visualizza e gestisci i gruppi di utenti del sistema.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Chiudi" : "Aggiungi Gruppo"}
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
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Crea Nuovo Gruppo</h2>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label htmlFor="group_name" className="block text-sm font-medium text-slate-700">
                Nome Gruppo *
              </label>
              <input
                id="group_name"
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="es. admin, analyst, viewer"
              />
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
                Crea Gruppo
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Utenti</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                  Nessun gruppo disponibile.
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{group.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{group.user_count}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
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
