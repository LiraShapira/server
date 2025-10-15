import app from './server';

const PORT = Number(process.env.PORT) || 3001;

console.log('Server starting with Supabase client...');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server available on http://0.0.0.0:${PORT}/`);
});
