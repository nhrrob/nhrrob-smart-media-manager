import { useState, useCallback, useRef, memo } from '@wordpress/element';
import { useApp } from '../context';
import {
	setUrlParams,
	findFolder,
	getFolderName,
	mimeToLabel,
	typeToIcon,
	typeToClass,
	formatBytes,
	formatDate,
} from '../utils';

/* ── Main Area (toolbar + content + pagination) ──────────────── */
export default function MainArea() {
	const { state, dispatch, loadMedia } = useApp();

	function onDragOver( e ) {
		if ( e.dataTransfer.types.includes( 'Files' ) ) {
			e.preventDefault();
			e.currentTarget.style.outline = '2px dashed var(--brand-600)';
		}
	}
	function onDragLeave( e ) {
		e.currentTarget.style.outline = '';
	}
	function onDrop( e ) {
		e.currentTarget.style.outline = '';
		if ( e.dataTransfer.files.length ) {
			e.preventDefault();
			dispatch( { type: 'OPEN_UPLOAD', files: e.dataTransfer.files } );
		}
	}

	return (
		<div className="smm-main" id="smm-main">
			<Toolbar />
			<div
				className="smm-content-area"
				id="smm-content-area"
				onDragOver={ onDragOver }
				onDragLeave={ onDragLeave }
				onDrop={ onDrop }
			>
				{ state.view === 'grid' ? <GridView /> : <ListView /> }
			</div>
			<Pagination />
		</div>
	);
}

/* ── Toolbar ─────────────────────────────────────────────────── */
function Toolbar() {
	const { state, dispatch, loadMedia } = useApp();
	const {
		currentFolder,
		folders,
		selection,
		files,
		filterType,
		view,
		thumbSize,
		sortBy,
		sortOrder,
	} = state;
	const [ filterOpen, setFilterOpen ] = useState( false );

	const allChecked = files.length > 0 && selection.size === files.length;
	const indeterminate = selection.size > 0 && selection.size < files.length;

	const checkRef = useCallback(
		( node ) => {
			if ( node ) node.indeterminate = indeterminate;
		},
		[ indeterminate ]
	);

	function onSelectAll( e ) {
		if ( e.target.checked ) {
			dispatch( { type: 'SELECT_ALL' } );
		} else {
			dispatch( { type: 'CLEAR_SELECTION' } );
		}
	}

	function getBreadcrumb() {
		if ( currentFolder === null ) return 'All Files';
		if ( currentFolder === 0 ) return 'Uncategorized';
		const f = findFolder( folders, currentFolder );
		return f ? f.name : '…';
	}

	function switchView( v ) {
		dispatch( { type: 'SET_VIEW', view: v } );
	}

	function onSort( col ) {
		const order = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
		dispatch( { type: 'SET_SORT', sortBy: col, sortOrder: order } );
		loadMedia( { sortBy: col, sortOrder: order } );
	}

	function setFilter( type ) {
		const ft = type || null;
		dispatch( { type: 'SET_FILTER_TYPE', filterType: ft } );
		setUrlParams( { type: ft || null, page: null } );
		setFilterOpen( false );
		loadMedia( { filter: ft } );
	}

	function clearSearch() {
		dispatch( { type: 'SET_SEARCH', search: '' } );
		setUrlParams( { q: null, page: null } );
		loadMedia( { search: '' } );
	}

	return (
		<div className="smm-toolbar">
			<input
				ref={ checkRef }
				type="checkbox"
				className="toolbar-checkbox"
				checked={ allChecked }
				onChange={ onSelectAll }
				title="Select all"
			/>

			<div className="breadcrumb">
				<span
					className="breadcrumb-item"
					style={ { cursor: 'pointer' } }
					onClick={ () => {
						dispatch( { type: 'SET_FOLDER', folder: null } );
						setUrlParams( { folder: null, page: null } );
						loadMedia( { folder: null } );
					} }
				>
					<i className="ti ti-home" style={ { fontSize: '12px' } } />
				</span>
				<span className="breadcrumb-sep">
					<i className="ti ti-chevron-right" />
				</span>
				<span className="breadcrumb-current">{ getBreadcrumb() }</span>
			</div>

			{ /* Filter chips */ }
			<div className="toolbar-filter-chips">
				{ state.search && (
					<span className="filter-chip">
						"{ state.search }"
						<i className="ti ti-x" onClick={ clearSearch } />
					</span>
				) }
				{ filterType && (
					<span className="filter-chip">
						{ filterType }
						<i
							className="ti ti-x"
							onClick={ () => setFilter( '' ) }
						/>
					</span>
				) }
			</div>

			<div style={ { flex: 1 } } />

			{ /* Filter dropdown */ }
			<div
				className="toolbar-filter-group"
				style={ { position: 'relative' } }
			>
				<button
					className="btn btn-sm btn-default"
					id="smm-filter-btn"
					onClick={ ( e ) => {
						e.stopPropagation();
						setFilterOpen( ( v ) => ! v );
					} }
				>
					<i className="ti ti-filter" /> Filter
				</button>
				{ filterOpen && (
					<div
						className="smm-dropdown"
						id="smm-filter-dropdown"
						style={ { display: 'block' } }
					>
						<div className="smm-dropdown-section">
							<div className="smm-dropdown-label">File Type</div>
							{ [
								[ '', 'All Types' ],
								[ 'image', 'Images' ],
								[ 'video', 'Video' ],
								[ 'audio', 'Audio' ],
								[ 'document', 'Documents' ],
								[ 'other', 'Other' ],
							].map( ( [ val, label ] ) => (
								<label key={ val } className="smm-dropdown-opt">
									<input
										type="radio"
										name="smm_type_filter"
										value={ val }
										checked={ ( filterType || '' ) === val }
										onChange={ () => setFilter( val ) }
									/>{ ' ' }
									{ label }
								</label>
							) ) }
						</div>
					</div>
				) }
			</div>

			{ /* View toggle */ }
			<div className="view-toggle">
				<button
					className={ `btn btn-sm btn-default${
						view === 'grid' ? ' is-active' : ''
					}` }
					title="Grid view"
					onClick={ () => switchView( 'grid' ) }
				>
					<i className="ti ti-layout-grid" />
				</button>
				<button
					className={ `btn btn-sm btn-default${
						view === 'list' ? ' is-active' : ''
					}` }
					title="List view"
					onClick={ () => switchView( 'list' ) }
				>
					<i className="ti ti-list" />
				</button>
			</div>

			{ /* Thumb size slider (grid only) */ }
			{ view === 'grid' && (
				<div className="thumb-size-control">
					<i
						className="ti ti-photo"
						style={ { fontSize: '11px', color: 'var(--gray-400)' } }
					/>
					<input
						type="range"
						min="80"
						max="200"
						step="20"
						value={ thumbSize }
						title="Thumbnail size"
						onChange={ ( e ) =>
							dispatch( {
								type: 'SET_THUMB_SIZE',
								size: parseInt( e.target.value ),
							} )
						}
					/>
					<i
						className="ti ti-photo"
						style={ { fontSize: '15px', color: 'var(--gray-400)' } }
					/>
				</div>
			) }
		</div>
	);
}

/* ── Grid View ───────────────────────────────────────────────── */
function GridView() {
	const { state, dispatch, loadMedia } = useApp();
	const { files, loading, selection, thumbSize } = state;

	if ( loading && files.length === 0 ) {
		return (
			<div className="smm-grid-view" id="smm-grid-view">
				<div className="smm-media-grid">
					<div className="smm-grid-loading">
						<div className="smm-loading-state">
							<span className="smm-spinner" />
							<p>Loading media…</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if ( ! loading && files.length === 0 ) {
		return (
			<div className="smm-grid-view" id="smm-grid-view">
				<div className="smm-empty-state" style={ { display: 'flex' } }>
					<i className="ti ti-folder-off" />
					<p className="smm-empty-title">No files here</p>
					<p className="smm-empty-sub">
						Upload files or move some here from another folder.
					</p>
					<button
						className="btn btn-default"
						onClick={ () => dispatch( { type: 'OPEN_UPLOAD' } ) }
					>
						<i className="ti ti-upload" /> Upload Files
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="smm-grid-view" id="smm-grid-view">
			<div
				className="smm-media-grid"
				style={ {
					gridTemplateColumns: `repeat(auto-fill, minmax(${ thumbSize }px, 1fr))`,
				} }
			>
				{ files.map( ( f ) => (
					<MediaCard
						key={ f.id }
						file={ f }
						isSelected={ selection.has( f.id ) }
						selectionSize={ selection.size }
						dispatch={ dispatch }
					/>
				) ) }
			</div>
		</div>
	);
}

/* ── Media Card ──────────────────────────────────────────────── */
const MediaCard = memo( function MediaCard( {
	file: f,
	isSelected,
	selectionSize,
	dispatch,
} ) {
	const selClass = isSelected
		? selectionSize === 1
			? 'selected'
			: 'multi-selected'
		: '';

	function onDragStart( e ) {
		// Use the current selection if file is in it, else just this file
		const ids = isSelected ? null : [ f.id ]; // null means "use selection"
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData(
			'text/plain',
			JSON.stringify( { fileIds: ids || null, singleId: f.id } )
		);

		const ghost = document.createElement( 'div' );
		ghost.style.cssText =
			'position:fixed;top:-200px;background:var(--brand-800);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;';
		ghost.textContent = '1 file';
		document.body.appendChild( ghost );
		e.dataTransfer.setDragImage( ghost, 0, 0 );
		setTimeout( () => ghost.remove(), 0 );
	}

	function onClick( e ) {
		if ( e.shiftKey ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'range' } );
		} else if ( e.ctrlKey || e.metaKey ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'toggle' } );
		} else {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		}
	}

	function onContextMenu( e ) {
		e.preventDefault();
		if ( ! isSelected )
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		dispatch( {
			type: 'SHOW_CONTEXT_MENU',
			kind: 'file',
			id: f.id,
			x: e.clientX,
			y: e.clientY,
		} );
	}

	return (
		<div
			className={ `smm-media-card ${ selClass }` }
			draggable
			tabIndex={ 0 }
			onClick={ onClick }
			onContextMenu={ onContextMenu }
			onKeyDown={ ( e ) =>
				e.key === 'Enter' &&
				dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } )
			}
			onDragStart={ onDragStart }
		>
			<div className="card-thumb">
				{ f.thumb ? (
					<img src={ f.thumb } alt={ f.title } loading="lazy" />
				) : (
					<i
						className={ `ti ${ typeToIcon(
							f.type
						) } card-type-icon` }
					/>
				) }
				<div
					className={ `card-check${ isSelected ? ' checked' : '' }` }
				/>
				<span className="card-badge">{ mimeToLabel( f.mime ) }</span>
			</div>
			<div className="card-info">
				<div className="card-name" title={ f.filename }>
					{ f.filename }
				</div>
				<div className="card-meta">{ formatBytes( f.size ) }</div>
			</div>
		</div>
	);
} );

/* ── List View ───────────────────────────────────────────────── */
function ListView() {
	const { state, dispatch } = useApp();
	const { files, selection, folders, sortBy, sortOrder, loading } = state;

	function onSort( col ) {
		const order = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
		dispatch( { type: 'SET_SORT', sortBy: col, sortOrder: order } );
	}

	function onSelectAll( e ) {
		if ( e.target.checked ) {
			dispatch( { type: 'SELECT_ALL' } );
		} else {
			dispatch( { type: 'CLEAR_SELECTION' } );
		}
	}

	const allChecked = files.length > 0 && selection.size === files.length;

	return (
		<div className="smm-list-view" id="smm-list-view">
			<table className="smm-list-table">
				<thead>
					<tr>
						<th className="col-check">
							<input
								type="checkbox"
								className="toolbar-checkbox"
								checked={ allChecked }
								onChange={ onSelectAll }
							/>
						</th>
						<th className="col-thumb">File</th>
						<th
							className="col-name sortable"
							onClick={ () => onSort( 'title' ) }
						>
							Name <i className="ti ti-chevron-down" />
						</th>
						<th
							className="col-type sortable"
							onClick={ () => onSort( 'type' ) }
						>
							Type
						</th>
						<th className="col-size">Size</th>
						<th className="col-dims">Dimensions</th>
						<th
							className="col-date sortable"
							onClick={ () => onSort( 'date' ) }
						>
							Date{ ' ' }
							<i
								className={ `ti ti-chevron-${
									sortBy === 'date' && sortOrder === 'ASC'
										? 'up'
										: 'down'
								}${ sortBy === 'date' ? ' sort-active' : '' }` }
							/>
						</th>
						<th className="col-folder">Folder</th>
					</tr>
				</thead>
				<tbody>
					{ loading && files.length === 0 ? (
						<tr>
							<td
								colSpan="8"
								style={ {
									textAlign: 'center',
									padding: '40px',
									color: 'var(--gray-400)',
								} }
							>
								<span className="smm-spinner" />
							</td>
						</tr>
					) : files.length === 0 ? (
						<tr>
							<td
								colSpan="8"
								style={ {
									textAlign: 'center',
									padding: '40px',
									color: 'var(--gray-400)',
								} }
							>
								No files found.
							</td>
						</tr>
					) : (
						files.map( ( f ) => (
							<MediaRow
								key={ f.id }
								file={ f }
								isSelected={ selection.has( f.id ) }
								folders={ folders }
								dispatch={ dispatch }
							/>
						) )
					) }
				</tbody>
			</table>
		</div>
	);
}

const MediaRow = memo( function MediaRow( {
	file: f,
	isSelected,
	folders,
	dispatch,
} ) {
	const dims = f.width ? `${ f.width }×${ f.height }` : '—';
	const folderName = f.folder_id
		? getFolderName( folders, f.folder_id )
		: '—';

	function onClick( e ) {
		if ( e.target.matches( '.list-row-check' ) ) return; // handled by onChange
		if ( e.shiftKey ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'range' } );
		} else if ( e.ctrlKey || e.metaKey ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'toggle' } );
		} else {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		}
	}

	function onContextMenu( e ) {
		e.preventDefault();
		if ( ! isSelected )
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		dispatch( {
			type: 'SHOW_CONTEXT_MENU',
			kind: 'file',
			id: f.id,
			x: e.clientX,
			y: e.clientY,
		} );
	}

	return (
		<tr
			className={ isSelected ? 'selected' : '' }
			onClick={ onClick }
			onContextMenu={ onContextMenu }
		>
			<td className="col-check">
				<input
					type="checkbox"
					className="toolbar-checkbox list-row-check"
					checked={ isSelected }
					onChange={ () =>
						dispatch( {
							type: 'SELECT_FILE',
							id: f.id,
							mode: 'toggle',
						} )
					}
				/>
			</td>
			<td className="col-thumb">
				{ f.thumb ? (
					<img
						className="list-thumb"
						src={ f.thumb }
						alt={ f.title }
						loading="lazy"
					/>
				) : (
					<div className="list-thumb-icon">
						<i className={ `ti ${ typeToIcon( f.type ) }` } />
					</div>
				) }
			</td>
			<td className="col-name">
				<div className="list-filename" title={ f.filename }>
					{ f.title || f.filename }
				</div>
			</td>
			<td className="col-type">
				<span
					className={ `list-type-badge ${ typeToClass( f.type ) }` }
				>
					{ mimeToLabel( f.mime ) }
				</span>
			</td>
			<td className="col-size">{ formatBytes( f.size ) }</td>
			<td className="col-dims">{ dims }</td>
			<td className="col-date">{ formatDate( f.date ) }</td>
			<td className="col-folder">{ folderName }</td>
		</tr>
	);
} );

/* ── Pagination ──────────────────────────────────────────────── */
function Pagination() {
	const { state, dispatch, loadMedia } = useApp();
	const { pagination } = state;

	if ( pagination.pages <= 1 ) return null;

	function goTo( page ) {
		dispatch( { type: 'SET_PAGE', page } );
		setUrlParams( { page } );
		loadMedia( { page } );
	}

	return (
		<div className="smm-pagination">
			<button
				className="btn btn-sm btn-default"
				disabled={ pagination.page <= 1 }
				onClick={ () => goTo( pagination.page - 1 ) }
			>
				<i className="ti ti-chevron-left" />
			</button>
			<span className="smm-page-info">
				{ pagination.page } / { pagination.pages }
			</span>
			<button
				className="btn btn-sm btn-default"
				disabled={ pagination.page >= pagination.pages }
				onClick={ () => goTo( pagination.page + 1 ) }
			>
				<i className="ti ti-chevron-right" />
			</button>
		</div>
	);
}
