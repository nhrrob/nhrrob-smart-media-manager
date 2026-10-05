import { createRoot } from '@wordpress/element';
import SettingsApp from './components/SettingsApp';
import { initTheme } from './theme';

initTheme();

const root = document.getElementById( 'nhrsmm-settings-app' );
if ( root ) {
	createRoot( root ).render( <SettingsApp /> );
}
