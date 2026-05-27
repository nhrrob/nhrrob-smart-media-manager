/**
 * Shared helper: log into wp-env WordPress admin.
 * Default wp-env credentials: admin / password
 */

const WP_ADMIN_USER = process.env.WP_ADMIN_USER ?? 'admin';
const WP_ADMIN_PASS = process.env.WP_ADMIN_PASS ?? 'password';

/**
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin( page ) {
	await page.goto( '/wp-login.php' );
	await page.waitForSelector( '#loginform' );
	// Set credentials and submit in one synchronous JS call so browser
	// autofill cannot overwrite the fields between fill and submit.
	await page.evaluate(
		( { user, pass } ) => {
			document.getElementById( 'user_login' ).value = user;
			document.getElementById( 'user_pass' ).value = pass;
			document.getElementById( 'wp-submit' ).click();
		},
		{ user: WP_ADMIN_USER, pass: WP_ADMIN_PASS }
	);
	await page.waitForURL( '**/wp-admin/**' );
}

module.exports = { loginAsAdmin };
