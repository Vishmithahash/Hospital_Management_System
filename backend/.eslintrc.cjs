module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 2021
  },
  rules: {
    'no-console': 'off',
    semi: 'off',
    'space-before-function-paren': 'off'
  }
};
