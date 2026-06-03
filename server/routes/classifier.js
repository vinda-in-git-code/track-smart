const express = require('express')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const router = express.Router()

const CLASSIFIER_SPACE = process.env.CLASSIFIER_SPACE || 'LuxDream/receipt-category-classifier'
const CLASSIFIER_API_NAME = process.env.CLASSIFIER_API_NAME || '/predict_category'

let clientPromise

async function getClassifierClient() {
  if (!clientPromise) {
    clientPromise = import('@gradio/client').then(({ Client }) => {
      const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined
      return Client.connect(CLASSIFIER_SPACE, options)
    })
  }

  return clientPromise
}

router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Receipt JSON is required' })
    }

    const client = await getClassifierClient()
    const jsonFile = new Blob([JSON.stringify(req.body)], { type: 'application/json' })
    const result = await client.predict(CLASSIFIER_API_NAME, {
      json_file: jsonFile,
    })

    const data = Array.isArray(result.data) && result.data.length === 1
      ? result.data[0]
      : result.data

    res.json(data)
  } catch (err) {
    clientPromise = undefined
    res.status(502).json({
      error: 'Classifier service error',
      detail: err.message,
    })
  }
})

module.exports = router
