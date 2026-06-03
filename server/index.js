const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const transactionsRouter = require('./routes/transactions')
const ocrRouter = require('./routes/ocr')
const adminRouter = require('./routes/admin')
const classifierRouter = require('./routes/classifier')

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:5174']

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json())

app.use('/api/transactions', transactionsRouter)
app.use('/api/ocr', ocrRouter)
app.use('/api/admin', adminRouter)
app.use('/api/classifier', classifierRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Track Smart API is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
