import { createContext, useContext } from '@wordpress/element';

const cfg = window.nhrsmmConfig || {};

export const initialState = {
	view: cfg.defaultView || 'grid',
	currentFolder: null,
	files: [],
	selection: new Set(),
	detailsTarget: null,
	search: '',
	filterType: null,
	pagination: { page: 1, total: 0, pages: 1, perPage: cfg.perPage || 40 },
	folders: [],
	thumbSize: 120,
	sortBy: 'date',
	sortOrder: 'DESC',
	loading: false,
	uploadOpen: false,
	uploadInitialFiles: null,
	confirmModal: null,
	contextMenu: null,
	toast: null,
};

export function reducer( state, action ) {
	switch ( action.type ) {
		case 'SET_VIEW':
			return { ...state, view: action.view };

		case 'SET_FOLDER':
			return {
				...state,
				currentFolder: action.folder,
				selection: new Set(),
				detailsTarget: null,
				pagination: { ...state.pagination, page: 1 },
			};

		case 'SET_FILES':
			return {
				...state,
				files: action.items,
				loading: false,
				pagination: {
					page: action.page,
					total: action.total,
					pages: action.pages,
					perPage: action.per_page,
				},
			};

		case 'SET_FOLDERS':
			return { ...state, folders: action.folders };

		case 'SET_LOADING':
			return { ...state, loading: action.loading };

		case 'SELECT_FILE': {
			const sel = new Set( state.selection );
			if ( action.mode === 'single' ) {
				if ( sel.size === 1 && sel.has( action.id ) ) {
					sel.clear();
				} else {
					sel.clear();
					sel.add( action.id );
				}
			} else if ( action.mode === 'toggle' ) {
				if ( sel.has( action.id ) ) {
					sel.delete( action.id );
				} else {
					sel.add( action.id );
				}
			} else if ( action.mode === 'range' ) {
				const ids = state.files.map( ( f ) => f.id );
				const last = [ ...state.selection ].pop();
				const from = last ? ids.indexOf( last ) : 0;
				const to = ids.indexOf( action.id );
				const [ a, b ] = from <= to ? [ from, to ] : [ to, from ];
				for ( let i = a; i <= b; i++ ) {
					sel.add( ids[ i ] );
				}
			}
			const detailsTarget = sel.size === 1 ? [ ...sel ][ 0 ] : null;
			return { ...state, selection: sel, detailsTarget };
		}

		case 'CLEAR_SELECTION':
			return { ...state, selection: new Set(), detailsTarget: null };

		case 'SELECT_ALL': {
			const sel = new Set( state.files.map( ( f ) => f.id ) );
			return { ...state, selection: sel, detailsTarget: null };
		}

		case 'SET_SEARCH':
			return {
				...state,
				search: action.search,
				pagination: { ...state.pagination, page: 1 },
			};

		case 'SET_FILTER_TYPE':
			return {
				...state,
				filterType: action.filterType,
				pagination: { ...state.pagination, page: 1 },
			};

		case 'SET_PAGE':
			return {
				...state,
				pagination: { ...state.pagination, page: action.page },
			};

		case 'SET_THUMB_SIZE':
			return { ...state, thumbSize: action.size };

		case 'SET_SORT':
			return {
				...state,
				sortBy: action.sortBy,
				sortOrder: action.sortOrder,
				pagination: { ...state.pagination, page: 1 },
			};

		case 'OPEN_UPLOAD':
			return {
				...state,
				uploadOpen: true,
				uploadInitialFiles: action.files || null,
			};

		case 'CLOSE_UPLOAD':
			return { ...state, uploadOpen: false, uploadInitialFiles: null };

		case 'SHOW_CONFIRM':
			return {
				...state,
				confirmModal: { message: action.message, onOk: action.onOk },
			};

		case 'HIDE_CONFIRM':
			return { ...state, confirmModal: null };

		case 'SHOW_CONTEXT_MENU':
			return {
				...state,
				contextMenu: {
					kind: action.kind,
					id: action.id,
					x: action.x,
					y: action.y,
				},
			};

		case 'HIDE_CONTEXT_MENUS':
			return { ...state, contextMenu: null };

		case 'SHOW_TOAST':
			return {
				...state,
				toast: {
					message: action.message,
					kind: action.kind,
					id: Date.now(),
				},
			};

		case 'HIDE_TOAST':
			return { ...state, toast: null };

		default:
			return state;
	}
}

export const AppContext = createContext( null );

export function useApp() {
	return useContext( AppContext );
}
