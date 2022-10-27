module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    rules: {
        "no-new":"off",
        "@typescript-eslint/no-extraneous-class": "off"
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            extends: ['standard-with-typescript', 'plugin:@typescript-eslint/recommended', 'eslint:recommended', 'plugin:@typescript-eslint/recommended'],
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: ['./tsconfig.json']
            },
              rules: {
        "no-new":"off",
        "@typescript-eslint/no-extraneous-class": "off",
                  "Import can be shortened ": "off"
    },
        },

    ],

    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint']
};
