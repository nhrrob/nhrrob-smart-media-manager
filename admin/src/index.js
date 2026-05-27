import { render } from '@wordpress/element';
import App from './components/App';

const root = document.getElementById( 'nhrsmm-app' );
if ( root ) {
	render( <App />, root );
}
