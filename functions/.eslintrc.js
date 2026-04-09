module.exports = {
  root: true,
  env: {
    node: true,   // 🔥 THIS FIXES YOUR ERROR
    es2021: true
  },
  extends: [
    "eslint:recommended"
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {}
};