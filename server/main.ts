import express, { Request, Response } from 'express'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:3000/auth/google/callback'
)

// Generate authorization URL
app.get('/auth/google', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
  res.redirect(authUrl)
})

// Handle OAuth2 callback
app.get('/auth/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' })
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string)
    oauth2Client.setCredentials(tokens)

    const loginTicket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
    })
    const email = loginTicket.getPayload()?.email!

    res.redirect(
      'obsidian://time-ruler-google-auth?accessToken=' +
        tokens.access_token +
        '&refreshToken=' +
        tokens.refresh_token +
        '&expiresIn=' +
        tokens.expiry_date +
        '&email=' +
        email
    )
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tokens', details: error })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
