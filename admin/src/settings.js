import { render } from '@wordpress/element';
import SettingsApp from './components/SettingsApp';

const root = document.getElementById( 'nhrsmm-settings-app' );
if ( root ) {
	render( <SettingsApp />, root );
}
