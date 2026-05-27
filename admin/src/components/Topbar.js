import { useCallback, useRef } from '@wordpress/element';
import { useApp } from '../context';
import { setUrlParams } from '../utils';

const cfg = window.nhrsmmConfig || {};

export default function Topbar() {
	const { dispatch, loadMedia } = useApp();
	const searchRef  = useRef( null );
	const debounceRef = useRef( null );

	const onSearchInput = useCallback( () => {
		const val = searchRef.current.value;
		clearTimeout( debounceRef.current );
		debounceRef.current = setTimeout( () => {
			dispatch( { type: 'SET_SEARCH', search: val } );
			setUrlParams( { q: val || null, page: null } );
			loadMedia( { search: val } );
		}, 350 );
	}, [ dispatch, loadMedia ] );

	return (
		<div className="smm-topbar">
			<div className="smm-logo">
				<div className="smm-logo-icon">
					<i className="ti ti-stack-2" />
				</div>
				<span className="smm-logo-name">
					NHR <span>Smart Media</span>
				</span>
			</div>

			<div className="topbar-search">
				<i className="ti ti-search" />
				<input
					ref={ searchRef }
					type="text"
					placeholder="Search files…"
					autoComplete="off"
					onInput={ onSearchInput }
				/>
			</div>

			<div className="topbar-spacer" />

			<div className="topbar-actions">
				<button
					className="btn btn-sm btn-ai"
					onClick={ () => {} }
				>
					<i className="ti ti-sparkles" />
					AI Tools
				</button>
				<button
					className="btn btn-sm btn-ghost-white"
					onClick={ () => dispatch( { type: 'OPEN_UPLOAD' } ) }
				>
					<i className="ti ti-cloud-upload" />
					Upload
				</button>
				<a
					href={ cfg.settingsUrl }
					className="btn btn-sm btn-ghost-white"
					title="Settings"
				>
					<i className="ti ti-device-floppy" />
				</a>
			</div>
		</div>
	);
}
