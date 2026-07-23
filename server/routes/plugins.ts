import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Get all plugins
router.get('/', async (req, res) => {
  try {
    const plugins = await db
      .selectFrom('plugins')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();

    const parsedPlugins = plugins.map(p => ({
      ...p,
      config: JSON.parse(p.config),
      enabled: Boolean(p.enabled)
    }));

    console.log('Plugins fetched:', parsedPlugins.length);
    res.json(parsedPlugins);
  } catch (error) {
    console.error('Error fetching plugins:', error);
    res.status(500).json({ error: 'Failed to fetch plugins' });
  }
});

// Toggle plugin enabled status
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const plugin = await db
      .selectFrom('plugins')
      .selectAll()
      .where('id', '=', Number(id))
      .executeTakeFirst();

    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }

    const newEnabled = plugin.enabled === 1 ? 0 : 1;
    
    await db
      .updateTable('plugins')
      .set({ 
        enabled: newEnabled,
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where('id', '=', Number(id))
      .execute();

    console.log(`Plugin ${plugin.name} enabled: ${Boolean(newEnabled)}`);
    res.json({ enabled: Boolean(newEnabled) });
  } catch (error) {
    console.error('Error toggling plugin:', error);
    res.status(500).json({ error: 'Failed to toggle plugin' });
  }
});

// Update plugin config
router.put('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;

    await db
      .updateTable('plugins')
      .set({ 
        config: JSON.stringify(config),
        updated_at: Math.floor(Date.now() / 1000)
      })
      .where('id', '=', Number(id))
      .execute();

    console.log(`Plugin ${id} config updated`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating plugin config:', error);
    res.status(500).json({ error: 'Failed to update plugin config' });
  }
});

export default router;
