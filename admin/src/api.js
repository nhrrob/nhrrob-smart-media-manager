const cfg = window.nhrsmmConfig || {};

export async function apiFetch( method, path, body = null ) {
	const opts = {
		method,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce':   cfg.nonce,
		},
		credentials: 'same-origin',
	};
	if ( body && method !== 'GET' ) {
		opts.body = JSON.stringify( body );
	}
	const url = cfg.restUrl + path;
	const res = await fetch( url, opts );
	const data = await res.json().catch( () => null );
	if ( ! res.ok ) {
		const msg = data?.message || data?.code || `HTTP ${ res.status }`;
		throw Object.assign( new Error( msg ), { status: res.status, code: data?.code } );
	}
	return data;
}

export const get  = ( path )       => apiFetch( 'GET',    path );
export const post = ( path, body ) => apiFetch( 'POST',   path, body );
export const put  = ( path, body ) => apiFetch( 'PUT',    path, body );
export const del  = ( path, body ) => apiFetch( 'DELETE', path, body );
