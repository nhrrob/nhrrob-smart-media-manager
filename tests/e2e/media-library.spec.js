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
			.locator( '.smm-modal input[type="file"]' )
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
} );
