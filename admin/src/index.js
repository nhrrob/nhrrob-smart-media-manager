import { createRoot } from '@wordpress/element';
import App from './components/App';
import { initTheme } from './theme';

initTheme();

const root = document.getElementById( 'nhrsmm-app' );
if ( root ) {
	createRoot( root ).render( <App /> );
}
