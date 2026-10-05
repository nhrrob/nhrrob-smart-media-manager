export function formatBytes( bytes ) {
	if ( ! bytes ) {
		return '0 B';
	}
	const k = 1024;
	const sizes = [ 'B', 'KB', 'MB', 'GB' ];
	const i = Math.floor( Math.log( bytes ) / Math.log( k ) );
	return (
		parseFloat( ( bytes / Math.pow( k, i ) ).toFixed( 1 ) ) +
		' ' +
		sizes[ i ]
	);
}

export function formatDate( dateStr ) {
	if ( ! dateStr ) {
		return '';
	}
	const d = new Date( dateStr );
	return d.toLocaleDateString( undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
}

export function mimeToLabel( mime ) {
	if ( ! mime ) {
		return 'FILE';
	}
	if ( mime.startsWith( 'image' ) ) {
		return 'IMG';
	}
	if ( mime.startsWith( 'video' ) ) {
		return 'VID';
	}
	if ( mime.startsWith( 'audio' ) ) {
		return 'AUD';
	}
	if ( mime.includes( 'pdf' ) ) {
		return 'PDF';
	}
	if ( mime.includes( 'zip' ) || mime.includes( 'rar' ) ) {
		return 'ZIP';
	}
	if ( mime.includes( 'word' ) || mime.includes( 'document' ) ) {
		return 'DOC';
	}
	if ( mime.includes( 'excel' ) || mime.includes( 'spreadsheet' ) ) {
		return 'XLS';
	}
	if ( mime.includes( 'csv' ) ) {
		return 'CSV';
	}
	return 'FILE';
}

export function typeToIcon( type ) {
	const map = {
		image: 'ti-photo',
		video: 'ti-player-play',
		audio: 'ti-music',
		pdf: 'ti-file-type-pdf',
		document: 'ti-file-type-doc',
		spreadsheet: 'ti-file-spreadsheet',
		archive: 'ti-file-zip',
		other: 'ti-file',
	};
	return map[ type ] || 'ti-file';
}

export function typeToClass( type ) {
	return 'type-' + ( type || 'other' );
}

export function iconForMime( mime ) {
	if ( ! mime ) {
		return 'ti-file';
	}
	if ( mime.startsWith( 'image' ) ) {
		return 'ti-photo';
	}
	if ( mime.startsWith( 'video' ) ) {
		return 'ti-player-play';
	}
	if ( mime.startsWith( 'audio' ) ) {
		return 'ti-music';
	}
	if ( mime.includes( 'pdf' ) ) {
		return 'ti-file-type-pdf';
	}
	return 'ti-file';
}

export async function copyToClipboard( text ) {
	if ( navigator.clipboard ) {
		return navigator.clipboard.writeText( text );
	}
	const el = document.createElement( 'textarea' );
	el.value = text;
	el.style.position = 'fixed';
	el.style.opacity = '0';
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
		if ( f.id === id ) {
			return f;
		}
		if ( f.children ) {
			const found = findFolder( f.children, id );
			if ( found ) {
				return found;
			}
		}
	}
	return null;
}

export function getFolderName( folders, id ) {
	const f = findFolder( folders, id );
	return f ? f.name : '—';
}

export function findFolderPath( folders, id, trail = [] ) {
	for ( const f of folders ) {
		const next = [ ...trail, f ];
		if ( f.id === id ) {
			return next;
		}
		const found = findFolderPath( f.children || [], id, next );
		if ( found ) {
			return found;
		}
	}
	return null;
}

export function flattenFolders( folders, depth = 0 ) {
	return folders.flatMap( ( f ) => [
		{ id: f.id, name: f.name, depth },
		...flattenFolders( f.children || [], depth + 1 ),
	] );
}

// Recent files: kept in memory, mirrored to localStorage, synced to user meta by App.
let recentIds = null;
export function getRecent() {
	if ( recentIds === null ) {
		const fromServer = window.nhrsmmConfig?.recentIds || [];
		try {
			recentIds = fromServer.length
				? fromServer
				: JSON.parse(
						localStorage.getItem( 'nhrsmm_recent_ids' ) || '[]'
				  );
		} catch {
			recentIds = [];
		}
	}
	return recentIds;
}
export function setRecent( ids ) {
	recentIds = ids;
	localStorage.setItem( 'nhrsmm_recent_ids', JSON.stringify( ids ) );
}

export function saveBlob( blob, filename ) {
	const a = document.createElement( 'a' );
	a.href = URL.createObjectURL( blob );
	a.download = filename;
	document.body.appendChild( a );
	a.click();
	a.remove();
	setTimeout( () => URL.revokeObjectURL( a.href ), 1000 );
}

// Reads dropped files and folders. Entries must be taken synchronously inside the drop event.
export function collectDropped( dataTransfer ) {
	const entries = Array.from( dataTransfer.items || [] )
		.map( ( item ) =>
			item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
		)
		.filter( Boolean );

	if ( ! entries.some( ( entry ) => entry.isDirectory ) ) {
		return Promise.resolve(
			Array.from( dataTransfer.files ).map( ( file ) => ( {
				file,
				path: [],
			} ) )
		);
	}

	const out = [];
	function walk( entry, path ) {
		if ( entry.isFile ) {
			return new Promise( ( resolve ) =>
				entry.file(
					( file ) => {
						if ( ! file.name.startsWith( '.' ) ) {
							out.push( { file, path } );
						}
						resolve();
					},
					() => resolve()
				)
			);
		}
		const reader = entry.createReader();
		const next = [ ...path, entry.name ];
		// readEntries returns at most 100 entries per call; read until it returns none.
		return new Promise( ( resolve ) => {
			function read() {
				reader.readEntries(
					( batch ) => {
						if ( ! batch.length ) {
							resolve();
							return;
						}
						Promise.all(
							batch.map( ( child ) => walk( child, next ) )
						).then( read );
					},
					() => resolve()
				);
			}
			read();
		} );
	}
	return Promise.all( entries.map( ( entry ) => walk( entry, [] ) ) ).then(
		() => out
	);
}

/* eslint-disable no-bitwise */
let crcTable = null;
function crc32( bytes ) {
	if ( ! crcTable ) {
		crcTable = new Uint32Array( 256 );
		for ( let n = 0; n < 256; n++ ) {
			let c = n;
			for ( let k = 0; k < 8; k++ ) {
				c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
			}
			crcTable[ n ] = c;
		}
	}
	let crc = 0xffffffff;
	for ( let i = 0; i < bytes.length; i++ ) {
		crc = crcTable[ ( crc ^ bytes[ i ] ) & 0xff ] ^ ( crc >>> 8 );
	}
	return ( crc ^ 0xffffffff ) >>> 0;
}
/* eslint-enable no-bitwise */

// Builds an uncompressed (stored) ZIP in the browser; media files are already compressed.
export async function buildZip( files, onProgress ) {
	const encoder = new TextEncoder();
	const parts = [];
	const central = [];
	const used = new Set();
	let offset = 0;
	let done = 0;

	for ( const item of files ) {
		let path = item.path;
		for ( let n = 2; used.has( path ); n++ ) {
			path = item.path.replace( /(\.[^./]+)?$/, `-${ n }$1` );
		}
		used.add( path );

		const res = await fetch( item.url, { credentials: 'same-origin' } );
		if ( ! res.ok ) {
			throw new Error( `HTTP ${ res.status }: ${ item.path }` );
		}
		const data = new Uint8Array( await res.arrayBuffer() );
		const name = encoder.encode( path );
		const crc = crc32( data );

		const local = new DataView( new ArrayBuffer( 30 ) );
		local.setUint32( 0, 0x04034b50, true );
		local.setUint16( 4, 20, true );
		local.setUint16( 6, 0x0800, true );
		local.setUint32( 14, crc, true );
		local.setUint32( 18, data.length, true );
		local.setUint32( 22, data.length, true );
		local.setUint16( 26, name.length, true );
		parts.push( local.buffer, name, data );

		const entry = new DataView( new ArrayBuffer( 46 ) );
		entry.setUint32( 0, 0x02014b50, true );
		entry.setUint16( 4, 20, true );
		entry.setUint16( 6, 20, true );
		entry.setUint16( 8, 0x0800, true );
		entry.setUint32( 16, crc, true );
		entry.setUint32( 20, data.length, true );
		entry.setUint32( 24, data.length, true );
		entry.setUint16( 28, name.length, true );
		entry.setUint32( 42, offset, true );
		central.push( entry.buffer, name );

		offset += 30 + name.length + data.length;
		if ( offset > 0xf0000000 ) {
			throw new Error( 'ZIP too large' );
		}
		onProgress?.( ++done, files.length );
	}

	const centralSize = central.reduce( ( sum, p ) => sum + p.byteLength, 0 );
	const end = new DataView( new ArrayBuffer( 22 ) );
	end.setUint32( 0, 0x06054b50, true );
	end.setUint16( 8, files.length, true );
	end.setUint16( 10, files.length, true );
	end.setUint32( 12, centralSize, true );
	end.setUint32( 16, offset, true );

	return new Blob( [ ...parts, ...central, end.buffer ], {
		type: 'application/zip',
	} );
}
