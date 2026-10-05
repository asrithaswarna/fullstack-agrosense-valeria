import { Router } from 'express'
import { alertController } from '../controllers/alertController.js'
import { analyticsController } from '../controllers/analyticsController.js'
import { authController } from '../controllers/authController.js'
import { greenhouseController } from '../controllers/greenhouseController.js'
import { readingController } from '../controllers/readingController.js'
import { sensorController } from '../controllers/sensorController.js'
import { systemController } from '../controllers/systemController.js'
import { authenticate } from '../middleware/authenticate.js'
import { AppError } from '../utils/AppError.js'

export const apiRouter = Router()

apiRouter.get('/health', (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'VALERIA API is running',
    data: { timestamp: new Date().toISOString() },
  })
})

apiRouter.post('/auth/register', authController.register)
apiRouter.post('/auth/login', authController.login)

apiRouter.get('/auth/me', authenticate, authController.me)
apiRouter.patch('/auth/profile', authenticate, authController.updateProfile)
apiRouter.patch('/auth/password', authenticate, authController.changePassword)

apiRouter.get('/sensors', authenticate, sensorController.list)
apiRouter.post('/sensors', authenticate, sensorController.create)
apiRouter.get('/sensors/:id', authenticate, sensorController.get)
apiRouter.patch('/sensors/:id', authenticate, sensorController.update)
apiRouter.delete('/sensors/:id', authenticate, sensorController.delete)

apiRouter.get('/readings/latest', authenticate, readingController.latest)
apiRouter.get('/readings/history', authenticate, readingController.history)
apiRouter.post('/readings', authenticate, readingController.create)

apiRouter.get('/alerts/active', authenticate, alertController.active)
apiRouter.get('/alerts', authenticate, alertController.list)
apiRouter.get('/alerts/:id', authenticate, alertController.get)
apiRouter.patch('/alerts/:id', authenticate, alertController.update)

apiRouter.get('/analytics/summary', authenticate, analyticsController.summary)
apiRouter.get('/analytics', authenticate, analyticsController.get)

apiRouter.get('/greenhouse', authenticate, greenhouseController.get)
apiRouter.patch('/greenhouse', authenticate, greenhouseController.update)
apiRouter.get('/greenhouse/irrigation', authenticate, systemController.irrigation)

apiRouter.get('/system/status', authenticate, systemController.status)

apiRouter.use((_request, _response, next) => {
  next(new AppError('Route not found.', 404))
})
