import { useReducer, useCallback, useEffect, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
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
	const [ state, dispatch ] = useReducer( reducer, initialState );

	const stateRef = useRef( state );
	stateRef.current = state;

	const loadMedia = useCallback( async ( opts = {} ) => {
		const s = stateRef.current;
		dispatch( { type: 'SET_LOADING', loading: true } );

		const params = new URLSearchParams();
		const recentView =
			opts.recentView !== undefined ? opts.recentView : s.recentView;
		const starredView =
			opts.starredView !== undefined ? opts.starredView : s.starredView;
		const folder =
			opts.folder !== undefined ? opts.folder : s.currentFolder;
		const page = opts.page !== undefined ? opts.page : s.pagination.page;
		const search = opts.search !== undefined ? opts.search : s.search;
		const filter = opts.filter !== undefined ? opts.filter : s.filterType;
		const sortBy = opts.sortBy !== undefined ? opts.sortBy : s.sortBy;
		const sortOrd =
			opts.sortOrder !== undefined ? opts.sortOrder : s.sortOrder;

		if ( starredView ) {
			const ids = [ ...s.starredIds ];
			if ( ids.length === 0 ) {
				dispatch( {
					type: 'SET_FILES',
					items: [],
					total: 0,
					pages: 0,
					page: 1,
					per_page: s.pagination.perPage,
				} );
				return;
			}
			params.set( 'ids', ids.join( ',' ) );
		} else if ( recentView ) {
			const recentIds = JSON.parse(
				localStorage.getItem( 'nhrsmm_recent_ids' ) || '[]'
			);
			if ( recentIds.length === 0 ) {
				dispatch( {
					type: 'SET_FILES',
					items: [],
					total: 0,
					pages: 0,
					page: 1,
					per_page: s.pagination.perPage,
				} );
				return;
			}
			params.set( 'ids', recentIds.join( ',' ) );
		} else {
			if ( folder !== null ) {
				params.set( 'folder', folder );
			}
			if ( search ) {
				params.set( 'search', search );
			}
			if ( filter ) {
				params.set( 'type', filter );
			}
			params.set( 'page', page );
			params.set( 'per_page', s.pagination.perPage );
			params.set( 'orderby', sortBy );
			params.set( 'order', sortOrd );
		}

		try {
			const result = await get( '/media?' + params.toString() );
			dispatch( { type: 'SET_FILES', ...result } );
		} catch ( e ) {
			dispatch( { type: 'SET_LOADING', loading: false } );
			dispatch( {
				type: 'SHOW_TOAST',
				message:
					e.message ||
					__( 'Failed to load media.', 'nhrrob-smart-media-manager' ),
				kind: 'danger',
			} );
		}
	}, [] );

	const loadFolders = useCallback( async () => {
		try {
			const result = await get( '/folders' );
			dispatch( {
				type: 'SET_FOLDERS',
				folders: result.tree,
				uncategorizedCount: result.uncategorized,
			} );
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
		if ( s.selection.size === 0 ) {
			return;
		}
		const count = s.selection.size;
		showConfirm(
			sprintf(
				// translators: %d: number of files to delete
				_n(
					'Delete %d file? This cannot be undone.',
					'Delete %d files? This cannot be undone.',
					count,
					'nhrrob-smart-media-manager'
				),
				count
			),
			async () => {
				const ids = [ ...stateRef.current.selection ];
				try {
					const res = await del( '/media/bulk-delete', { ids } );
					showToast(
						sprintf(
							// translators: %d: number of deleted files
							_n(
								'Deleted %d file.',
								'Deleted %d files.',
								res.deleted,
								'nhrrob-smart-media-manager'
							),
							res.deleted
						),
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

	useEffect( () => {
		function onKeyDown( e ) {
			if ( e.target.matches( 'input, textarea, select' ) ) {
				return;
			}
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

	useEffect( () => {
		localStorage.setItem(
			'nhrsmm_starred_ids',
			JSON.stringify( [ ...state.starredIds ] )
		);
	}, [ state.starredIds ] );

	useEffect( () => {
		localStorage.setItem( 'nhrsmm_thumb_size', String( state.thumbSize ) );
	}, [ state.thumbSize ] );

	useEffect( () => {
		localStorage.setItem( 'nhrsmm_view', state.view );
	}, [ state.view ] );

	useEffect( () => {
		const id = state.detailsTarget;
		if ( ! id ) {
			return;
		}
		const stored = JSON.parse(
			localStorage.getItem( 'nhrsmm_recent_ids' ) || '[]'
		);
		const updated = [ id, ...stored.filter( ( i ) => i !== id ) ].slice(
			0,
			20
		);
		localStorage.setItem( 'nhrsmm_recent_ids', JSON.stringify( updated ) );
	}, [ state.detailsTarget ] );

	useEffect( () => {
		function onClick( e ) {
			if (
				! e.target.closest( '.smm-context-menu' ) &&
				! e.target.closest( '#smm-filter-btn' ) &&
				! e.target.closest( '#smm-filter-dropdown' ) &&
				! e.target.closest( '#smm-sort-btn' ) &&
				! e.target.closest( '#smm-sort-dropdown' ) &&
				! e.target.closest( '#smm-ai-btn' ) &&
				! e.target.closest( '#smm-ai-dropdown' )
			) {
				dispatch( { type: 'HIDE_CONTEXT_MENUS' } );
			}
		}
		document.addEventListener( 'click', onClick );
		return () => document.removeEventListener( 'click', onClick );
	}, [] );

	useEffect( () => {
		const urlFolder = getUrlParam( 'folder' );
		const urlType = getUrlParam( 'type' );
		const urlPage = getUrlParam( 'page' );
		const urlQ = getUrlParam( 'q' );

		if ( urlFolder !== null ) {
			dispatch( {
				type: 'SET_FOLDER',
				folder: urlFolder === 'all' ? null : parseInt( urlFolder ),
			} );
		}
		if ( urlType ) {
			dispatch( { type: 'SET_FILTER_TYPE', filterType: urlType } );
		}
		if ( urlQ ) {
			dispatch( { type: 'SET_SEARCH', search: urlQ } );
		}

		loadFolders();

		let initialFolder;
		if ( urlFolder === null ) {
			initialFolder = undefined;
		} else if ( urlFolder === 'all' ) {
			initialFolder = null;
		} else {
			initialFolder = parseInt( urlFolder );
		}
		loadMedia( {
			folder: initialFolder,
			filter: urlType || undefined,
			page:
				urlPage && /^\d+$/.test( urlPage )
					? parseInt( urlPage, 10 )
					: undefined,
			search: urlQ || undefined,
		} );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

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
