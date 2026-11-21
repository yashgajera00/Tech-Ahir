import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../models/user.model.js';

function getPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not configured');
    error.status = 500;
    throw error;
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      name,
      email,
      passwordHash,
    });
    const token = createToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists',
      });
    }

    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res) {
  const user = await findUserById(req.user.id);

  if (!user) {
    return res.status(401).json({
      error: 'User no longer exists',
    });
  }

  return res.status(200).json({
    user: getPublicUser(user),
  });
}
