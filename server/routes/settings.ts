import express from 'express';
import { db } from '../db.js';
import { invalidateLicenseCache } from '../license.js';

const router = express.Router();

/**
 * Keys holding secrets. Their values never leave the server: GET returns the
 * placeholder instead, and PUTs of the placeholder are ignored so a client
 * echoing settings back doesn't clobber the stored secret.
 */
const SECRET_KEYS = new Set(['lmstudio_api_key', 'bsc_license_key']);
export const SECRET_PLACEHOLDER = '********';

// Get all settings
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const settings = await db.selectFrom('settings')
      .selectAll()
      .execute();
    
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = SECRET_KEYS.has(setting.key) && setting.value
        ? SECRET_PLACEHOLDER
        : setting.value;
      return acc;
    }, {} as Record<string, string>);
    
    res.json(settingsObj);
    return;
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
    return;
  }
});

// Update setting
router.put('/:key', async (req: express.Request, res: express.Response) => {
  try {
    const { value } = req.body;
    const key = String(req.params.key);
    const now = Math.floor(Date.now() / 1000);

    if (SECRET_KEYS.has(key) && value === SECRET_PLACEHOLDER) {
      res.json({ key, value: SECRET_PLACEHOLDER });
      return;
    }

    await db.insertInto('settings')
      .values({ key, value, updated_at: now })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: now }))
      .execute();

    if (key === 'bsc_license_key' || key === 'bsc_api_url') invalidateLicenseCache();

    
    res.json({ key, value: SECRET_KEYS.has(key) && value ? SECRET_PLACEHOLDER : value });
    return;
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
    return;
  }
});

export default router;
