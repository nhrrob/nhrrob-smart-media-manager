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
	await page.fill( '#user_login', WP_ADMIN_USER );
	await page.fill( '#user_pass', WP_ADMIN_PASS );
	await page.click( '#wp-submit' );
	await page.waitForURL( '**/wp-admin/**' );
}

module.exports = { loginAsAdmin };
