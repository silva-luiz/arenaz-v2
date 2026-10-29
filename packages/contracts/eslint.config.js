import base from '@arenaz/config/eslint';

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];
