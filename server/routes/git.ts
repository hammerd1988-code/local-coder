import { Router } from 'express';
import { db } from '../db.js';
import simpleGit from 'simple-git';
import path from 'path';

const router = Router();

// Initialize git in the data directory
const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
const git = simpleGit(dataDirectory);

// Get git status
router.get('/status', async (req, res) => {
  try {
    const status = await git.status();
    
    // Update cache
    await db
      .insertInto('git_status')
      .values({
        id: 1,
        status: JSON.stringify(status),
        updated_at: Math.floor(Date.now() / 1000)
      })
      .onConflict((oc) => oc
        .column('id')
        .doUpdateSet({
          status: JSON.stringify(status),
          updated_at: Math.floor(Date.now() / 1000)
        })
      )
      .execute();

    console.log('Git status:', status.files.length, 'changed files');
    res.json(status);
  } catch (error) {
    console.error('Error getting git status:', error);
    res.status(500).json({ error: 'Failed to get git status' });
  }
});

// Get branches
router.get('/branches', async (req, res) => {
  try {
    const branches = await git.branchLocal();
    
    // Clear and update branches in database
    await db.deleteFrom('git_branches').execute();
    
    for (const branch of branches.all) {
      await db
        .insertInto('git_branches')
        .values({
          name: branch,
          is_current: branch === branches.current ? 1 : 0,
          last_commit: null
        })
        .execute();
    }

    const dbBranches = await db
      .selectFrom('git_branches')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();

    console.log('Git branches:', dbBranches.length);
    res.json(dbBranches);
  } catch (error) {
    console.error('Error getting branches:', error);
    res.status(500).json({ error: 'Failed to get branches' });
  }
});

// Create new branch
router.post('/branches', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Branch name required' });
      return;
    }

    await git.checkoutLocalBranch(name);
    
    await db
      .insertInto('git_branches')
      .values({
        name,
        is_current: 1,
        last_commit: null
      })
      .execute();

    console.log('Created branch:', name);
    res.json({ success: true, name });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Switch branch
router.post('/checkout', async (req, res) => {
  try {
    const { branch } = req.body;
    
    if (!branch) {
      res.status(400).json({ error: 'Branch name required' });
      return;
    }

    await git.checkout(branch);
    
    // Update current branch flags
    await db
      .updateTable('git_branches')
      .set({ is_current: 0 })
      .execute();
    
    await db
      .updateTable('git_branches')
      .set({ is_current: 1 })
      .where('name', '=', branch)
      .execute();

    console.log('Switched to branch:', branch);
    res.json({ success: true, branch });
  } catch (error) {
    console.error('Error switching branch:', error);
    res.status(500).json({ error: 'Failed to switch branch' });
  }
});

// Commit changes
router.post('/commit', async (req, res) => {
  try {
    const { message, files } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Commit message required' });
      return;
    }

    // Add files or all if not specified
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }

    const result = await git.commit(message);
    
    console.log('Committed:', result.commit);
    res.json({ success: true, commit: result.commit });
  } catch (error) {
    console.error('Error committing:', error);
    res.status(500).json({ error: 'Failed to commit' });
  }
});

// Initialize git repo
router.post('/init', async (req, res) => {
  try {
    await git.init();
    
    console.log('Git repository initialized');
    res.json({ success: true });
  } catch (error) {
    console.error('Error initializing git:', error);
    res.status(500).json({ error: 'Failed to initialize git' });
  }
});

// Get commit log
router.get('/log', async (req, res) => {
  try {
    const log = await git.log({ maxCount: 20 });
    
    console.log('Git log:', log.total, 'commits');
    res.json(log);
  } catch (error) {
    console.error('Error getting log:', error);
    res.status(500).json({ error: 'Failed to get log' });
  }
});

// Clone repository
router.post('/clone', async (req, res) => {
  try {
    const { url, targetDir } = req.body;
    
    if (!url) {
      res.status(400).json({ error: 'Repository URL required' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendProgress = (progress: number, message: string) => {
      res.write(JSON.stringify({ progress, message }) + '\n');
    };

    sendProgress(10, 'Starting clone...');

    const clonePath = targetDir 
      ? path.join(dataDirectory, targetDir)
      : dataDirectory;

    sendProgress(30, 'Cloning repository...');

    await simpleGit().clone(url, clonePath, {
      '--progress': null,
    });

    sendProgress(80, 'Initializing repository...');

    // Re-initialize git in the data directory after clone
    const newGit = simpleGit(clonePath);
    await newGit.status();

    sendProgress(100, 'Clone complete!');

    console.log('Cloned repository from:', url);
    res.end();
  } catch (error) {
    console.error('Error cloning repository:', error);
    res.write(JSON.stringify({ error: 'Failed to clone repository' }) + '\n');
    res.end();
  }
});

export default router;
