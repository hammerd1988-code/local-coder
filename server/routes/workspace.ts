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
    const body = req.body as { root?: string | null } | null | undefined;
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'root')) {
      res.status(400).json({ error: 'root must be provided as a string or null' });
      return;
    }

    const { root } = body;
    if (root !== null && typeof root !== 'string') {
      res.status(400).json({ error: 'root must be provided as a string or null' });
      return;
    }

    const saved = await setWorkspaceRoot(root && root.trim() ? root.trim() : null);
    res.json({ root: saved, mode: saved ? 'disk' : 'database' });
    return;
  } catch (error) {
    console.error('Error setting workspace:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set workspace' });
    return;
  }
});

export default router;
