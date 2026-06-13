export default function handler(req, res) {
  res.status(200).json({
    CLIENT_ID: process.env.TOCONLINE_CLIENT_ID ? '✓ definido' : '✗ ausente',
    CLIENT_SECRET: process.env.TOCONLINE_CLIENT_SECRET ? '✓ definido' : '✗ ausente',
    OAUTH_URL: process.env.TOCONLINE_OAUTH_URL || '(usando default)',
    API_URL: process.env.TOCONLINE_API_URL || '(usando default)',
    SUPABASE_URL: process.env.SUPABASE_URL ? '✓ definido' : '✗ ausente',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✓ definido' : '✗ ausente',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ definido' : '✗ ausente',
  });
}
