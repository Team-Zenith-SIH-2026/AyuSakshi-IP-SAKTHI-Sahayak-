const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { query } = require('./db');
require('dotenv').config();

// 1. JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'ayusakshi_jwt_super_secret_key_sih26045_prod_ready',
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
      const res = await query('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE id = $1', [jwtPayload.id]);
      if (res.rows.length > 0) {
        return done(null, res.rows[0]);
      }
      return done(null, false);
    } catch (err) {
      return done(err, false);
    }
  })
);

// 2. Google OAuth Strategy (active if credentials provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_ID.includes('your_google')) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@google.com`;
          const name = profile.displayName || profile.name ? `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() : 'Google User';
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

          // Check if user exists
          let res = await query('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE email = $1', [email]);
          if (res.rows.length > 0) {
            return done(null, res.rows[0]);
          }

          // Create new user
          res = await query(
            `INSERT INTO users (email, name, role, auth_provider, provider_id, avatar_url)
             VALUES ($1, $2, 'user', 'google', $3, $4)
             RETURNING id, email, name, role, auth_provider, avatar_url`,
            [email, name, profile.id, avatarUrl]
          );

          return done(null, res.rows[0]);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );
}

// 3. Facebook OAuth Strategy (active if credentials provided)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET && !process.env.FACEBOOK_APP_ID.includes('your_facebook')) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'photos', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`;
          const name = profile.displayName || 'Facebook User';
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

          let res = await query('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE email = $1', [email]);
          if (res.rows.length > 0) {
            return done(null, res.rows[0]);
          }

          res = await query(
            `INSERT INTO users (email, name, role, auth_provider, provider_id, avatar_url)
             VALUES ($1, $2, 'user', 'facebook', $3, $4)
             RETURNING id, email, name, role, auth_provider, avatar_url`,
            [email, name, profile.id, avatarUrl]
          );

          return done(null, res.rows[0]);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );
}

module.exports = passport;
