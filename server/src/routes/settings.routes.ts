import { Router } from 'express';
import { z } from 'zod';
import { SettingsController } from '../controllers/settings.controller';
import { authenticate, authorizeSuperadmin } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

const settingsSchema = z
  .object({
    org_name: z.string().trim().min(2).max(80),
    org_tagline: z.string().trim().max(120),
    logo_url: z.union([z.string().url().max(500), z.string().regex(/^\/[\w./-]+$/).max(500), z.literal('')]),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour like #1E5269'),
    allow_registration: z.enum(['true', 'false']),
  })
  .partial();

router.get('/', SettingsController.getPublic);
router.put('/', authenticate, authorizeSuperadmin, validateRequest(settingsSchema), SettingsController.update);

export default router;
