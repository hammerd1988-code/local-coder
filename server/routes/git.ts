import { Router } from 'express';
import { db } from '../db.js';
import { simpleGit, type SimpleGit } from 'simple-git';
import path from 'path';
import { gitOperationsTotal, gitOperationDuration, gitBranchesCount, gitUnstagedChanges, timeOperation } from '../metrics.js';
import { getWorkspaceRoot } from '../workspace.js';

const router = Router();

const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";

async function getGit(): Promise<SimpleGit> {
  const workspace = await getWorkspaceRoot();
  return simpleGit(workspace || dataDirectory);
}

// Get git status
router.get('/status', async (req, res) => {
  try {
    const status = await timeOperation(
      async () => (await getGit()).status(),
      gitOperationDuration,
      { operation: 'status' }
    );
    
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

    gitUnstagedChanges.set(status.files.length);
    gitOperationsTotal.labels('status', 'success').inc();
    console.log('Git status:', status.files.length, 'changed files');
    res.json(status);
  } catch (error) {
    console.error('Error getting git status:', error);
    gitOperationsTotal.labels('status', 'error').inc();
    res.status(500).json({ error: 'Failed to get git status' });
  }
});

// Get branches
router.get('/branches', async (req, res) => {
  try {
    const branches = await timeOperation(
      async () => (await getGit()).branchLocal(),
      gitOperationDuration,
      { operation: 'branches' }
    );
    
    // Clear and update branches in database
    await db.deleteFrom('git_branches').execute();
    
    for (const branch of branches.all) {
      await db
          .insertInto('git_branches')
          .values({
            name: branch,
            is_current: branch === branches.current ? 1 : 0,
            last_commit: null,
            created_at: Math.floor(Date.now() / 1000)
          })
          .execute();
    }

    const dbBranches = await db
      .selectFrom('git_branches')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();

    gitBranchesCount.set(dbBranches.length);
    gitOperationsTotal.labels('branches', 'success').inc();
    console.log('Git branches:', dbBranches.length);
    res.json(dbBranches);
  } catch (error) {
    console.error('Error getting branches:', error);
    gitOperationsTotal.labels('branches', 'error').inc();
    res.status(500).json({ error: 'Failed to get branches' });
  }
});

// Create new branch
router.post('/branches', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      gitOperationsTotal.labels('create_branch', 'validation_error').inc();
      res.status(400).json({ error: 'Branch name required' });
      return;
    }

    await timeOperation(
      async () => (await getGit()).checkoutLocalBranch(name),
      gitOperationDuration,
      { operation: 'create_branch' }
    );
    
    await db
      .insertInto('git_branches')
      .values({
        name,
        is_current: 1,
        last_commit: null,
        created_at: Math.floor(Date.now() / 1000)
      })
      .execute();

    gitOperationsTotal.labels('create_branch', 'success').inc();
    console.log('Created branch:', name);
    res.json({ success: true, name });
  } catch (error) {
    console.error('Error creating branch:', error);
    gitOperationsTotal.labels('create_branch', 'error').inc();
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Switch branch
router.post('/checkout', async (req, res) => {
  try {
    const { branch } = req.body;
    
    if (!branch) {
      gitOperationsTotal.labels('checkout', 'validation_error').inc();
      res.status(400).json({ error: 'Branch name required' });
      return;
    }

    await timeOperation(
      async () => (await getGit()).checkout(branch),
      gitOperationDuration,
      { operation: 'checkout' }
    );
    
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

    gitOperationsTotal.labels('checkout', 'success').inc();
    console.log('Switched to branch:', branch);
    res.json({ success: true, branch });
  } catch (error) {
    console.error('Error switching branch:', error);
    gitOperationsTotal.labels('checkout', 'error').inc();
    res.status(500).json({ error: 'Failed to switch branch' });
  }
});

// Commit changes
router.post('/commit', async (req, res) => {
  try {
    const { message, files } = req.body;
    
    if (!message) {
      gitOperationsTotal.labels('commit', 'validation_error').inc();
      res.status(400).json({ error: 'Commit message required' });
      return;
    }

    // Add files or all if not specified
    const result = await timeOperation(
      async () => {
        if (files && files.length > 0) {
          await (await getGit()).add(files);
        } else {
          await (await getGit()).add('.');
        }
        return await (await getGit()).commit(message);
      },
      gitOperationDuration,
      { operation: 'commit' }
    );
    
    gitOperationsTotal.labels('commit', 'success').inc();
    console.log('Committed:', result.commit);
    res.json({ success: true, commit: result.commit });
  } catch (error) {
    console.error('Error committing:', error);
    gitOperationsTotal.labels('commit', 'error').inc();
    res.status(500).json({ error: 'Failed to commit' });
  }
});

// Initialize git repo
router.post('/init', async (req, res) => {
  try {
    await (await getGit()).init();
    
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
    const log = await (await getGit()).log({ maxCount: 20 });
    
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
      gitOperationsTotal.labels('clone', 'validation_error').inc();
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

    await timeOperation(
      async () => {
        await simpleGit().clone(url, clonePath, {
          '--progress': null,
        });
        // Re-initialize git in the data directory after clone
        const newGit = simpleGit(clonePath);
        await newGit.status();
      },
      gitOperationDuration,
      { operation: 'clone' }
    );

    sendProgress(80, 'Initializing repository...');
    sendProgress(100, 'Clone complete!');

    gitOperationsTotal.labels('clone', 'success').inc();
    console.log('Cloned repository from:', url);
    res.end();
  } catch (error) {
    console.error('Error cloning repository:', error);
    gitOperationsTotal.labels('clone', 'error').inc();
    res.write(JSON.stringify({ error: 'Failed to clone repository' }) + '\n');
    res.end();
  }
});

export default router;
