import { useState, useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

const cfg = window.nhrsmmSettingsConfig || {};

const TABS = [
	{
		slug: 'general',
		label: __( 'General', 'nhrrob-smart-media-manager' ),
		icon: 'ti-adjustments-horizontal',
	},
	{
		slug: 'ai',
		label: __( 'AI', 'nhrrob-smart-media-manager' ),
		icon: 'ti-sparkles',
	},
];

export default function SettingsApp() {
	const urlTab =
		new URLSearchParams( window.location.search ).get( 'tab' ) || 'general';
	const [ tab, setTab ] = useState( urlTab );
	const [ settings, setSettings ] = useState(
		cfg.settings || {
			default_view: 'grid',
			thumbnail_size: 'medium',
			items_per_page: 40,
		}
	);
	const [ saving, setSaving ] = useState( false );
	const [ saveStatus, setSaveStatus ] = useState( null );

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
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': cfg.nonce,
				},
				credentials: 'same-origin',
				body: JSON.stringify( settings ),
			} );
			if ( ! res.ok ) {
				throw new Error( 'Save failed' );
			}
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
				<div className="settings-header">
					<div className="settings-brand">
						<div className="settings-brand-icon">
							<i className="ti ti-stack-2" />
						</div>
						<span className="settings-brand-name">
							Smart Media Manager
						</span>
					</div>

					<div className="settings-header-sep" />

					<div className="settings-tabs">
						{ TABS.map( ( t ) => (
							<button
								key={ t.slug }
								className={ `settings-tab${
									tab === t.slug ? ' active' : ''
								}` }
								onClick={ () => switchTab( t.slug ) }
							>
								<i className={ `ti ${ t.icon }` } />
								{ t.label }
							</button>
						) ) }
					</div>

					<div className="topbar-spacer" />

					<a
						href={ cfg.mediaLibraryUrl }
						className="btn btn-sm btn-default"
					>
						<i className="ti ti-photo" />{ ' ' }
						{ __( 'Media Library', 'nhrrob-smart-media-manager' ) }
					</a>
				</div>

				<div className="settings-content">
					{ saveStatus === 'saved' && (
						<div className="smm-notice smm-notice-success settings-notice-top">
							<i className="ti ti-circle-check" />{ ' ' }
							{ __(
								'Settings saved successfully.',
								'nhrrob-smart-media-manager'
							) }
						</div>
					) }
					{ saveStatus === 'error' && (
						<div className="smm-notice smm-notice-danger settings-notice-top">
							<i className="ti ti-alert-circle" />{ ' ' }
							{ __(
								'Could not save settings. Please try again.',
								'nhrrob-smart-media-manager'
							) }
						</div>
					) }

					<div className="settings-layout">
						<div className="settings-main">
							{ tab === 'general' && (
								<GeneralTab
									settings={ settings }
									onChange={ setSettings }
									onSave={ save }
									saving={ saving }
								/>
							) }
							{ tab === 'ai' && <AiTab /> }
						</div>

						<aside className="settings-aside">
							<QuickLinksWidget />
							<AboutWidget />
							<AiStatusWidget />
						</aside>
					</div>
				</div>
			</div>
		</div>
	);
}

function QuickLinksWidget() {
	return (
		<div className="widget-card">
			<div className="widget-card-head">
				<i className="ti ti-bolt" />{ ' ' }
				{ __( 'Quick Links', 'nhrrob-smart-media-manager' ) }
			</div>
			<div className="widget-links">
				<a href={ cfg.mediaLibraryUrl } className="widget-link">
					<i className="ti ti-photo" />{ ' ' }
					{ __( 'Media Library', 'nhrrob-smart-media-manager' ) }
				</a>
				<a href={ cfg.wpMediaUrl } className="widget-link">
					<i className="ti ti-layout-grid" />{ ' ' }
					{ __( 'WP Media', 'nhrrob-smart-media-manager' ) }
				</a>
				<a href={ cfg.connectorsUrl } className="widget-link">
					<i className="ti ti-plug" />{ ' ' }
					{ __( 'AI Connectors', 'nhrrob-smart-media-manager' ) }
				</a>
				<a
					href="https://wordpress.org/plugins/nhrrob-smart-media-manager/"
					target="_blank"
					rel="noopener noreferrer"
					className="widget-link"
				>
					<i className="ti ti-star" />{ ' ' }
					{ __( 'Rate Plugin', 'nhrrob-smart-media-manager' ) }
				</a>
			</div>
		</div>
	);
}

function AboutWidget() {
	return (
		<div className="widget-card">
			<div className="widget-card-head">
				<i className="ti ti-info-circle" />{ ' ' }
				{ __( 'About', 'nhrrob-smart-media-manager' ) }
			</div>
			<div className="widget-body">
				<div className="widget-version-badge">
					<i className="ti ti-tag" /> v{ cfg.version || '1.0.0' }
				</div>
				<div className="widget-meta-line">
					{ __(
						'Smart Media Manager by',
						'nhrrob-smart-media-manager'
					) }{ ' ' }
					<a
						href="https://profiles.wordpress.org/nhrrob/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Nazmul Hasan Robin
					</a>
					.<br />
					{ __(
						'Available on',
						'nhrrob-smart-media-manager'
					) }{ ' ' }
					<a
						href="https://wordpress.org/plugins/nhrrob-smart-media-manager/"
						target="_blank"
						rel="noopener noreferrer"
					>
						WordPress.org
					</a>
					.
				</div>
			</div>
		</div>
	);
}

function AiStatusWidget() {
	const ready = cfg.aiConfigured;
	return (
		<div className="widget-card">
			<div className="widget-card-head">
				<i className="ti ti-sparkles" />{ ' ' }
				{ __( 'AI Status', 'nhrrob-smart-media-manager' ) }
			</div>
			<div className="widget-ai-status">
				<span
					className={ `widget-ai-dot ${
						ready ? 'ready' : 'missing'
					}` }
				/>
				<span
					style={ {
						color: ready
							? 'var(--color-success)'
							: 'var(--color-warning)',
						fontWeight: 500,
						fontSize: 'var(--text-xs)',
					} }
				>
					{ ready
						? __( 'Provider ready', 'nhrrob-smart-media-manager' )
						: __( 'Not configured', 'nhrrob-smart-media-manager' ) }
				</span>
			</div>
			{ ! ready && (
				<div
					style={ {
						padding: '0 var(--sp-14) var(--sp-10)',
						fontSize: 'var(--text-xs)',
						color: 'var(--gray-400)',
						lineHeight: 1.5,
					} }
				>
					{ __(
						'Configure an AI provider in',
						'nhrrob-smart-media-manager'
					) }{ ' ' }
					<a
						href={ cfg.connectorsUrl }
						style={ { color: 'var(--ai-from)' } }
					>
						{ __(
							'Settings → Connectors',
							'nhrrob-smart-media-manager'
						) }
					</a>
					.
				</div>
			) }
		</div>
	);
}

function GeneralTab( { settings, onChange, onSave, saving } ) {
	function set( key, value ) {
		onChange( ( prev ) => ( { ...prev, [ key ]: value } ) );
	}

	const viewOptions = [
		[
			'grid',
			'ti-layout-grid',
			__( 'Grid', 'nhrrob-smart-media-manager' ),
		],
		[ 'list', 'ti-list', __( 'List', 'nhrrob-smart-media-manager' ) ],
	];

	const sizeOptions = [
		[ 'small', __( 'Small', 'nhrrob-smart-media-manager' ) ],
		[ 'medium', __( 'Medium', 'nhrrob-smart-media-manager' ) ],
		[ 'large', __( 'Large', 'nhrrob-smart-media-manager' ) ],
	];

	return (
		<>
			<div className="settings-card">
				<div className="settings-card-head">
					<i className="ti ti-photo" />{ ' ' }
					{ __( 'Media Library', 'nhrrob-smart-media-manager' ) }
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="settings-row-label">
							{ __(
								'Default View',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<p className="settings-row-desc">
							{ __(
								'How files are displayed when you open the media library.',
								'nhrrob-smart-media-manager'
							) }
						</p>
					</div>
					<div className="settings-row-control">
						<div className="smm-radio-group">
							{ viewOptions.map( ( [ val, icon, lbl ] ) => (
								// eslint-disable-next-line jsx-a11y/label-has-associated-control
								<label key={ val } className="smm-radio-label">
									<input
										type="radio"
										name="default_view"
										value={ val }
										checked={
											settings.default_view === val
										}
										onChange={ () =>
											set( 'default_view', val )
										}
									/>
									<i className={ `ti ${ icon }` } />
									{ lbl }
								</label>
							) ) }
						</div>
					</div>
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="settings-row-label">
							{ __(
								'Thumbnail Size',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<p className="settings-row-desc">
							{ __(
								'Default thumbnail size in grid view.',
								'nhrrob-smart-media-manager'
							) }
						</p>
					</div>
					<div className="settings-row-control">
						<div className="smm-radio-group">
							{ sizeOptions.map( ( [ val, lbl ] ) => (
								// eslint-disable-next-line jsx-a11y/label-has-associated-control
								<label key={ val } className="smm-radio-label">
									<input
										type="radio"
										name="thumbnail_size"
										value={ val }
										checked={
											settings.thumbnail_size === val
										}
										onChange={ () =>
											set( 'thumbnail_size', val )
										}
									/>
									{ lbl }
								</label>
							) ) }
						</div>
					</div>
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="settings-row-label">
							{ __(
								'Items Per Page',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<p className="settings-row-desc">
							{ __(
								'Number of files loaded per page.',
								'nhrrob-smart-media-manager'
							) }
						</p>
					</div>
					<div className="settings-row-control">
						<select
							className="smm-select"
							value={ settings.items_per_page }
							onChange={ ( e ) =>
								set(
									'items_per_page',
									parseInt( e.target.value )
								)
							}
						>
							{ [ 20, 40, 60, 100 ].map( ( n ) => (
								<option key={ n } value={ n }>
									{ sprintf(
										// translators: %d: number of items per page
										__(
											'%d items',
											'nhrrob-smart-media-manager'
										),
										n
									) }
								</option>
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
						<>
							<span className="smm-spinner-sm" />{ ' ' }
							{ __( 'Saving…', 'nhrrob-smart-media-manager' ) }
						</>
					) : (
						<>
							<i className="ti ti-device-floppy" />{ ' ' }
							{ __(
								'Save Settings',
								'nhrrob-smart-media-manager'
							) }
						</>
					) }
				</button>
			</div>
		</>
	);
}

function AiTab() {
	const aiConfigured = cfg.aiConfigured;
	const connectorsUrl = cfg.connectorsUrl || '';

	return (
		<>
			<div className="settings-card">
				<div className="settings-card-head">
					<i className="ti ti-sparkles" />{ ' ' }
					{ __( 'AI Configuration', 'nhrrob-smart-media-manager' ) }
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="settings-row-label">
							{ __(
								'WordPress Core AI',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<p className="settings-row-desc">
							{ __(
								'Alt text generation uses the WordPress AI Client (WP 7.0+). Configure your provider once in',
								'nhrrob-smart-media-manager'
							) }{ ' ' }
							<a href={ connectorsUrl }>
								{ __(
									'Settings → Connectors',
									'nhrrob-smart-media-manager'
								) }
							</a>{ ' ' }
							{ __(
								'and it is available to all compatible plugins.',
								'nhrrob-smart-media-manager'
							) }
						</p>
					</div>
				</div>

				<div className="settings-row">
					<div className="settings-row-info">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="settings-row-label">
							{ __(
								'Provider Status',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<p className="settings-row-desc">
							{ aiConfigured
								? __(
										'Your AI provider is connected and ready.',
										'nhrrob-smart-media-manager'
								  )
								: __(
										'No AI provider configured yet.',
										'nhrrob-smart-media-manager'
								  ) }
						</p>
					</div>
					<div className="settings-row-control">
						{ aiConfigured ? (
							<span
								className="smm-notice smm-notice-success"
								style={ { padding: '4px 12px' } }
							>
								<i className="ti ti-circle-check" />{ ' ' }
								{ __( 'Ready', 'nhrrob-smart-media-manager' ) }
							</span>
						) : (
							<a
								href={ connectorsUrl }
								className="btn btn-sm btn-default"
							>
								<i className="ti ti-plug" />{ ' ' }
								{ __(
									'Configure',
									'nhrrob-smart-media-manager'
								) }
							</a>
						) }
					</div>
				</div>
			</div>
		</>
	);
}
