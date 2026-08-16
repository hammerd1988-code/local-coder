import express from 'express';
import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { listModels, downloadFile } from '@huggingface/hub';

const router = express.Router();

const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
const modelsDirectory = path.join(dataDirectory, "huggingface-models");

// Ensure models directory exists
if (!fs.existsSync(modelsDirectory)) {
  fs.mkdirSync(modelsDirectory, { recursive: true });
}

// Get Hugging Face API token from environment or settings
async function getHFToken(): Promise<string | undefined> {
  try {
    const setting = await db
      .selectFrom('settings')
      .select('value')
      .where('key', '=', 'huggingface_token')
      .executeTakeFirst();
    return setting?.value || process.env.HUGGINGFACE_TOKEN;
  } catch {
    return process.env.HUGGINGFACE_TOKEN;
  }
}

// Get all downloaded models
router.get('/models', async (_req, res) => {
  try {
    const models = await db
      .selectFrom('huggingface_models')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    res.json(models);
    return;
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
    return;
  }
});

// Search Hugging Face models
router.get('/search', async (req, res) => {
  try {
    const { query, type = 'all', limit = 20 } = req.query;
    const token = await getHFToken();
    
    const searchQuery = query && typeof query === 'string' ? query : '';
    const limitNum = typeof limit === 'string' ? parseInt(limit) : 20;

    console.log('Searching HuggingFace models:', { query: searchQuery, type, limit: limitNum });

    // Build search parameters
    const searchParams: any = {
      limit: limitNum,
    };

    if (searchQuery) {
      searchParams.search = searchQuery;
    }

    if (type !== 'all' && typeof type === 'string') {
      searchParams.filter = type;
    }

    if (token) {
      searchParams.credentials = { accessToken: token };
    }

    // Search models using Hugging Face API
    const models: {
      id: string;
      name: string;
      type: string;
      description: string;
      downloads: number;
      likes: number;
      size_mb: number;
      tags: string[];
    }[] = [];
    for await (const model of listModels(searchParams)) {
      const modelData: any = model;
      models.push({
        id: model.id,
        name: model.id.split('/').pop() || model.id,
        type: String(modelData.pipeline_tag || 'unknown'),
        description: String(modelData.cardData?.base_model || `Model: ${model.id}`),
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        size_mb: 0, // Size not available in list API
        tags: Array.isArray(modelData.tags) ? modelData.tags.map(String) : []
      });

      if (models.length >= limitNum) break;
    }

    console.log(`Found ${models.length} models from HuggingFace`);
    res.json(models);
    return;
  } catch (error) {
    console.error('Error searching models:', error);
    res.status(500).json({ error: 'Failed to search models' });
    return;
  }
});

// Download a model
router.post('/download', async (req, res) => {
  try {
    const { model_id, model_name, model_type, size_mb, metadata = {} } = req.body;

    if (!model_id || !model_name || !model_type) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if model already exists
    const existing = await db
      .selectFrom('huggingface_models')
      .selectAll()
      .where('model_id', '=', model_id)
      .executeTakeFirst();

    if (existing) {
      res.status(400).json({ error: 'Model already downloaded' });
      return;
    }

    // Create local path
    const sanitizedId = model_id.replace(/[^a-zA-Z0-9-_]/g, '_');
    const localPath = path.join(modelsDirectory, sanitizedId);
    const now = Math.floor(Date.now() / 1000);

    // Insert into database
    const result = await db
      .insertInto('huggingface_models')
      .values({
        model_id,
        model_name,
        model_type,
        size_mb: size_mb || 0,
        download_status: 'downloading',
        download_progress: 0,
        local_path: localPath,
        metadata: JSON.stringify(metadata),
        downloaded_at: null,
        created_at: now,
        updated_at: now
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      })
      .executeTakeFirst();

    console.log('Model download started:', model_id);

    // Start actual download from HuggingFace in background
    (async () => {
      try {
        const token = await getHFToken();
        
        // Create model directory
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        // Download model files from HuggingFace Hub
        console.log(`Downloading model files for ${model_id}...`);
        
        // Common model files to download
        const filesToDownload = [
          'config.json',
          'tokenizer.json',
          'tokenizer_config.json',
          'pytorch_model.bin',
          'model.safetensors',
          'vocab.txt',
          'vocab.json',
          'merges.txt',
          'special_tokens_map.json'
        ];

        let downloadedCount = 0;
        const credentials = token ? { accessToken: token } : undefined;

        for (const filename of filesToDownload) {
          try {
            const downloadedFile = await downloadFile({
              repo: model_id,
              path: filename,
              credentials
            });

            if (downloadedFile) {
              const destPath = path.join(localPath, filename);
              const buffer = await downloadedFile.arrayBuffer();
              fs.writeFileSync(destPath, Buffer.from(buffer));
              downloadedCount++;
              
              // Update progress
              const progress = Math.floor((downloadedCount / filesToDownload.length) * 100);
              await db
                .updateTable('huggingface_models')
                .set({
                  download_progress: progress,
                  updated_at: Math.floor(Date.now() / 1000)
                })
                .where('model_id', '=', model_id)
                .execute();
              
              console.log(`Downloaded ${filename} (${downloadedCount}/${filesToDownload.length})`);
            }
          } catch (fileError) {
            // File might not exist for this model, continue
            console.log(`Skipping ${filename} - not found or not accessible`);
          }
        }

        if (downloadedCount === 0) {
          throw new Error('No model files could be downloaded');
        }

        // Update status to completed
        await db
          .updateTable('huggingface_models')
          .set({
            download_status: 'completed',
            download_progress: 100,
            downloaded_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
          })
          .where('model_id', '=', model_id)
          .execute();

        console.log(`Model download completed: ${model_id} (${downloadedCount} files)`);
      } catch (error) {
        console.error('Error completing download:', error);
        await db
          .updateTable('huggingface_models')
          .set({
            download_status: 'failed',
            updated_at: Math.floor(Date.now() / 1000)
          })
          .where('model_id', '=', model_id)
          .execute();
      }
    })();

    res.json({ 
      success: true, 
      model_id,
      message: 'Download started'
    });
    return;
  } catch (error) {
    console.error('Error downloading model:', error);
    res.status(500).json({ error: 'Failed to start download' });
    return;
  }
});

// Delete a model
router.delete('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const model = await db
      .selectFrom('huggingface_models')
      .selectAll()
      .where('id', '=', parseInt(id))
      .executeTakeFirst();

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Delete local files
    if (model.local_path && fs.existsSync(model.local_path)) {
      fs.rmSync(model.local_path, { recursive: true, force: true });
    }

    // Delete from database
    await db
      .deleteFrom('huggingface_models')
      .where('id', '=', parseInt(id))
      .execute();

    console.log('Model deleted:', model.model_id);

    res.json({ success: true });
    return;
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
    return;
  }
});

// Get model by ID
router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const model = await db
      .selectFrom('huggingface_models')
      .selectAll()
      .where('id', '=', parseInt(id))
      .executeTakeFirst();

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json(model);
    return;
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
    return;
  }
});

// Get available model types
router.get('/types', (_req, res) => {
  const types = [
    { value: 'all', label: 'All Types' },
    { value: 'text-generation', label: 'Text Generation' },
    { value: 'text2text-generation', label: 'Text-to-Text' },
    { value: 'text-to-image', label: 'Text-to-Image' },
    { value: 'automatic-speech-recognition', label: 'Speech Recognition' },
    { value: 'sentence-similarity', label: 'Sentence Similarity' },
    { value: 'summarization', label: 'Summarization' },
    { value: 'fill-mask', label: 'Fill Mask' },
    { value: 'question-answering', label: 'Question Answering' },
    { value: 'translation', label: 'Translation' },
    { value: 'image-classification', label: 'Image Classification' }
  ];

  res.json(types);
  return;
});

// Save HuggingFace API token
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    // Save or update token in settings
    const existing = await db
      .selectFrom('settings')
      .select('key')
      .where('key', '=', 'huggingface_token')
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable('settings')
        .set({
          value: token,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .where('key', '=', 'huggingface_token')
        .execute();
    } else {
      await db
        .insertInto('settings')
        .values({
          key: 'huggingface_token',
          value: token,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .execute();
    }

    console.log('HuggingFace token saved');
    res.json({ success: true });
    return;
  } catch (error) {
    console.error('Error saving token:', error);
    res.status(500).json({ error: 'Failed to save token' });
    return;
  }
});

// Get HuggingFace API token status
router.get('/token', async (_req, res) => {
  try {
    const token = await getHFToken();
    res.json({ 
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 6)}...` : null
    });
    return;
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Failed to fetch token status' });
    return;
  }
});

// Generate MCP server configuration files
router.post('/generate-mcp', async (req, res) => {
  try {
    const { model_id, config } = req.body;

    if (!model_id) {
      res.status(400).json({ error: 'Missing model_id' });
      return;
    }

    // Fetch model details
    const model = await db
      .selectFrom('huggingface_models')
      .selectAll()
      .where('id', '=', model_id)
      .executeTakeFirst();

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Generate MCP server configuration
    const mcpConfig = {
      mcpServers: {
        [model.model_name]: {
          command: 'python',
          args: ['-m', 'mcp_server_huggingface'],
          env: {
            MODEL_PATH: model.local_path,
            MODEL_ID: model.model_id,
            MODEL_TYPE: model.model_type,
            TEMPERATURE: String(config?.temperature || 0.7),
            MAX_TOKENS: String(config?.maxTokens || 512),
            TOP_P: String(config?.topP || 0.9),
            TOP_K: String(config?.topK || 50),
            REPETITION_PENALTY: String(config?.repetitionPenalty || 1.0),
            BATCH_SIZE: String(config?.batchSize || 1)
          }
        }
      }
    };

    // Save configuration files to model directory
    const configPath = path.join(model.local_path!, 'mcp_config.json');
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));

    console.log('MCP configuration generated:', model.model_id);

    res.json({ 
      success: true,
      config: mcpConfig,
      config_path: configPath
    });
    return;
  } catch (error) {
    console.error('Error generating MCP config:', error);
    res.status(500).json({ error: 'Failed to generate MCP configuration' });
    return;
  }
});

export default router;
