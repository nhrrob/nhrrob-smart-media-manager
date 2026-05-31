import { useState, memo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
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

export default function MainArea() {
	const { state, dispatch } = useApp();

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

function Toolbar() {
	const { state, dispatch, loadMedia } = useApp();
	const {
		currentFolder,
		folders,
		recentView,
		selection,
		files,
		filterType,
		view,
		thumbSize,
		sortBy,
		sortOrder,
	} = state;
	const [ filterOpen, setFilterOpen ] = useState( false );
	const [ sortOpen, setSortOpen ] = useState( false );

	function onSort( col ) {
		const order = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
		dispatch( { type: 'SET_SORT', sortBy: col, sortOrder: order } );
		loadMedia( { sortBy: col, sortOrder: order } );
	}

	const allChecked = files.length > 0 && selection.size === files.length;
	const indeterminate = selection.size > 0 && selection.size < files.length;

	function onSelectAll() {
		if ( allChecked || indeterminate ) {
			dispatch( { type: 'CLEAR_SELECTION' } );
		} else {
			dispatch( { type: 'SELECT_ALL' } );
		}
	}

	function getBreadcrumb() {
		if ( recentView ) {
			return __( 'Recent', 'nhrrob-smart-media-manager' );
		}
		if ( currentFolder === null ) {
			return __( 'All Files', 'nhrrob-smart-media-manager' );
		}
		if ( currentFolder === 0 ) {
			return __( 'Uncategorized', 'nhrrob-smart-media-manager' );
		}
		const f = findFolder( folders, currentFolder );
		return f ? f.name : '…';
	}

	function switchView( v ) {
		dispatch( { type: 'SET_VIEW', view: v } );
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

	const sortOptions = [
		[ 'date', __( 'Date Added', 'nhrrob-smart-media-manager' ) ],
		[ 'title', __( 'Name', 'nhrrob-smart-media-manager' ) ],
		[ 'size', __( 'Size', 'nhrrob-smart-media-manager' ) ],
	];

	const filterOptions = [
		[ '', __( 'All Types', 'nhrrob-smart-media-manager' ) ],
		[ 'image', __( 'Images', 'nhrrob-smart-media-manager' ) ],
		[ 'video', __( 'Video', 'nhrrob-smart-media-manager' ) ],
		[ 'audio', __( 'Audio', 'nhrrob-smart-media-manager' ) ],
		[ 'document', __( 'Documents', 'nhrrob-smart-media-manager' ) ],
		[
			'spreadsheet',
			__( 'Spreadsheets & CSV', 'nhrrob-smart-media-manager' ),
		],
		[ 'other', __( 'Other', 'nhrrob-smart-media-manager' ) ],
	];

	return (
		<div className="smm-toolbar">
			<SmmCheckbox
				checked={ allChecked }
				indeterminate={ indeterminate }
				onChange={ onSelectAll }
				title={ __( 'Select all', 'nhrrob-smart-media-manager' ) }
			/>

			<div className="breadcrumb">
				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<span
					className="breadcrumb-item"
					style={ { cursor: 'pointer' } }
					onClick={ () => {
						dispatch( { type: 'SET_FOLDER', folder: null } );
						setUrlParams( { folder: null, page: null } );
						loadMedia( { folder: null } );
					} }
				>
					<i className="ti ti-home" />
				</span>
				<span className="breadcrumb-sep">
					<i className="ti ti-chevron-right" />
				</span>
				<span className="breadcrumb-current">{ getBreadcrumb() }</span>
			</div>

			<div className="toolbar-filter-chips">
				{ state.search && (
					<span className="filter-chip">
						&ldquo;{ state.search }&rdquo;
						{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
						<i className="ti ti-x" onClick={ clearSearch } />
					</span>
				) }
				{ filterType && (
					<span className="filter-chip">
						{ filterType }
						{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
						<i
							className="ti ti-x"
							onClick={ () => setFilter( '' ) }
						/>
					</span>
				) }
			</div>

			<div style={ { flex: 1 } } />

			<div
				className="toolbar-filter-group"
				style={ { position: 'relative' } }
			>
				<button
					className="btn btn-sm btn-default"
					id="smm-sort-btn"
					onClick={ ( e ) => {
						e.stopPropagation();
						setSortOpen( ( v ) => ! v );
						setFilterOpen( false );
					} }
				>
					<i className="ti ti-arrows-sort" />{ ' ' }
					{ __( 'Sort', 'nhrrob-smart-media-manager' ) }
				</button>
				{ sortOpen && (
					<div
						className="smm-dropdown"
						id="smm-sort-dropdown"
						style={ { display: 'block' } }
					>
						<div className="smm-dropdown-section">
							{ sortOptions.map( ( [ col, label ] ) => {
								const active = sortBy === col;
								let dirIcon = 'minus';
								if ( active ) {
									dirIcon =
										sortOrder === 'ASC'
											? 'chevron-up'
											: 'chevron-down';
								}
								return (
									<button
										key={ col }
										type="button"
										className={ `smm-dropdown-opt sort-opt${
											active ? ' sort-opt-active' : ''
										}` }
										onClick={ () => {
											onSort( col );
											setSortOpen( false );
										} }
									>
										<i
											className={ `ti ti-${ dirIcon } sort-opt-icon` }
										/>
										{ label }
										{ active && (
											<i className="ti ti-check sort-opt-check" />
										) }
									</button>
								);
							} ) }
						</div>
					</div>
				) }
			</div>

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
					<i className="ti ti-filter" />{ ' ' }
					{ __( 'Filter', 'nhrrob-smart-media-manager' ) }
				</button>
				{ filterOpen && (
					<div
						className="smm-dropdown"
						id="smm-filter-dropdown"
						style={ { display: 'block' } }
					>
						<div className="smm-dropdown-section">
							<div className="smm-dropdown-label">
								{ __(
									'File Type',
									'nhrrob-smart-media-manager'
								) }
							</div>
							{ filterOptions.map( ( [ val, label ] ) => (
								// eslint-disable-next-line jsx-a11y/label-has-associated-control
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

			<div className="view-toggle">
				<button
					className={ `btn btn-sm btn-default${
						view === 'grid' ? ' is-active' : ''
					}` }
					title={ __( 'Grid view', 'nhrrob-smart-media-manager' ) }
					onClick={ () => switchView( 'grid' ) }
				>
					<i className="ti ti-layout-grid" />
				</button>
				<button
					className={ `btn btn-sm btn-default${
						view === 'list' ? ' is-active' : ''
					}` }
					title={ __( 'List view', 'nhrrob-smart-media-manager' ) }
					onClick={ () => switchView( 'list' ) }
				>
					<i className="ti ti-list" />
				</button>
			</div>

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
						title={ __(
							'Thumbnail size',
							'nhrrob-smart-media-manager'
						) }
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

// colors must match sidebar folder dots
const FOLDER_COLORS = [
	'#5b8def',
	'#e07c4b',
	'#3bba77',
	'#9b5de5',
	'#e05a7a',
	'#f0b429',
	'#06c8a0',
];

export function folderColor( folderId ) {
	if ( ! folderId ) {
		return null;
	}
	return FOLDER_COLORS[ folderId % FOLDER_COLORS.length ];
}

function GridView() {
	const { state, dispatch, loadMedia } = useApp();
	const { files, loading, selection, thumbSize, recentView, starredIds } =
		state;

	if ( loading && files.length === 0 ) {
		return (
			<div className="smm-grid-view" id="smm-grid-view">
				<div className="smm-media-grid">
					<div className="smm-grid-loading">
						<div className="smm-loading-state">
							<span className="smm-spinner" />
							<p>
								{ __(
									'Loading media…',
									'nhrrob-smart-media-manager'
								) }
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if ( ! loading && files.length === 0 ) {
		if ( recentView ) {
			return (
				<div className="smm-grid-view" id="smm-grid-view">
					<div
						className="smm-empty-state"
						style={ { display: 'flex' } }
					>
						<i className="ti ti-clock-off" />
						<p className="smm-empty-title">
							{ __(
								'No recently accessed files',
								'nhrrob-smart-media-manager'
							) }
						</p>
						<p className="smm-empty-sub">
							{ __(
								'Click any file to add it to Recent.',
								'nhrrob-smart-media-manager'
							) }
						</p>
						<button
							className="btn btn-default"
							onClick={ () => {
								dispatch( {
									type: 'SET_FOLDER',
									folder: null,
								} );
								loadMedia( {
									folder: null,
									recentView: false,
								} );
							} }
						>
							{ __(
								'Browse All Files',
								'nhrrob-smart-media-manager'
							) }
						</button>
					</div>
				</div>
			);
		}
		return (
			<div className="smm-grid-view" id="smm-grid-view">
				<div className="smm-empty-state" style={ { display: 'flex' } }>
					<i className="ti ti-folder-off" />
					<p className="smm-empty-title">
						{ __( 'No files here', 'nhrrob-smart-media-manager' ) }
					</p>
					<p className="smm-empty-sub">
						{ __(
							'Upload files or move some here from another folder.',
							'nhrrob-smart-media-manager'
						) }
					</p>
					<button
						className="btn btn-default"
						onClick={ () => dispatch( { type: 'OPEN_UPLOAD' } ) }
					>
						<i className="ti ti-upload" />{ ' ' }
						{ __( 'Upload Files', 'nhrrob-smart-media-manager' ) }
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
						isStarred={ starredIds.has( f.id ) }
						selectionSize={ selection.size }
						thumbSize={ thumbSize }
						dispatch={ dispatch }
					/>
				) ) }
			</div>
		</div>
	);
}

const MediaCard = memo( function MediaCard( {
	file: f,
	isSelected,
	isStarred,
	selectionSize,
	thumbSize,
	dispatch,
} ) {
	let selClass = '';
	if ( isSelected ) {
		selClass = selectionSize === 1 ? 'selected' : 'multi-selected';
	}
	const dotColor = folderColor( f.folder_id );
	const imgSrc = thumbSize > 150 && f.thumb_md ? f.thumb_md : f.thumb;

	function onDragStart( e ) {
		const ids = isSelected ? null : [ f.id ];
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData(
			'text/plain',
			JSON.stringify( { fileIds: ids || null, singleId: f.id } )
		);

		const ghost = document.createElement( 'div' );
		ghost.style.cssText =
			'position:fixed;top:-200px;background:var(--brand-800);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;';
		ghost.textContent = __( '1 file', 'nhrrob-smart-media-manager' );
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
		if ( ! isSelected ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		}
		dispatch( {
			type: 'SHOW_CONTEXT_MENU',
			kind: 'file',
			id: f.id,
			x: e.clientX,
			y: e.clientY,
		} );
	}

	function onStarClick( e ) {
		e.stopPropagation();
		dispatch( { type: 'TOGGLE_STAR', id: f.id } );
	}

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
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
				{ imgSrc ? (
					<img src={ imgSrc } alt={ f.title } loading="lazy" />
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
				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events */ }
				<div
					className={ `card-star${ isStarred ? ' starred' : '' }` }
					role="button"
					tabIndex={ -1 }
					title={
						isStarred
							? __( 'Unstar', 'nhrrob-smart-media-manager' )
							: __( 'Star', 'nhrrob-smart-media-manager' )
					}
					onClick={ onStarClick }
				>
					<i
						className={ `ti ti-star${
							isStarred ? '-filled' : ''
						}` }
					/>
				</div>
				<span className="card-badge">{ mimeToLabel( f.mime ) }</span>
			</div>
			<div className="card-info">
				<div className="card-name-row" title={ f.filename }>
					{ dotColor && (
						<span
							className="card-folder-dot"
							style={ { background: dotColor } }
						/>
					) }
					<span className="card-name">{ f.filename }</span>
				</div>
				<div className="card-meta">{ formatBytes( f.size ) }</div>
			</div>
		</div>
	);
} );

function ListView() {
	const { state, dispatch, loadMedia } = useApp();
	const {
		files,
		selection,
		folders,
		sortBy,
		sortOrder,
		loading,
		starredIds,
	} = state;

	function onSort( col ) {
		const order = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
		dispatch( { type: 'SET_SORT', sortBy: col, sortOrder: order } );
		loadMedia( { sortBy: col, sortOrder: order } );
	}

	function sortIcon( col ) {
		const active = sortBy === col;
		const up = active && sortOrder === 'ASC';
		return (
			<i
				className={ `ti ti-chevron-${ up ? 'up' : 'down' } sort-icon${
					active ? ' sort-active' : ''
				}` }
			/>
		);
	}

	const allChecked = files.length > 0 && selection.size === files.length;

	function onSelectAll() {
		if ( allChecked ) {
			dispatch( { type: 'CLEAR_SELECTION' } );
		} else {
			dispatch( { type: 'SELECT_ALL' } );
		}
	}

	return (
		<div className="smm-list-view" id="smm-list-view">
			<table className="smm-list-table">
				<thead>
					<tr>
						<th className="col-check">
							<SmmCheckbox
								checked={ allChecked }
								onChange={ onSelectAll }
							/>
						</th>
						<th className="col-star" />
						<th className="col-thumb">
							{ __( 'File', 'nhrrob-smart-media-manager' ) }
						</th>
						<th
							className="col-name sortable"
							onClick={ () => onSort( 'title' ) }
						>
							{ __( 'Name', 'nhrrob-smart-media-manager' ) }{ ' ' }
							{ sortIcon( 'title' ) }
						</th>
						<th className="col-type">
							{ __( 'Type', 'nhrrob-smart-media-manager' ) }
						</th>
						<th
							className="col-size sortable"
							onClick={ () => onSort( 'size' ) }
						>
							{ __( 'Size', 'nhrrob-smart-media-manager' ) }{ ' ' }
							{ sortIcon( 'size' ) }
						</th>
						<th className="col-dims">
							{ __( 'Dimensions', 'nhrrob-smart-media-manager' ) }
						</th>
						<th
							className="col-date sortable"
							onClick={ () => onSort( 'date' ) }
						>
							{ __( 'Date', 'nhrrob-smart-media-manager' ) }{ ' ' }
							{ sortIcon( 'date' ) }
						</th>
						<th className="col-alt">
							{ __( 'Alt', 'nhrrob-smart-media-manager' ) }
						</th>
						<th className="col-folder">
							{ __( 'Folder', 'nhrrob-smart-media-manager' ) }
						</th>
					</tr>
				</thead>
				<tbody>
					{ ( () => {
						if ( loading && files.length === 0 ) {
							return (
								<tr>
									<td
										colSpan="10"
										style={ {
											textAlign: 'center',
											padding: '40px',
											color: 'var(--gray-400)',
										} }
									>
										<span className="smm-spinner" />
									</td>
								</tr>
							);
						}
						if ( files.length === 0 ) {
							return (
								<tr>
									<td
										colSpan="10"
										style={ {
											textAlign: 'center',
											padding: '40px',
											color: 'var(--gray-400)',
										} }
									>
										{ __(
											'No files found.',
											'nhrrob-smart-media-manager'
										) }
									</td>
								</tr>
							);
						}
						return files.map( ( f ) => (
							<MediaRow
								key={ f.id }
								file={ f }
								isSelected={ selection.has( f.id ) }
								isStarred={ starredIds.has( f.id ) }
								folders={ folders }
								dispatch={ dispatch }
							/>
						) );
					} )() }
				</tbody>
			</table>
		</div>
	);
}

const MediaRow = memo( function MediaRow( {
	file: f,
	isSelected,
	isStarred,
	folders,
	dispatch,
} ) {
	const dims = f.width ? `${ f.width }×${ f.height }` : '—';
	const folderName = f.folder_id
		? getFolderName( folders, f.folder_id )
		: '—';
	const dotColor = folderColor( f.folder_id );

	function onClick( e ) {
		if ( e.target.closest( '.smm-checkbox' ) ) {
			return;
		}
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
		if ( ! isSelected ) {
			dispatch( { type: 'SELECT_FILE', id: f.id, mode: 'single' } );
		}
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
				<SmmCheckbox
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
			<td className="col-star">
				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `row-star${ isStarred ? ' starred' : '' }` }
					title={
						isStarred
							? __( 'Unstar', 'nhrrob-smart-media-manager' )
							: __( 'Star', 'nhrrob-smart-media-manager' )
					}
					onClick={ ( e ) => {
						e.stopPropagation();
						dispatch( { type: 'TOGGLE_STAR', id: f.id } );
					} }
				>
					<i
						className={ `ti ti-star${
							isStarred ? '-filled' : ''
						}` }
					/>
				</div>
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
			<td className="col-alt">
				{ f.has_alt === true && (
					<span className="alt-badge alt-yes">Yes</span>
				) }
				{ f.has_alt === false && (
					<span className="alt-badge alt-no">—</span>
				) }
			</td>
			<td className="col-folder">
				{ dotColor && (
					<span
						className="card-folder-dot"
						style={ { background: dotColor } }
					/>
				) }
				{ folderName }
			</td>
		</tr>
	);
} );

// custom checkbox: WP admin styles override native input[type=checkbox]
function SmmCheckbox( { checked, indeterminate, onChange, title } ) {
	let cls = 'smm-checkbox';
	if ( checked ) {
		cls += ' checked';
	} else if ( indeterminate ) {
		cls += ' indeterminate';
	}

	return (
		// eslint-disable-next-line jsx-a11y/interactive-supports-focus
		<div
			className={ cls }
			role="checkbox"
			aria-checked={ indeterminate ? 'mixed' : checked }
			title={ title }
			onClick={ ( e ) => {
				e.stopPropagation();
				onChange( e );
			} }
			onKeyDown={ ( e ) => {
				if ( e.key === ' ' ) {
					e.preventDefault();
					onChange( e );
				}
			} }
			tabIndex={ 0 }
		/>
	);
}

function Pagination() {
	const { state, dispatch, loadMedia } = useApp();
	const { pagination } = state;

	if ( pagination.pages <= 1 ) {
		return null;
	}

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
