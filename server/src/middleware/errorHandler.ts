import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { AppError } from '../utils/AppError.js'
import type { ApiFailure } from '../types/domain.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  let statusCode = 500
  let message = 'An unexpected server error occurred.'

  if (error instanceof AppError) {
    statusCode = error.statusCode
    message = error.message
  } else if (error instanceof SyntaxError) {
    statusCode = 400
    message = 'Request body contains invalid JSON.'
  } else if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    statusCode = 413
    message = 'Request body is too large.'
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      statusCode = 409
      message = 'A record with those details already exists.'
    } else if (error.code === 'P2025') {
      statusCode = 404
      message = 'The requested record was not found.'
    } else if (error.code === 'P2003') {
      statusCode = 409
      message = 'The record cannot be changed while related records depend on it.'
    } else {
      console.error(`Unhandled database request error (${error.code}).`)
    }
  } else {
    console.error('Unhandled VALERIA API error.')
  }

  response.status(statusCode).json({ success: false, message } satisfies ApiFailure)
}
