import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import app from '../app.js'
import { authRepository } from '../repositories/authRepository.js'
import { authService } from './authService.js'

const userId = '41fda8c2-31af-4c57-9a22-978bec6b1a93'

async function withPasswordRepository(
  run: (record: { passwordHash: string }) => Promise<void>,
): Promise<void> {
  const record = { passwordHash: await bcrypt.hash('Old-password-123', 4) }
  const originalFind = authRepository.findPasswordHashById
  const originalUpdate = authRepository.updatePasswordHash
  authRepository.findPasswordHashById = async (id) => id === userId ? record.passwordHash : null
  authRepository.updatePasswordHash = async (id, passwordHash) => {
    assert.equal(id, userId)
    record.passwordHash = passwordHash
  }
  try {
    await run(record)
  } finally {
    authRepository.findPasswordHashById = originalFind
    authRepository.updatePasswordHash = originalUpdate
  }
}

test('password change hashes the new password and invalidates the old password', async () => {
  await withPasswordRepository(async (record) => {
    const result = await authService.changePassword(userId, {
      currentPassword: 'Old-password-123',
      newPassword: 'New-password-456',
    })
    assert.deepEqual(result, { changed: true })
    assert.notEqual(record.passwordHash, 'New-password-456')
    assert.equal(await bcrypt.compare('Old-password-123', record.passwordHash), false)
    assert.equal(await bcrypt.compare('New-password-456', record.passwordHash), true)
    assert.equal('passwordHash' in result, false)
  })
})

test('password change rejects an incorrect current password', async () => {
  await withPasswordRepository(async () => {
    await assert.rejects(
      authService.changePassword(userId, {
        currentPassword: 'Wrong-password-123',
        newPassword: 'New-password-456',
      }),
      { message: 'Current password is incorrect.' },
    )
  })
})

test('password change rejects a new password outside the existing length rules', async () => {
  await withPasswordRepository(async () => {
    await assert.rejects(
      authService.changePassword(userId, {
        currentPassword: 'Old-password-123',
        newPassword: 'short',
      }),
      { message: 'Password must be between 8 and 72 characters.' },
    )
  })
})

test('password change endpoint requires authentication', async () => {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test API server did not start.')
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'Old-password-123', newPassword: 'New-password-456' }),
    })
    assert.equal(response.status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
