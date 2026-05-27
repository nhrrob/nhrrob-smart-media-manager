export function formatBytes( bytes ) {
	if ( ! bytes ) return '0 B';
	const k     = 1024;
	const sizes = [ 'B', 'KB', 'MB', 'GB' ];
	const i     = Math.floor( Math.log( bytes ) / Math.log( k ) );
	return parseFloat( ( bytes / Math.pow( k, i ) ).toFixed( 1 ) ) + ' ' + sizes[ i ];
}

export function formatDate( dateStr ) {
	if ( ! dateStr ) return '';
	const d = new Date( dateStr );
	return d.toLocaleDateString( undefined, { year: 'numeric', month: 'short', day: 'numeric' } );
}

export function mimeToLabel( mime ) {
	if ( ! mime ) return 'FILE';
	if ( mime.startsWith( 'image' ) ) return 'IMG';
	if ( mime.startsWith( 'video' ) ) return 'VID';
	if ( mime.startsWith( 'audio' ) ) return 'AUD';
	if ( mime.includes( 'pdf' ) ) return 'PDF';
	if ( mime.includes( 'zip' ) || mime.includes( 'rar' ) ) return 'ZIP';
	if ( mime.includes( 'word' ) || mime.includes( 'document' ) ) return 'DOC';
	if ( mime.includes( 'excel' ) || mime.includes( 'spreadsheet' ) ) return 'XLS';
	return 'FILE';
}

export function typeToIcon( type ) {
	const map = {
		image:       'ti-photo',
		video:       'ti-player-play',
		audio:       'ti-music',
		pdf:         'ti-file-type-pdf',
		document:    'ti-file-type-doc',
		spreadsheet: 'ti-file-spreadsheet',
		archive:     'ti-file-zip',
		other:       'ti-file',
	};
	return map[ type ] || 'ti-file';
}

export function typeToClass( type ) {
	return 'type-' + ( type || 'other' );
}

export function iconForMime( mime ) {
	if ( ! mime ) return 'ti-file';
	if ( mime.startsWith( 'image' ) ) return 'ti-photo';
	if ( mime.startsWith( 'video' ) ) return 'ti-player-play';
	if ( mime.startsWith( 'audio' ) ) return 'ti-music';
	if ( mime.includes( 'pdf' ) ) return 'ti-file-type-pdf';
	return 'ti-file';
}

export async function copyToClipboard( text ) {
	if ( navigator.clipboard ) {
		return navigator.clipboard.writeText( text );
	}
	const el = document.createElement( 'textarea' );
	el.value          = text;
	el.style.position = 'fixed';
	el.style.opacity  = '0';
	document.body.appendChild( el );
	el.select();
	document.execCommand( 'copy' );
	document.body.removeChild( el );
	return Promise.resolve();
}

export function getUrlParam( key ) {
	return new URLSearchParams( window.location.search ).get( key );
}

export function setUrlParams( params ) {
	const url = new URL( window.location.href );
	Object.entries( params ).forEach( ( [ k, v ] ) => {
		if ( v === null || v === '' || v === undefined ) {
			url.searchParams.delete( k );
		} else {
			url.searchParams.set( k, v );
		}
	} );
	window.history.replaceState( {}, '', url.toString() );
}

export function findFolder( folders, id ) {
	for ( const f of folders ) {
		if ( f.id === id ) return f;
		if ( f.children ) {
			const found = findFolder( f.children, id );
			if ( found ) return found;
		}
	}
	return null;
}

export function getFolderName( folders, id ) {
	const f = findFolder( folders, id );
	return f ? f.name : '—';
}
