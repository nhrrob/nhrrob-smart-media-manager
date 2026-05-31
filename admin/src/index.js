import { createRoot } from '@wordpress/element';
import App from './components/App';

const root = document.getElementById( 'nhrsmm-app' );
if ( root ) {
	createRoot( root ).render( <App /> );
}
