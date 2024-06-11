/** @type {import("prettier").Options} */
const config = {
  printWidth: 80,
  proseWrap: 'always',
  semi: true,
  singleQuote: true,
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^[(./)]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  plugins: [
    '@trivago/prettier-plugin-sort-imports',
  ],
};

module.exports = config;
