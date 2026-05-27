import { useState, useCallback } from '@wordpress/element';

const cfg = window.nhrsmmSettingsConfig || {};

const TABS = [
	{ slug: 'general', label: 'General',  icon: 'ti-layout' },
	{ slug: 'ai',      label: 'AI',       icon: 'ti-sparkles' },
	{ slug: 'license', label: 'License',  icon: 'ti-crown' },
];

export default function SettingsApp() {
	const urlTab    = new URLSearchParams( window.location.search ).get( 'tab' ) || 'general';
	const [ tab,        setTab        ] = useState( urlTab );
	const [ settings,   setSettings   ] = useState( cfg.settings || { default_view: 'grid', thumbnail_size: 'medium', items_per_page: 40 } );
	const [ saving,     setSaving     ] = useState( false );
	const [ saveStatus, setSaveStatus ] = useState( null ); // null | 'saved' | 'error'

	function switchTab( slug ) {
		setTab( slug );
		setSaveStatus( null );
		const url = new URL( window.location.href );
		url.searchParams.set( 'tab', slug );
		window.history.replaceState( {}, '', url.toString() );
	}

	const save = useCallback( async () => {
		setSaving( true );
		setSaveStatus( null );
		try {
			const res = await fetch( cfg.restUrl + '/settings', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
				credentials: 'same-origin',
				body: JSON.stringify( settings ),
			} );
			if ( ! res.ok ) throw new Error( 'Save failed' );
			const saved = await res.json();
			setSettings( saved );
			setSaveStatus( 'saved' );
			setTimeout( () => setSaveStatus( null ), 3000 );
		} catch {
			setSaveStatus( 'error' );
		} finally {
			setSaving( false );
		}
	}, [ settings ] );

	return (
		<div className="nhrsmm nhrsmm-settings">
			<div className="settings-shell">

				{/* Topbar */}
				<div className="settings-topbar">
					<div className="smm-logo">
						<div className="smm-logo-icon">
							<i className="ti ti-stack-2" />
						</div>
						<span className="smm-logo-name">NHR <span>Smart Media</span></span>
					</div>
					<span className="settings-topbar-title">Settings</span>
					<a href={ cfg.mediaLibraryUrl } className="btn btn-sm btn-ghost-white">
						<i className="ti ti-photo" /> Open Media Library
					</a>
				</div>

				<div className="settings-body">

					{/* Sidebar nav */}
					<nav className="settings-nav">
						{ TABS.map( t => (
							<button
								key={ t.slug }
								className={ `settings-nav-item${ tab === t.slug ? ' active' : '' }` }
								onClick={ () => switchTab( t.slug ) }
							>
								<i className={ `ti ${ t.icon }` } />
								{ t.label }
							</button>
						) ) }
					</nav>

					{/* Content */}
					<div className="settings-content">

						{ saveStatus === 'saved' && (
							<div className="smm-notice smm-notice-success">
								<i className="ti ti-circle-check" /> Settings saved.
							</div>
						) }
						{ saveStatus === 'error' && (
							<div className="smm-notice smm-notice-danger">
								<i className="ti ti-alert-circle" /> Could not save settings. Please try again.
							</div>
						) }

						{ tab === 'general' && (
							<GeneralTab settings={ settings } onChange={ setSettings } onSave={ save } saving={ saving } />
						) }
						{ tab === 'ai' && <AiTab /> }
						{ tab === 'license' && <LicenseTab /> }

					</div>
				</div>
			</div>
		</div>
	);
}

/* ── General tab ─────────────────────────────────────────────── */
function GeneralTab( { settings, onChange, onSave, saving } ) {
	function set( key, value ) {
		onChange( prev => ( { ...prev, [ key ]: value } ) );
	}

	return (
		<>
			<div className="settings-section">
				<h2 className="settings-section-title">
					<i className="ti ti-layout" /> General
				</h2>

				<div className="settings-row">
					<div className="settings-row-info">
						<label className="settings-row-label">Default View</label>
						<p className="settings-row-desc">How files are displayed when you open the media library.</p>
					</div>
					<div className="settings-row-control">
						{ [ [ 'grid', 'ti-layout-grid', 'Grid' ], [ 'list', 'ti-list', 'List' ] ].map( ( [ val, icon, lbl ] ) => (
							<label key={ val } className="smm-radio-label">
								<input
									type="radio"
									name="default_view"
									value={ val }
									checked={ settings.default_view === val }
									onChange={ () => set( 'default_view', val ) }
								/>
								<i className={ `ti ${ icon }` } /> { lbl }
							</label>
						) ) }
					</div>
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						<label className="settings-row-label">Default Thumbnail Size</label>
						<p className="settings-row-desc">Default thumbnail size in the grid view.</p>
					</div>
					<div className="settings-row-control">
						{ [ [ 'small', 'Small' ], [ 'medium', 'Medium' ], [ 'large', 'Large' ] ].map( ( [ val, lbl ] ) => (
							<label key={ val } className="smm-radio-label">
								<input
									type="radio"
									name="thumbnail_size"
									value={ val }
									checked={ settings.thumbnail_size === val }
									onChange={ () => set( 'thumbnail_size', val ) }
								/>
								{ lbl }
							</label>
						) ) }
					</div>
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						<label className="settings-row-label">Items Per Page</label>
						<p className="settings-row-desc">Number of files loaded per page.</p>
					</div>
					<div className="settings-row-control">
						<select
							className="smm-select"
							value={ settings.items_per_page }
							onChange={ e => set( 'items_per_page', parseInt( e.target.value ) ) }
						>
							{ [ 20, 40, 60, 100 ].map( n => (
								<option key={ n } value={ n }>{ n }</option>
							) ) }
						</select>
					</div>
				</div>
			</div>

			<div className="settings-footer">
				<button
					className="btn btn-primary"
					onClick={ onSave }
					disabled={ saving }
				>
					{ saving ? (
						<><span className="smm-spinner-sm" /> Saving…</>
					) : (
						<><i className="ti ti-device-floppy" /> Save Settings</>
					) }
				</button>
			</div>
		</>
	);
}

/* ── AI tab ──────────────────────────────────────────────────── */
function AiTab() {
	const aiConfigured = cfg.aiConfigured;
	const connectorsUrl = cfg.connectorsUrl || '';

	return (
		<div className="settings-section">
			<h2 className="settings-section-title">
				<i className="ti ti-sparkles" /> AI
			</h2>

			<div className="smm-notice smm-notice-info">
				<i className="ti ti-info-circle" />
				<div>
					<strong>AI powered by WordPress Core</strong><br />
					AI alt text uses the WordPress AI Client introduced in WordPress 7.0. Configure your AI provider once in{ ' ' }
					<a href={ connectorsUrl }>Settings → Connectors</a>{ ' ' }
					and it will be available to all compatible plugins automatically.
				</div>
			</div>

			{ aiConfigured ? (
				<div className="smm-notice smm-notice-success">
					<i className="ti ti-circle-check" /> AI provider is configured and ready.
				</div>
			) : (
				<div className="smm-notice smm-notice-warning">
					<i className="ti ti-alert-triangle" />
					No AI provider configured. Visit{ ' ' }
					<a href={ connectorsUrl }>Settings → Connectors</a>{ ' ' }
					to connect an AI provider.
				</div>
			) }
		</div>
	);
}

/* ── License tab ─────────────────────────────────────────────── */
function LicenseTab() {
	return (
		<div className="settings-section">
			<h2 className="settings-section-title">
				<i className="ti ti-crown" /> Pro License
			</h2>

			<div className="pro-upgrade-card">
				<div className="pro-upgrade-icon">
					<i className="ti ti-crown" />
				</div>
				<h3>Unlock Pro Features</h3>
				<p>Upgrade to NHR Smart Media Manager Pro to unlock bulk AI processing, cloud storage offload, duplicate detection, unused media finder, role-based access, and more.</p>
				<ul className="pro-feature-list">
					{ [
						'Bulk AI alt text & auto-tagging',
						'Cloud storage (S3, R2, GCS)',
						'Duplicate media detector',
						'Unused media finder & cleanup',
						'Role-based folder access',
						'Bulk image compression',
						'Media audit CSV export',
					].map( feature => (
						<li key={ feature }><i className="ti ti-check" /> { feature }</li>
					) ) }
				</ul>
				<a
					href="https://profiles.wordpress.org/nhrrob/"
					target="_blank"
					rel="noopener noreferrer"
					className="btn btn-primary"
				>
					<i className="ti ti-arrow-right" /> Learn More About Pro
				</a>
			</div>
		</div>
	);
}
