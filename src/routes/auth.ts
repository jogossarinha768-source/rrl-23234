import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';

const router = Router();

// Endpoint de Login
router.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { usuario, senha } = req.body || {};

    if (!usuario || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe o usuário/e-mail e a senha.',
      });
    }

    const user = userService.authenticate(usuario, senha);

    // Gerar um token simples
    const token = `token_${user.id}_${Date.now()}`;

    return res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      user,
      token,
    });
  } catch (err: any) {
    if (err.message === 'CONTA_INATIVA') {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Sua conta está inativa. Entre em contato com o administrador.',
      });
    }
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Usuário ou senha incorretos.',
    });
  }
});

// Endpoint para verificar sessão ativa
router.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado' });
  }

  const parts = authHeader.split('_');
  if (parts.length >= 2) {
    const userId = parts[1];
    const user = userService.getUserById(userId);
    if (user && user.status === 'ativo') {
      return res.json({ sucesso: true, user });
    }
  }

  return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida ou expirada' });
});

// GET /api/auth/users — Listar usuários
router.get('/auth/users', (req: Request, res: Response) => {
  try {
    const users = userService.getUsers();
    return res.json({
      sucesso: true,
      users,
    });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao buscar usuários',
    });
  }
});

// POST /api/auth/users — Criar usuário
router.post('/auth/users', (req: Request, res: Response) => {
  try {
    const { nome, email, username, senha, role } = req.body || {};

    if (!nome || !email || !senha || !role) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Preencha todos os campos obrigatórios (nome, e-mail, senha, tipo).',
      });
    }

    const newUser = userService.createUser({
      nome,
      email,
      username,
      senha,
      role,
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Usuário criado com sucesso.',
      user: newUser,
    });
  } catch (err: any) {
    if (err.message === 'USUARIO_JA_EXISTE') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Já existe um usuário cadastrado com este e-mail ou nome de usuário.',
      });
    }
    return res.status(500).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao criar usuário',
    });
  }
});

// PUT /api/auth/users/:id — Editar usuário
router.put('/auth/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, email, role } = req.body || {};

    const updatedUser = userService.updateUser(id, { nome, email, role });

    return res.json({
      sucesso: true,
      mensagem: 'Dados do usuário atualizados com sucesso.',
      user: updatedUser,
    });
  } catch (err: any) {
    return res.status(400).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao atualizar usuário',
    });
  }
});

// PUT /api/auth/users/:id/status — Ativar / Desativar usuário
router.put('/auth/users/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedUser = userService.toggleUserStatus(id);

    return res.json({
      sucesso: true,
      mensagem: `Usuário ${updatedUser.status === 'ativo' ? 'ativado' : 'desativado'} com sucesso.`,
      user: updatedUser,
    });
  } catch (err: any) {
    if (err.message === 'NAO_PODE_DESATIVAR_UNICO_ADMIN') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não é possível desativar o único administrador ativo do sistema.',
      });
    }
    return res.status(400).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao alterar status do usuário',
    });
  }
});

// PUT /api/auth/users/:id/password — Redefinir Senha
router.put('/auth/users/:id/password', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { senha } = req.body || {};

    if (!senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Digite a nova senha.',
      });
    }

    userService.resetPassword(id, senha);

    return res.json({
      sucesso: true,
      mensagem: 'Senha redefinida com sucesso.',
    });
  } catch (err: any) {
    return res.status(400).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao redefinir senha',
    });
  }
});

export default router;
