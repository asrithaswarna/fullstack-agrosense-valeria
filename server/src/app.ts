import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { apiRouter } from './routes/api.js'

const app = express()
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

app.use(cors({
  origin(origin, callback) {
    callback(null, origin === undefined || origin === clientUrl)
  },
}))
app.use(express.json({ limit: '100kb' }))

if (process.env.NODE_ENV !== 'production') {
  app.use((request, _response, next) => {
    console.info(`${request.method} ${request.path}`)
    next()
  })
}

app.use('/api', apiRouter)
app.use(notFound)
app.use(errorHandler)

export default app
