import type { Request, Response } from 'express'
import { authService } from '../services/authService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'

export const authController = {
  async register(request: Request, response: Response): Promise<void> {
    sendData(response, await authService.register(request.body), 201)
  },

  async login(request: Request, response: Response): Promise<void> {
    sendData(response, await authService.login(request.body))
  },

  async me(request: Request, response: Response): Promise<void> {
    sendData(response, await authService.getCurrentUser(authenticatedUserId(request)))
  },

  async updateProfile(request: Request, response: Response): Promise<void> {
    sendData(response, await authService.updateProfile(authenticatedUserId(request), request.body))
  },

  async changePassword(request: Request, response: Response): Promise<void> {
    sendData(response, await authService.changePassword(authenticatedUserId(request), request.body))
  },
}
