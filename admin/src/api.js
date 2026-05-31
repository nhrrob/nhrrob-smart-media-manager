const cfg = window.nhrsmmConfig || {};

// Plain-permalink: rest_route= value can't contain an embedded query string; promote params to top-level.
function buildUrl( path ) {
	const base = cfg.restUrl || '';
	if ( ! base.includes( 'rest_route=' ) ) {
		return base + path;
	}
	const [ routePart, queryPart ] = path.split( '?' );
	const url = base + routePart;
	return queryPart ? url + '&' + queryPart : url;
}

export async function apiFetch( method, path, body = null ) {
	const opts = {
		method,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': cfg.nonce,
		},
		credentials: 'same-origin',
	};
	if ( body && method !== 'GET' ) {
		opts.body = JSON.stringify( body );
	}
	const url = buildUrl( path );
	const res = await fetch( url, opts );
	const data = await res.json().catch( () => null );
	if ( ! res.ok ) {
		const msg = data?.message || data?.code || `HTTP ${ res.status }`;
		throw Object.assign( new Error( msg ), {
			status: res.status,
			code: data?.code,
		} );
	}
	return data;
}

export const get = ( path ) => apiFetch( 'GET', path );
export const post = ( path, body ) => apiFetch( 'POST', path, body );
export const put = ( path, body ) => apiFetch( 'PUT', path, body );
export const del = ( path, body ) => apiFetch( 'DELETE', path, body );
