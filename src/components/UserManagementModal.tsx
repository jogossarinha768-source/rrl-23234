import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  ShieldCheck,
  User,
  KeyRound,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  Lock,
  Mail,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ManagedUser {
  id: string;
  nome: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'USUARIO';
  status: 'ativo' | 'inativo';
  criadoEm: string;
  ultimoAcesso?: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Mode: 'LIST' | 'CREATE' | 'EDIT' | 'PASSWORD'
  const [mode, setMode] = useState<'LIST' | 'CREATE' | 'EDIT' | 'PASSWORD'>('LIST');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    username: '',
    senha: '',
    role: 'USUARIO' as 'ADMIN' | 'USUARIO',
  });

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/users', {
        headers: token ? { Authorization: token } : {},
      });
      const data = await res.json();
      if (data.sucesso && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setErrorMsg(data.mensagem || 'Erro ao listar usuários');
      }
    } catch (err: any) {
      setErrorMsg('Falha ao conectar com o servidor para listar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setMode('LIST');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.sucesso) {
        setSuccessMsg('Usuário criado com sucesso!');
        fetchUsers();
        setMode('LIST');
        setFormData({ nome: '', email: '', username: '', senha: '', role: 'USUARIO' });
      } else {
        setErrorMsg(data.mensagem || 'Erro ao criar usuário');
      }
    } catch (err) {
      setErrorMsg('Erro de comunicação com o servidor.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/auth/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          role: formData.role,
        }),
      });

      const data = await res.json();
      if (data.sucesso) {
        setSuccessMsg('Dados do usuário atualizados com sucesso!');
        fetchUsers();
        setMode('LIST');
      } else {
        setErrorMsg(data.mensagem || 'Erro ao atualizar usuário');
      }
    } catch (err) {
      setErrorMsg('Erro de comunicação com o servidor.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/auth/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({ senha: formData.senha }),
      });

      const data = await res.json();
      if (data.sucesso) {
        setSuccessMsg('Senha redefinida com sucesso!');
        fetchUsers();
        setMode('LIST');
      } else {
        setErrorMsg(data.mensagem || 'Erro ao redefinir senha');
      }
    } catch (err) {
      setErrorMsg('Erro de comunicação com o servidor.');
    }
  };

  const handleToggleStatus = async (user: ManagedUser) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/auth/users/${user.id}/status`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: token } : {}),
        },
      });

      const data = await res.json();
      if (data.sucesso) {
        setSuccessMsg(`Status do usuário ${user.nome} alterado com sucesso!`);
        fetchUsers();
      } else {
        setErrorMsg(data.mensagem || 'Erro ao alterar status');
      }
    } catch (err) {
      setErrorMsg('Erro ao alterar status do usuário.');
    }
  };

  const startCreate = () => {
    setFormData({ nome: '', email: '', username: '', senha: '', role: 'USUARIO' });
    setErrorMsg('');
    setSuccessMsg('');
    setMode('CREATE');
  };

  const startEdit = (user: ManagedUser) => {
    setSelectedUser(user);
    setFormData({
      nome: user.nome,
      email: user.email,
      username: user.username,
      senha: '',
      role: user.role,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setMode('EDIT');
  };

  const startPassword = (user: ManagedUser) => {
    setSelectedUser(user);
    setFormData((prev) => ({ ...prev, senha: '' }));
    setErrorMsg('');
    setSuccessMsg('');
    setMode('PASSWORD');
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Gerenciamento de Usuários</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  ADMINISTRADOR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre, edite e controle os acessos à Roda Gigante
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* LIST MODE */}
          {mode === 'LIST' && (
            <>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Search input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, e-mail..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={fetchUsers}
                    className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={startCreate}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Novo Usuário</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Último Acesso</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-all">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.nome}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            {u.role === 'ADMIN' ? (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-full inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-cyan-400" /> ADMIN
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700 rounded-full inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" /> USUÁRIO
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.status === 'ativo' ? (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ativo
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-full inline-flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {u.ultimoAcesso
                              ? new Date(u.ultimoAcesso).toLocaleString('pt-BR')
                              : 'Nunca acessou'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => startEdit(u)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Editar dados"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startPassword(u)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg transition-all cursor-pointer"
                                title="Redefinir Senha"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                                  u.status === 'ativo'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                }`}
                              >
                                {u.status === 'ativo' ? 'Desativar' : 'Ativar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* CREATE MODE */}
          {mode === 'CREATE' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4 max-w-xl mx-auto">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <span>Cadastrar Novo Usuário</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  placeholder="Ex: João da Silva"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="joao@empresa.com"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Usuário / Login</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Opcional (padrão: e-mail)"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Perfil</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 outline-none focus:border-cyan-500"
                  >
                    <option value="USUARIO">USUÁRIO (Acesso Restrito ao Painel Clean)</option>
                    <option value="ADMIN">ADMINISTRADOR (Acesso Completo + Gestão)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          )}

          {/* EDIT MODE */}
          {mode === 'EDIT' && selectedUser && (
            <form onSubmit={handleEditSubmit} className="space-y-4 max-w-xl mx-auto">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <span>Editar Dados do Usuário ({selectedUser.nome})</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Perfil</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 outline-none focus:border-cyan-500"
                >
                  <option value="USUARIO">USUÁRIO (Acesso Restrito)</option>
                  <option value="ADMIN">ADMINISTRADOR (Acesso Completo)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

          {/* PASSWORD RESET MODE */}
          {mode === 'PASSWORD' && selectedUser && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl mx-auto">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Redefinir Senha para: {selectedUser.nome}</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  required
                  minLength={4}
                  placeholder="Digite a nova senha..."
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Atualizar Senha
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
