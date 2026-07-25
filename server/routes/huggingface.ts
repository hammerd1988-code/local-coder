import express from 'express';
import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import https from 'https';

const router = express.Router();

const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
const modelsDirectory = path.join(dataDirectory, "huggingface-models");

// Ensure models directory exists
if (!fs.existsSync(modelsDirectory)) {
  fs.mkdirSync(modelsDirectory, { recursive: true });
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
    
    // Mock search results - in production, this would call HuggingFace API
    const mockResults = [
      {
        id: 'meta-llama/Llama-2-7b-chat-hf',
        name: 'Llama 2 7B Chat',
        type: 'text-generation',
        description: 'Meta\'s Llama 2 7B parameter model fine-tuned for chat applications',
        downloads: 1250000,
        likes: 45600,
        size_mb: 13500,
        tags: ['llm', 'conversational', 'meta']
      },
      {
        id: 'openai/whisper-large-v3',
        name: 'Whisper Large V3',
        type: 'automatic-speech-recognition',
        description: 'OpenAI\'s Whisper large model for speech recognition',
        downloads: 876000,
        likes: 32400,
        size_mb: 2900,
        tags: ['audio', 'speech-to-text', 'multilingual']
      },
      {
        id: 'stabilityai/stable-diffusion-xl-base-1.0',
        name: 'Stable Diffusion XL',
        type: 'text-to-image',
        description: 'SDXL base model for high-quality image generation',
        downloads: 2340000,
        likes: 67800,
        size_mb: 6700,
        tags: ['diffusion', 'image-generation', 'art']
      },
      {
        id: 'sentence-transformers/all-MiniLM-L6-v2',
        name: 'MiniLM-L6 Sentence Embeddings',
        type: 'sentence-similarity',
        description: 'Fast and efficient sentence embedding model',
        downloads: 3450000,
        likes: 12300,
        size_mb: 90,
        tags: ['embeddings', 'similarity', 'nlp']
      },
      {
        id: 'facebook/bart-large-cnn',
        name: 'BART Large CNN',
        type: 'summarization',
        description: 'BART model fine-tuned for text summarization',
        downloads: 654000,
        likes: 8900,
        size_mb: 1600,
        tags: ['summarization', 'nlp', 'facebook']
      },
      {
        id: 'bert-base-uncased',
        name: 'BERT Base Uncased',
        type: 'fill-mask',
        description: 'Base BERT model for masked language modeling',
        downloads: 5670000,
        likes: 23400,
        size_mb: 440,
        tags: ['bert', 'nlp', 'base-model']
      },
      {
        id: 'microsoft/phi-2',
        name: 'Phi-2',
        type: 'text-generation',
        description: 'Microsoft\'s small language model with 2.7B parameters',
        downloads: 456000,
        likes: 15600,
        size_mb: 5400,
        tags: ['llm', 'small-model', 'efficient']
      },
      {
        id: 'google/flan-t5-large',
        name: 'FLAN-T5 Large',
        type: 'text2text-generation',
        description: 'Google\'s instruction-tuned T5 model',
        downloads: 789000,
        likes: 19200,
        size_mb: 3000,
        tags: ['instruction-following', 'google', 't5']
      },
      {
        id: 'runwayml/stable-diffusion-v1-5',
        name: 'Stable Diffusion v1.5',
        type: 'text-to-image',
        description: 'Popular SD 1.5 model for image generation',
        downloads: 4560000,
        likes: 89000,
        size_mb: 4000,
        tags: ['diffusion', 'image-generation']
      },
      {
        id: 'distilbert-base-uncased',
        name: 'DistilBERT Base',
        type: 'fill-mask',
        description: 'Distilled version of BERT, faster and lighter',
        downloads: 2340000,
        likes: 11200,
        size_mb: 260,
        tags: ['bert', 'distilled', 'efficient']
      }
    ];

    let results = mockResults;

    // Filter by query
    if (query && typeof query === 'string') {
      const q = query.toLowerCase();
      results = results.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some(t => t.includes(q))
      );
    }

    // Filter by type
    if (type !== 'all') {
      results = results.filter(m => m.type === type);
    }

    // Apply limit
    const limitNum = typeof limit === 'string' ? parseInt(limit) : 20;
    results = results.slice(0, limitNum);

    res.json(results);
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
        metadata: JSON.stringify(metadata)
      })
      .executeTakeFirst();

    console.log('Model download started:', model_id);

    // Simulate download (in production, this would download from HuggingFace)
    setTimeout(async () => {
      try {
        // Create model directory
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        // Create a placeholder file
        const placeholderPath = path.join(localPath, 'model.bin');
        fs.writeFileSync(placeholderPath, `Model: ${model_name}\nID: ${model_id}\nDownloaded at: ${new Date().toISOString()}`);

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

        console.log('Model download completed:', model_id);
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
    }, 3000);

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

export default router;
