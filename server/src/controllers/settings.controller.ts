import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activity';

/** Keys an organisation can configure for white-label deployment. */
export const SETTING_KEYS = ['org_name', 'org_tagline', 'logo_url', 'primary_color', 'allow_registration'] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  org_name: 'PyTest',
  org_tagline: 'Customizable Examination System',
  logo_url: '/pgl-logo.png',
  primary_color: '#1E5269',
  allow_registration: 'true',
};

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const settings = { ...DEFAULTS };
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT setting_key, setting_value FROM settings`);
    for (const row of rows) {
      if ((SETTING_KEYS as readonly string[]).includes(row.setting_key)) {
        settings[row.setting_key as SettingKey] = row.setting_value ?? '';
      }
    }
  } catch {
    // Settings table missing (migration not yet run): fall back to defaults.
  }
  return settings;
}

export const SettingsController = {
  /** Public: the login page needs branding before anyone is signed in. */
  async getPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await getSettings() });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const changes = req.body as Partial<Record<SettingKey, string>>;
      for (const [key, value] of Object.entries(changes)) {
        await pool.execute(
          `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, String(value)]
        );
      }

      await logActivity(req.userId!, 'superadmin', 'settings.update', 'settings', undefined, changes);

      res.json({ success: true, data: await getSettings() });
    } catch (error) {
      next(error);
    }
  },
};
