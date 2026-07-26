import { getConfig } from '../utils/config'

export default defineEventHandler(async (event) => {
  try {
    if (event.method === 'GET') {
      const authenticated = getCookie(event, 'auth_token') === 'verified'
      return { status: 200, data: { authenticated } }
    }
    if (event.method === 'POST') {
      const body = await readBody<{ token?: string }>(event)
      if (!body?.token) return { status: 400, data: { message: 'Token Required' } }
      const adminSecret = getConfig('adminSecret')
      if (adminSecret && body.token === adminSecret) {
        setCookie(event, 'auth_token', 'verified', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 60 * 60 * 24 * 7, path: '/' })
        return { status: 200, data: { message: 'Login Success' } }
      }
      return { status: 401, data: { message: 'Invalid Token' } }
    }
    return { status: 405, data: { message: 'Method Not Supported' } }
  } catch {
    return { status: 500, data: { message: 'Processing Auth Failed' } }
  }
})
