import base from '@arenaz/config/eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat.recommended,
  { ignores: ['next-env.d.ts'] },
];
