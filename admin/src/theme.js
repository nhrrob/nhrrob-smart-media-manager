import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const KEY = 'nhrsmm_theme';
const root = document.documentElement;

// Saved choice first, otherwise follow the operating system. The theme lives on <html>
// because modals and menus are portalled to <body>, outside the app root.
export function initTheme() {
	let theme = '';
	try {
		theme = window.localStorage.getItem( KEY ) || '';
	} catch {
		// localStorage unavailable: fall back to the OS setting.
	}
	if ( theme !== 'dark' && theme !== 'light' ) {
		theme = window.matchMedia?.( '(prefers-color-scheme: dark)' ).matches
			? 'dark'
			: 'light';
	}
	root.dataset.nhrsmmTheme = theme;
	return theme;
}

export function ThemeToggle() {
	const [ theme, setTheme ] = useState(
		() => root.dataset.nhrsmmTheme || initTheme()
	);

	const toggle = () => {
		const next = theme === 'dark' ? 'light' : 'dark';
		root.dataset.nhrsmmTheme = next;
		setTheme( next );
		try {
			window.localStorage.setItem( KEY, next );
		} catch {
			// The choice still applies until the page is reloaded.
		}
	};

	const label =
		theme === 'dark'
			? __( 'Switch to light theme', 'nhrrob-smart-media-manager' )
			: __( 'Switch to dark theme', 'nhrrob-smart-media-manager' );

	return (
		<button
			type="button"
			className="btn-icon theme-toggle"
			title={ label }
			aria-label={ label }
			onClick={ toggle }
		>
			<span aria-hidden="true">{ theme === 'dark' ? '☀' : '☾' }</span>
		</button>
	);
}
