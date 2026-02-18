import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import bcrypt from 'bcrypt';

export interface AdminRow {
  id: string;
  email: string;
  communityId: string | null;
  password: string;
  isSuperAdmin: boolean;
}

export interface AdminResponse {
  id: string;
  email: string;
  communityId: string | null;
  isSuperAdmin: boolean;
}

function toAdminResponse(row: AdminRow): AdminResponse {
  return {
    id: row.id,
    email: row.email,
    communityId: row.communityId,
    isSuperAdmin: row.isSuperAdmin,
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const login = async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Fetch admin by email
    const { data: admin, error } = await supabase
      .from('Admin')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return admin data (without password)
    const adminResponse = toAdminResponse(admin as AdminRow);
    
    // In a production app, you'd set a session token here
    // For now, we'll return the admin data and the client will store it
    res.json({ admin: adminResponse });
  } catch (error: any) {
    console.error('Error in login:', error);
    res.status(500).json({
      error: 'Failed to login',
      message: error.message,
    });
  }
};

export const getCurrentAdmin = async (req: Request, res: Response) => {
  try {
    // Get admin ID from request (set by auth middleware)
    const adminId = (req as any).adminId;

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: admin, error } = await supabase
      .from('Admin')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const adminResponse = toAdminResponse(admin as AdminRow);
    res.json({ admin: adminResponse });
  } catch (error: any) {
    console.error('Error in getCurrentAdmin:', error);
    res.status(500).json({
      error: 'Failed to get admin',
      message: error.message,
    });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // In a production app with sessions, you'd invalidate the session here
  res.json({ message: 'Logged out successfully' });
};
