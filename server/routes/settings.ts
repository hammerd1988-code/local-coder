import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Get all settings
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const settings = await db.selectFrom('settings')
      .selectAll()
      .execute();
    
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
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
    
    await db.insertInto('settings')
      .values({ key, value, updated_at: now })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: now }))
      .execute();
    
    res.json({ key, value });
    return;
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
    return;
  }
});

export default router;
