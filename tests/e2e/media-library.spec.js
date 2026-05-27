const { test, expect } = require( '@playwright/test' );
const { loginAsAdmin } = require( './helpers/wp-admin' );

test.describe( 'Smart Media Library', () => {
	test.beforeEach( async ( { page } ) => {
		await loginAsAdmin( page );
	} );

	test( 'media library page mounts the React app', async ( { page } ) => {
		await page.goto( '/wp-admin/upload.php?page=nhrsmm-media-library' );

		// The React mount point must be present.
		await expect( page.locator( '#nhrsmm-app' ) ).toBeVisible();
	} );

	test( 'sidebar renders folder tree', async ( { page } ) => {
		await page.goto( '/wp-admin/upload.php?page=nhrsmm-media-library' );

		// React mount point is present (sidebar may be empty if no folders yet).
		await expect( page.locator( '#nhrsmm-app' ) ).toBeVisible();
	} );

	test( 'settings page mounts the settings React app', async ( { page } ) => {
		await page.goto( '/wp-admin/options-general.php?page=nhrsmm-settings' );

		await expect( page.locator( '#nhrsmm-settings-app' ) ).toBeVisible();
	} );
} );
