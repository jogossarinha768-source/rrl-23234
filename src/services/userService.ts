import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  nome: string;
  email: string;
  username: string;
  senhaHash: string; // Na prática, armazenado como string
  role: 'ADMIN' | 'USUARIO';
  status: 'ativo' | 'inativo';
  criadoEm: string;
  ultimoAcesso?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Usuários padrão predefinidos
const DEFAULT_USERS: User[] = [
  {
    id: 'usr_admin_default',
    nome: 'Administrador Master',
    email: 'admin@rodagigante.com',
    username: 'admin',
    senhaHash: 'admin123', // Senha padrão para login
    role: 'ADMIN',
    status: 'ativo',
    criadoEm: new Date().toISOString(),
  },
  {
    id: 'usr_user_default',
    nome: 'Usuário Operador',
    email: 'usuario@rodagigante.com',
    username: 'usuario',
    senhaHash: 'user123', // Senha padrão para login
    role: 'USUARIO',
    status: 'ativo',
    criadoEm: new Date().toISOString(),
  },
];

class UserService {
  private users: User[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.users = parsed;
          return;
        }
      }
    } catch (err) {
      console.error('[UserService] Erro ao carregar usuários:', err);
    }

    // Usar defaults se não existir arquivo ou se der erro
    this.users = [...DEFAULT_USERS];
    this.persist();
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
    } catch (err) {
      console.error('[UserService] Erro ao salvar usuários:', err);
    }
  }

  public getUsers(): Omit<User, 'senhaHash'>[] {
    return this.users.map(({ senhaHash, ...rest }) => rest);
  }

  public getUserById(id: string): Omit<User, 'senhaHash'> | null {
    const u = this.users.find((user) => user.id === id);
    if (!u) return null;
    const { senhaHash, ...rest } = u;
    return rest;
  }

  public authenticate(credential: string, senha: string): Omit<User, 'senhaHash'> | null {
    const credLower = credential.trim().toLowerCase();
    const user = this.users.find(
      (u) =>
        (u.email.toLowerCase() === credLower || u.username.toLowerCase() === credLower) &&
        u.senhaHash === senha
    );

    if (!user) {
      return null;
    }

    if (user.status !== 'ativo') {
      throw new Error('CONTA_INATIVA');
    }

    // Atualizar último acesso
    user.ultimoAcesso = new Date().toISOString();
    this.persist();

    const { senhaHash, ...rest } = user;
    return rest;
  }

  public createUser(payload: {
    nome: string;
    email: string;
    username?: string;
    senha: string;
    role: 'ADMIN' | 'USUARIO';
  }): Omit<User, 'senhaHash'> {
    const emailLower = payload.email.trim().toLowerCase();
    const username = (payload.username || payload.email.split('@')[0]).trim().toLowerCase();

    // Verificar duplicação
    const exists = this.users.some(
      (u) => u.email.toLowerCase() === emailLower || u.username.toLowerCase() === username
    );

    if (exists) {
      throw new Error('USUARIO_JA_EXISTE');
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      nome: payload.nome.trim(),
      email: emailLower,
      username,
      senhaHash: payload.senha,
      role: payload.role,
      status: 'ativo',
      criadoEm: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.persist();

    const { senhaHash, ...rest } = newUser;
    return rest;
  }

  public updateUser(
    id: string,
    payload: Partial<{ nome: string; email: string; role: 'ADMIN' | 'USUARIO' }>
  ): Omit<User, 'senhaHash'> {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new Error('USUARIO_NAO_ENCONTRADO');
    }

    if (payload.nome !== undefined) user.nome = payload.nome.trim();
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.email !== undefined) {
      const emailLower = payload.email.trim().toLowerCase();
      const duplicate = this.users.some((u) => u.id !== id && u.email.toLowerCase() === emailLower);
      if (duplicate) {
        throw new Error('EMAIL_EM_USO');
      }
      user.email = emailLower;
    }

    this.persist();
    const { senhaHash, ...rest } = user;
    return rest;
  }

  public toggleUserStatus(id: string): Omit<User, 'senhaHash'> {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new Error('USUARIO_NAO_ENCONTRADO');
    }

    // Não permitir desativar o admin principal se for o único admin ativo
    if (user.role === 'ADMIN' && user.status === 'ativo') {
      const activeAdmins = this.users.filter((u) => u.role === 'ADMIN' && u.status === 'ativo');
      if (activeAdmins.length <= 1) {
        throw new Error('NAO_PODE_DESATIVAR_UNICO_ADMIN');
      }
    }

    user.status = user.status === 'ativo' ? 'inativo' : 'ativo';
    this.persist();

    const { senhaHash, ...rest } = user;
    return rest;
  }

  public resetPassword(id: string, novaSenha: string): void {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new Error('USUARIO_NAO_ENCONTRADO');
    }
    if (!novaSenha || novaSenha.trim().length < 4) {
      throw new Error('SENHA_INVALIDA');
    }

    user.senhaHash = novaSenha.trim();
    this.persist();
  }
}

export const userService = new UserService();
