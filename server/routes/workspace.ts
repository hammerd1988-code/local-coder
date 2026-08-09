import { Router } from 'express';
import { getWorkspaceRoot, setWorkspaceRoot } from '../workspace.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const root = await getWorkspaceRoot();
    res.json({ root, mode: root ? 'disk' : 'database' });
    return;
  } catch (error) {
    console.error('Error reading workspace:', error);
    res.status(500).json({ error: 'Failed to read workspace' });
    return;
  }
});

router.put('/', async (req, res) => {
  try {
    const { root } = req.body as { root?: string | null };
    if (root === undefined) {
      res.status(400).json({ error: 'root is required (string or null)' });
      return;
    }
    const saved = await setWorkspaceRoot(root && String(root).trim() ? String(root).trim() : null);
    return;
  } catch (error) {
    console.error('Error setting workspace:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set workspace' });
    return;
  }
});

export default router;
