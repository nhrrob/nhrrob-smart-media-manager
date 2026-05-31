module.exports = {
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	env: {
		browser: true,
		es2021: true,
	},
	globals: {
		nhrsmmConfig: 'readonly',
		nhrsmmSettingsConfig: 'readonly',
	},
	rules: {
		'@wordpress/i18n-text-domain': [
			'error',
			{ allowedTextDomain: [ 'nhrrob-smart-media-manager' ] },
		],
	},
};
