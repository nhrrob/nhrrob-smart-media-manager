const { test, expect } = require( '@playwright/test' );
const path = require( 'path' );
const { loginAsAdmin } = require( './helpers/wp-admin' );

const LIBRARY_URL = '/wp-admin/upload.php?page=nhrsmm-media-library';
const FIXTURE_PNG = path.join( __dirname, 'fixtures/test.png' );

// Waits for /\d+ file/ — skips the transient "0 files" shown before the first useEffect fires.
async function waitForGridLoaded( page ) {
	await expect( page.locator( '.status-count' ) ).toHaveText( /\d+ file/, {
		timeout: 15000,
	} );
}

async function gotoLibrary( page ) {
	await page.goto( LIBRARY_URL );
	await page.locator( '.smm-sidebar' ).waitFor( { timeout: 10000 } );
	await waitForGridLoaded( page );
}

async function clickNav( page, text ) {
	await page.locator( '.nav-item' ).filter( { hasText: text } ).click();
	await waitForGridLoaded( page );
}

// Creates a folder and uploads generated PNGs into it through the same endpoints the app uses.
// Must be called on the Smart Library page (needs window.nhrsmmConfig).
async function seed( page, { files = 1 } = {} ) {
	return page.evaluate(
		async ( { count, stamp } ) => {
			const cfg = window.nhrsmmConfig;
			const api = ( method, route, body ) =>
				fetch( cfg.restUrl + route, {
					method,
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': cfg.nonce,
					},
					credentials: 'same-origin',
					body: body ? JSON.stringify( body ) : undefined,
				} ).then( ( r ) => r.json() );

			const folderName = `e2e-folder-${ stamp }`;
			const folder = await api( 'POST', '/folders', {
				name: folderName,
			} );

			const ids = [];
			const names = [];
			for ( let i = 0; i < count; i++ ) {
				const canvas = document.createElement( 'canvas' );
				canvas.width = 120;
				canvas.height = 80;
				canvas.getContext( '2d' ).fillRect( 0, 0, 120, 80 );
				const blob = await new Promise( ( resolve ) =>
					canvas.toBlob( resolve, 'image/png' )
				);
				const name = `e2e-${ stamp }-${ i }.png`;
				const form = new FormData();
				form.append( 'async-upload', new File( [ blob ], name ) );
				form.append( 'action', 'upload-attachment' );
				form.append( '_wpnonce', cfg.mediaUploadNonce );
				form.append( 'nhrsmm_folder', folder.id );
				const res = await fetch( cfg.adminUrl + 'async-upload.php', {
					method: 'POST',
					body: form,
					credentials: 'same-origin',
				} ).then( ( r ) => r.json() );
				ids.push( res.data.id );
				names.push( name );
			}
			return { folderId: folder.id, folderName, ids, names };
		},
		{ count: files, stamp: Date.now() }
	);
}

// Permanently removes seeded files and their folder.
async function cleanup( page, { folderId, ids } ) {
	await page.goto( LIBRARY_URL );
	await page.waitForFunction( () => window.nhrsmmConfig );
	await page.evaluate(
		async ( { folder, attachments } ) => {
			const cfg = window.nhrsmmConfig;
			const call = ( method, route, body ) =>
				fetch( cfg.restUrl + route, {
					method,
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': cfg.nonce,
					},
					credentials: 'same-origin',
					body: body ? JSON.stringify( body ) : undefined,
				} );
			await call( 'DELETE', '/media/bulk-delete', {
				ids: attachments,
				force: true,
			} );
			await call( 'DELETE', `/folders/${ folder }` );
		},
		{ folder: folderId, attachments: ids }
	);
}

test.describe( 'Smart Media Library', () => {
	test.beforeEach( async ( { page } ) => {
		await loginAsAdmin( page );
	} );

	test( 'media library page mounts the React app', async ( { page } ) => {
		await page.goto( LIBRARY_URL );
		await expect( page.locator( '#nhrsmm-app' ) ).toBeVisible();
	} );

	test( 'settings page mounts the settings React app', async ( { page } ) => {
		await page.goto( '/wp-admin/options-general.php?page=nhrsmm-settings' );
		await expect( page.locator( '#nhrsmm-settings-app' ) ).toBeVisible();
	} );

	test( 'uploading a file adds it to the grid', async ( { page } ) => {
		await gotoLibrary( page );
		await clickNav( page, 'All Files' );

		const countBefore = await page.locator( '.smm-media-card' ).count();

		await page
			.locator( 'button.btn-primary' )
			.filter( { hasText: 'Upload' } )
			.click();
		await expect( page.locator( '.smm-modal-overlay' ) ).toBeVisible();

		await page
			.locator( '.smm-modal input[type="file"][multiple]' )
			.setInputFiles( FIXTURE_PNG );

		await expect(
			page.locator( '.upload-item-status.success' )
		).toBeVisible( { timeout: 15000 } );

		await page
			.locator( '.modal-footer button' )
			.filter( { hasText: 'Done' } )
			.click();
		await waitForGridLoaded( page );

		await expect( page.locator( '.smm-media-card' ) ).toHaveCount(
			countBefore + 1,
			{ timeout: 8000 }
		);
	} );

	test( 'navigating Recent then All Files shows the full grid', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		await clickNav( page, 'All Files' );

		const cards = page.locator( '.smm-media-card' );
		const countBefore = await cards.count();
		if ( countBefore === 0 ) {
			test.skip( true, 'No files in library — run upload test first' );
			return;
		}

		await cards.first().click();
		await expect( page.locator( '.smm-details' ) ).toBeVisible( {
			timeout: 5000,
		} );

		await clickNav( page, 'Recent' );
		const recentCount = await page.locator( '.smm-media-card' ).count();
		expect( recentCount ).toBeGreaterThan( 0 );

		// Regression: Recent response previously overwrote pagination.perPage with 1, capping All Files to 1 item.
		await clickNav( page, 'All Files' );
		await expect( page.locator( '.smm-media-card' ) ).toHaveCount(
			countBefore,
			{ timeout: 8000 }
		);
	} );

	test( 'moving a folder into its own descendant is rejected via the REST API', async ( {
		page,
	} ) => {
		await gotoLibrary( page );

		const stamp = Date.now();

		// Run all REST calls inside the browser via page.evaluate so they share
		// the page's authenticated session and credentials: 'same-origin' nonce auth.
		const result = await page.evaluate(
			async ( { parentName, childName } ) => {
				const { restUrl, nonce } = window.nhrsmmConfig;
				const buildUrl = ( urlPath ) => {
					if ( ! restUrl.includes( 'rest_route=' ) ) {
						return restUrl + urlPath;
					}
					const [ route ] = urlPath.split( '?' );
					return restUrl + route;
				};
				const apiFetch = async ( method, urlPath, body = null ) => {
					const res = await fetch( buildUrl( urlPath ), {
						method,
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': nonce,
						},
						credentials: 'same-origin',
						body: body ? JSON.stringify( body ) : undefined,
					} );
					const data = await res.json().catch( () => null );
					return { ok: res.ok, data };
				};

				const { ok: parentOk, data: parent } = await apiFetch(
					'POST',
					'/folders',
					{ name: parentName }
				);
				if ( ! parentOk ) {
					return {
						error: `create parent failed: ${ parent?.message }`,
					};
				}

				const { ok: childOk, data: child } = await apiFetch(
					'POST',
					'/folders',
					{ name: childName, parent: parent.id }
				);
				if ( ! childOk ) {
					return {
						error: `create child failed: ${ child?.message }`,
					};
				}

				const { ok: moveOk, data: moveData } = await apiFetch(
					'POST',
					`/folders/${ parent.id }/move`,
					{ parent: child.id }
				);

				// Cleanup: deleting parent cascades to child.
				await apiFetch( 'DELETE', `/folders/${ parent.id }` );

				return { moveOk, moveCode: moveData?.code };
			},
			{
				parentName: `e2e-parent-${ stamp }`,
				childName: `e2e-child-${ stamp }`,
			}
		);

		expect( result.error ).toBeUndefined();
		expect( result.moveOk ).toBe( false );
		expect( result.moveCode ).toBe( 'circular_parent' );
	} );

	test( 'creating a folder adds it to the sidebar', async ( { page } ) => {
		await gotoLibrary( page );

		const folderName = `test-${ Date.now() }`;
		const countBefore = await page
			.locator( '#smm-folder-tree .folder-item' )
			.count();

		await page.locator( 'button[title="New folder"]' ).click();

		const input = page.locator( '.folder-rename-input' );
		await input.waitFor( { timeout: 3000 } );
		await input.fill( folderName );
		await input.press( 'Enter' );

		await expect(
			page.locator( '#smm-folder-tree .folder-item' )
		).toHaveCount( countBefore + 1, { timeout: 8000 } );

		await expect(
			page
				.locator( '#smm-folder-tree .folder-name' )
				.filter( { hasText: folderName } )
		).toBeVisible();
	} );

	test( 'a file uploaded into a folder shows up in that folder', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page );

		await page.goto( `${ LIBRARY_URL }&folder=${ data.folderId }` );
		await waitForGridLoaded( page );

		await expect( page.locator( '.smm-media-card' ) ).toHaveCount( 1 );
		await expect( page.locator( '.breadcrumb-current' ) ).toHaveText(
			data.folderName
		);

		await cleanup( page, data );
	} );

	test( 'deleting a file moves it to the Trash and it can be restored', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page );

		await page.goto( `${ LIBRARY_URL }&folder=${ data.folderId }` );
		await waitForGridLoaded( page );
		await page.locator( '.smm-media-card' ).first().click();
		await page
			.locator( '.details-actions button' )
			.filter( { hasText: 'Move to Trash' } )
			.click();
		await page.locator( '.btn-danger-solid' ).click();
		await expect( page.locator( '.smm-media-card' ) ).toHaveCount( 0 );

		await clickNav( page, 'Trash' );
		const trashed = page
			.locator( '.smm-media-card' )
			.filter( { hasText: data.names[ 0 ] } );
		await expect( trashed ).toBeVisible();

		await trashed.click();
		await page
			.locator( '.details-actions button' )
			.filter( { hasText: 'Restore' } )
			.click();
		await expect( trashed ).toHaveCount( 0 );

		await page.goto( `${ LIBRARY_URL }&folder=${ data.folderId }` );
		await waitForGridLoaded( page );
		await expect( page.locator( '.smm-media-card' ) ).toHaveCount( 1 );

		await cleanup( page, data );
	} );

	test( 'bulk edit applies a caption to every selected file', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page, { files: 2 } );

		await page.goto( `${ LIBRARY_URL }&folder=${ data.folderId }` );
		await waitForGridLoaded( page );
		await expect( page.locator( '.smm-media-card' ) ).toHaveCount( 2 );
		await page.locator( '.smm-toolbar .smm-checkbox' ).click();

		const bar = page.locator( '.smm-bulk-bar' );
		await expect( bar ).toBeInViewport();
		await bar.locator( 'button' ).filter( { hasText: 'Edit' } ).click();

		await page
			.locator( '.tool-field' )
			.filter( { hasText: 'Caption' } )
			.locator( 'input' )
			.fill( 'Shared caption' );
		await page
			.locator( '.modal-footer button' )
			.filter( { hasText: 'Apply' } )
			.click();
		await expect( page.locator( '.smm-modal' ) ).toHaveCount( 0 );

		const captions = await page.evaluate( async ( ids ) => {
			const cfg = window.nhrsmmConfig;
			return Promise.all(
				ids.map( ( id ) =>
					fetch( `${ cfg.restUrl }/media/${ id }`, {
						headers: { 'X-WP-Nonce': cfg.nonce },
						credentials: 'same-origin',
					} )
						.then( ( r ) => r.json() )
						.then( ( file ) => file.caption )
				)
			);
		}, data.ids );
		expect( captions ).toEqual( [ 'Shared caption', 'Shared caption' ] );

		await cleanup( page, data );
	} );

	test( 'the Missing alt text view lists a new image without alt text', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page );

		await page.reload();
		await waitForGridLoaded( page );
		await clickNav( page, 'Missing alt text' );
		await expect(
			page
				.locator( '.smm-media-card' )
				.filter( { hasText: data.names[ 0 ] } )
		).toBeVisible();

		await cleanup( page, data );
	} );

	test( 'the media modal has a folder tree that filters attachments', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page );

		await page.goto( '/wp-admin/upload.php?mode=grid' );
		await page.waitForFunction(
			() => window.wp?.media && window.nhrsmmModal
		);
		await page.evaluate( () => window.wp.media( { title: 'e2e' } ).open() );

		// On this screen the modal opens on its Upload tab.
		await page.locator( '.media-modal #menu-item-browse' ).click();

		const tree = page.locator( '.media-modal .nhrsmm-tree' );
		await expect( tree ).toBeVisible();
		await tree
			.locator( 'button' )
			.filter( { hasText: data.folderName } )
			.click();
		await expect(
			page.locator( '.media-modal .attachments .attachment' )
		).toHaveCount( 1 );

		await cleanup( page, data );
	} );

	test( 'the Media Library list view can be filtered by folder', async ( {
		page,
	} ) => {
		await gotoLibrary( page );
		const data = await seed( page, { files: 2 } );

		await page.goto(
			`/wp-admin/upload.php?mode=list&nhrsmm_folder=${ data.folderId }`
		);
		await expect( page.locator( '#the-list tr' ) ).toHaveCount( 2 );
		await expect( page.locator( '#nhrsmm-folder-filter' ) ).toHaveValue(
			String( data.folderId )
		);

		await cleanup( page, data );
	} );
} );
