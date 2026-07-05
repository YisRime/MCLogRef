// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'indent': ['warn', 2],
      'semi': ['warn', 'never'],
      'quotes': ['warn', 'single'],
      'comma-dangle': ['warn', 'always-multiline'],
      'no-duplicate-imports': 'error',
    },
  },
)
