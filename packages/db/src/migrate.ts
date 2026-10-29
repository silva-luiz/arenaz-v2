import { runMigrations } from './migrations.js';

const url = process.env['DATABASE_URL'];

if (!url) {
  console.error(
    'DATABASE_URL não definida. Copie .env.example para .env (ou exporte a variável) e tente novamente.',
  );
  process.exit(1);
}

try {
  await runMigrations(url);
  console.log('Migrations aplicadas.');
} catch (error) {
  console.error('Falha ao aplicar as migrations:', error);
  process.exit(1);
}
