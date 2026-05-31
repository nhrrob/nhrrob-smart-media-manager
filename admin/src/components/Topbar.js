import { useCallback, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { setUrlParams } from '../utils';

const cfg = window.nhrsmmConfig || {};

export default function Topbar() {
	const { dispatch, loadMedia, showToast } = useApp();
	const searchRef = useRef( null );
	const debounceRef = useRef( null );
	const [ aiOpen, setAiOpen ] = useState( false );

	const onSearchInput = useCallback( () => {
		const val = searchRef.current.value;
		clearTimeout( debounceRef.current );
		debounceRef.current = setTimeout( () => {
			dispatch( { type: 'SET_SEARCH', search: val } );
			setUrlParams( { q: val || null, page: null } );
			loadMedia( { search: val } );
		}, 350 );
	}, [ dispatch, loadMedia ] );

	function onAiClick( e ) {
		e.stopPropagation();
		if ( ! cfg.aiConfigured ) {
			showToast(
				__(
					'No AI provider configured. Go to Settings → Connectors.',
					'nhrrob-smart-media-manager'
				),
				'warning'
			);
			return;
		}
		setAiOpen( ( v ) => ! v );
	}

	return (
		<div className="smm-topbar">
			<div className="smm-logo">
				<div className="smm-logo-icon">
					<i className="ti ti-stack-2" />
				</div>
				<span className="smm-logo-name">Smart Media Manager</span>
			</div>

			<div className="topbar-search">
				<i className="ti ti-search" />
				<input
					ref={ searchRef }
					type="text"
					placeholder={ __(
						'Search files…',
						'nhrrob-smart-media-manager'
					) }
					autoComplete="off"
					onInput={ onSearchInput }
				/>
			</div>

			<div className="topbar-actions">
				<div style={ { position: 'relative' } }>
					<button
						className="btn btn-sm btn-ai"
						id="smm-ai-btn"
						onClick={ onAiClick }
					>
						<i className="ti ti-sparkles" />
						{ __( 'AI Tools', 'nhrrob-smart-media-manager' ) }
					</button>
					{ aiOpen && (
						<div
							className="smm-dropdown ai-tools-dropdown"
							id="smm-ai-dropdown"
							style={ {
								display: 'block',
								right: 0,
								minWidth: '220px',
							} }
						>
							<div className="ai-tools-header">
								<i className="ti ti-sparkles" />
								{ sprintf(
									// translators: %s: AI provider name
									__(
										'%s Connected',
										'nhrrob-smart-media-manager'
									),
									cfg.aiProvider ||
										__( 'AI', 'nhrrob-smart-media-manager' )
								) }
							</div>
							<div className="smm-dropdown-section">
								<p className="ai-tools-hint">
									{ __(
										'Select a file and use the details panel to generate alt text or captions with AI.',
										'nhrrob-smart-media-manager'
									) }
								</p>
							</div>
							<div className="smm-dropdown-section ai-tools-links">
								<a
									href={ cfg.connectorsUrl }
									className="smm-dropdown-opt"
								>
									<i className="ti ti-settings" />
									{ __(
										'AI Connector Settings',
										'nhrrob-smart-media-manager'
									) }
								</a>
							</div>
						</div>
					) }
				</div>

				<button
					className="btn btn-sm btn-primary"
					onClick={ () => dispatch( { type: 'OPEN_UPLOAD' } ) }
				>
					<i className="ti ti-cloud-upload" />
					{ __( 'Upload', 'nhrrob-smart-media-manager' ) }
				</button>
				<a
					href={ cfg.settingsUrl }
					className="btn-icon"
					title={ __( 'Settings', 'nhrrob-smart-media-manager' ) }
				>
					<i className="ti ti-adjustments-horizontal" />
				</a>
			</div>
		</div>
	);
}
