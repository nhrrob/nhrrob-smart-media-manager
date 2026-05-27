import { useReducer, useCallback, useEffect, useRef } from '@wordpress/element';
import { AppContext, initialState, reducer } from '../context';
import { get, del } from '../api';
import { getUrlParam } from '../utils';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import MainArea from './MainArea';
import DetailsPanel from './DetailsPanel';
import UploadModal from './UploadModal';
import BulkBar from './BulkBar';
import { ConfirmModal, ContextMenus, Toast, StatusBar } from './Modals';

const cfg = window.nhrsmmConfig || {};

export default function App() {
	const [ state, dispatch ] = useReducer( reducer, {
		...initialState,
		view: cfg.defaultView || 'grid',
	} );

	const stateRef = useRef( state );
	stateRef.current = state;

	/* ── DATA LOADING ──────────────────────────────────────── */
	const loadMedia = useCallback( async ( opts = {} ) => {
		const s = stateRef.current;
		dispatch( { type: 'SET_LOADING', loading: true } );

		const params = new URLSearchParams();
		const folder =
			opts.folder !== undefined ? opts.folder : s.currentFolder;
		const page = opts.page !== undefined ? opts.page : s.pagination.page;
		const search = opts.search !== undefined ? opts.search : s.search;
		const filter = opts.filter !== undefined ? opts.filter : s.filterType;
		const sortBy = opts.sortBy !== undefined ? opts.sortBy : s.sortBy;
		const sortOrd =
			opts.sortOrder !== undefined ? opts.sortOrder : s.sortOrder;

		if ( folder !== null ) params.set( 'folder', folder );
		if ( search ) params.set( 'search', search );
		if ( filter ) params.set( 'type', filter );
		params.set( 'page', page );
		params.set( 'per_page', s.pagination.perPage );
		params.set( 'orderby', sortBy );
		params.set( 'order', sortOrd );

		try {
			const result = await get( '/media?' + params.toString() );
			dispatch( { type: 'SET_FILES', ...result } );
		} catch ( e ) {
			dispatch( { type: 'SET_LOADING', loading: false } );
			dispatch( {
				type: 'SHOW_TOAST',
				message: e.message || 'Failed to load media.',
				kind: 'danger',
			} );
		}
	}, [] );

	const loadFolders = useCallback( async () => {
		try {
			const tree = await get( '/folders' );
			dispatch( { type: 'SET_FOLDERS', folders: tree } );
		} catch {
			// non-critical
		}
	}, [] );

	const showToast = useCallback( ( message, kind = 'info' ) => {
		dispatch( { type: 'SHOW_TOAST', message, kind } );
	}, [] );

	const showConfirm = useCallback( ( message, onOk ) => {
		dispatch( { type: 'SHOW_CONFIRM', message, onOk } );
	}, [] );

	const deleteSelected = useCallback( () => {
		const s = stateRef.current;
		if ( s.selection.size === 0 ) return;
		const count = s.selection.size;
		showConfirm(
			`Delete ${ count } file${
				count === 1 ? '' : 's'
			}? This cannot be undone.`,
			async () => {
				const ids = [ ...stateRef.current.selection ];
				try {
					const res = await del( '/media/bulk-delete', { ids } );
					showToast(
						`Deleted ${ res.deleted } file${
							res.deleted === 1 ? '' : 's'
						}.`,
						'success'
					);
					dispatch( { type: 'CLEAR_SELECTION' } );
					await loadFolders();
					loadMedia();
				} catch ( e ) {
					showToast( e.message, 'danger' );
				}
			}
		);
	}, [ showConfirm, showToast, loadFolders, loadMedia ] );

	/* ── KEYBOARD SHORTCUTS ────────────────────────────────── */
	useEffect( () => {
		function onKeyDown( e ) {
			if ( e.target.matches( 'input, textarea, select' ) ) return;
			if ( e.key === 'Escape' ) {
				dispatch( { type: 'CLEAR_SELECTION' } );
				dispatch( { type: 'HIDE_CONTEXT_MENUS' } );
			} else if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				if ( stateRef.current.selection.size > 0 ) {
					e.preventDefault();
					deleteSelected();
				}
			} else if ( ( e.ctrlKey || e.metaKey ) && e.key === 'a' ) {
				e.preventDefault();
				dispatch( { type: 'SELECT_ALL' } );
			}
		}
		document.addEventListener( 'keydown', onKeyDown );
		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [ deleteSelected ] );

	/* ── GLOBAL CLICK (close context menus) ─────────────────── */
	useEffect( () => {
		function onClick( e ) {
			if (
				! e.target.closest( '.smm-context-menu' ) &&
				! e.target.closest( '#smm-filter-btn' ) &&
				! e.target.closest( '#smm-filter-dropdown' )
			) {
				dispatch( { type: 'HIDE_CONTEXT_MENUS' } );
			}
		}
		document.addEventListener( 'click', onClick );
		return () => document.removeEventListener( 'click', onClick );
	}, [] );

	/* ── INITIAL LOAD (once, with URL params) ──────────────── */
	useEffect( () => {
		const urlFolder = getUrlParam( 'folder' );
		const urlType = getUrlParam( 'type' );
		const urlPage = getUrlParam( 'page' );
		const urlQ = getUrlParam( 'q' );

		// Sync URL params into state
		if ( urlFolder !== null ) {
			dispatch( {
				type: 'SET_FOLDER',
				folder: urlFolder === 'all' ? null : parseInt( urlFolder ),
			} );
		}
		if ( urlType )
			dispatch( { type: 'SET_FILTER_TYPE', filterType: urlType } );
		if ( urlQ ) dispatch( { type: 'SET_SEARCH', search: urlQ } );

		// Load folders
		loadFolders();

		// Load media with URL params directly (don't wait for state to sync)
		loadMedia( {
			folder:
				urlFolder === null
					? undefined
					: urlFolder === 'all'
					? null
					: parseInt( urlFolder ),
			filter: urlType || undefined,
			page: urlPage ? parseInt( urlPage ) : undefined,
			search: urlQ || undefined,
		} );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	/* ── CONTEXT VALUE ─────────────────────────────────────── */
	const ctx = {
		state,
		dispatch,
		loadMedia,
		loadFolders,
		showToast,
		showConfirm,
		deleteSelected,
		cfg,
	};

	return (
		<AppContext.Provider value={ ctx }>
			<Topbar />
			<div className="smm-body">
				<Sidebar />
				<MainArea />
				{ state.detailsTarget !== null && (
					<DetailsPanel fileId={ state.detailsTarget } />
				) }
			</div>
			<StatusBar />
			{ state.uploadOpen && <UploadModal /> }
			{ state.confirmModal && <ConfirmModal /> }
			{ state.contextMenu && <ContextMenus /> }
			{ state.selection.size >= 2 && <BulkBar /> }
			{ state.toast && <Toast /> }
		</AppContext.Provider>
	);
}
