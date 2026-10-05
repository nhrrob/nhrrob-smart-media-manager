import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { get, post, put } from '../api';
import { setUrlParams, setRecent, saveBlob } from '../utils';

const STORAGE_KEY = 'nhrsmm_open_folders';

function getOpenSet() {
	try {
		return new Set(
			JSON.parse( localStorage.getItem( STORAGE_KEY ) || '[]' )
		);
	} catch {
		return new Set();
	}
}
function saveOpenSet( set ) {
	localStorage.setItem( STORAGE_KEY, JSON.stringify( [ ...set ] ) );
}

// Keeps folders whose name matches, plus their ancestors.
function filterTree( folders, query ) {
	return folders.flatMap( ( f ) => {
		const children = filterTree( f.children || [], query );
		return f.name.toLowerCase().includes( query ) || children.length
			? [ { ...f, children } ]
			: [];
	} );
}

function allIds( folders ) {
	return folders.flatMap( ( f ) => [ f.id, ...allIds( f.children || [] ) ] );
}

export default function Sidebar() {
	const { state, dispatch, loadMedia, loadFolders, showToast } = useApp();
	const {
		folders,
		currentFolder,
		uncategorizedCount,
		totalCount,
		recentView,
		starredView,
		starredIds,
		specialView,
		missingAltCount,
		trashCount,
		sidebarCollapsed,
		sidebarWidth,
	} = state;
	const starredCount = starredIds.size;
	const [ query, setQuery ] = useState( '' );
	const importRef = useRef( null );
	const [ openFolders, setOpenFolders ] = useState( getOpenSet );
	const [ renamingId, setRenamingId ] = useState( null );
	const [ creatingFolder, setCreatingFolder ] = useState( false );
	const [ creatingSubfolderFor, setCreatingSubfolderFor ] = useState( null );

	useEffect( () => {
		setOpenFolders( getOpenSet() );
	}, [] );

	function navigateTo( folder ) {
		dispatch( { type: 'SET_FOLDER', folder } );
		setUrlParams( { folder: folder === null ? null : folder, page: null } );
		loadMedia( { folder, recentView: false, starredView: false } );
	}

	function navigateRecent() {
		dispatch( { type: 'SET_RECENT_VIEW' } );
		setUrlParams( { folder: null, page: null } );
		loadMedia( { recentView: true, starredView: false, folder: null } );
	}

	function navigateSpecial( view ) {
		dispatch( { type: 'SET_SPECIAL_VIEW', view } );
		setUrlParams( { folder: null, page: null } );
		loadMedia( {
			specialView: view,
			recentView: false,
			starredView: false,
			folder: null,
			page: 1,
		} );
	}

	function startResize( e ) {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = e.currentTarget.parentElement.offsetWidth;
		const dir = document.dir === 'rtl' ? -1 : 1;
		function onMove( ev ) {
			const width = startWidth + ( ev.clientX - startX ) * dir;
			dispatch( {
				type: 'SET_SIDEBAR',
				patch: {
					sidebarWidth: Math.min( 480, Math.max( 180, width ) ),
				},
			} );
		}
		function onUp() {
			document.removeEventListener( 'mousemove', onMove );
			document.removeEventListener( 'mouseup', onUp );
		}
		document.addEventListener( 'mousemove', onMove );
		document.addEventListener( 'mouseup', onUp );
	}

	async function exportFolders() {
		try {
			const data = await get( '/folders/export' );
			saveBlob(
				new Blob( [ JSON.stringify( data, null, 2 ) ], {
					type: 'application/json',
				} ),
				'media-folders.json'
			);
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	async function importFolders( e ) {
		const file = e.target.files[ 0 ];
		e.target.value = '';
		if ( ! file ) {
			return;
		}
		try {
			const data = JSON.parse( await file.text() );
			const res = await post( '/folders/import', {
				folders: data.folders || [],
			} );
			await loadFolders();
			showToast(
				sprintf(
					// translators: %d: number of imported folders
					_n(
						'Imported %d folder.',
						'Imported %d folders.',
						res.folders,
						'nhrrob-smart-media-manager'
					),
					res.folders
				),
				'success'
			);
		} catch ( err ) {
			showToast( err.message, 'danger' );
		}
	}

	function clearRecent( e ) {
		e.stopPropagation();
		setRecent( [] );
		post( '/user-state', { recent: [] } ).catch( () => {} );
		if ( recentView ) {
			loadMedia( { recentView: true, starredView: false, folder: null } );
		}
	}

	function navigateStarred() {
		dispatch( { type: 'SET_STARRED_VIEW' } );
		setUrlParams( { folder: null, page: null } );
		loadMedia( { starredView: true, recentView: false, folder: null } );
	}

	function clearStarred( e ) {
		e.stopPropagation();
		dispatch( { type: 'CLEAR_STARS' } );
		if ( starredView ) {
			loadMedia( { starredView: true, folder: null } );
		}
	}

	function toggleOpen( id ) {
		setOpenFolders( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			saveOpenSet( next );
			return next;
		} );
	}

	async function commitCreateFolder( name ) {
		setCreatingFolder( false );
		try {
			await post( '/folders', { name, parent: 0 } );
			await loadFolders();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	async function commitCreateSubfolder( name ) {
		const parentId = creatingSubfolderFor;
		try {
			await post( '/folders', { name, parent: parentId } );
			await loadFolders();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
		// Clear after loadFolders: React 18 batches both updates, preventing collapse→expand jump.
		setCreatingSubfolderFor( null );
	}

	async function renameFolder( id, name, original ) {
		setRenamingId( null );
		if ( ! name || name === original ) {
			return;
		}
		try {
			await put( `/folders/${ id }`, { name } );
			await loadFolders();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	useEffect( () => {
		function onRename( e ) {
			setRenamingId( e.detail );
		}
		function onStartSubfolder( e ) {
			const parentId = e.detail;
			setCreatingSubfolderFor( parentId );
			setOpenFolders( ( prev ) => {
				const next = new Set( prev );
				next.add( parentId );
				saveOpenSet( next );
				return next;
			} );
		}
		document.addEventListener( 'nhrsmm:rename-folder', onRename );
		document.addEventListener( 'nhrsmm:start-subfolder', onStartSubfolder );
		return () => {
			document.removeEventListener( 'nhrsmm:rename-folder', onRename );
			document.removeEventListener(
				'nhrsmm:start-subfolder',
				onStartSubfolder
			);
		};
	}, [] );

	const q = query.trim().toLowerCase();
	const shownFolders = q ? filterTree( folders, q ) : folders;
	const shownOpen = q ? new Set( allIds( shownFolders ) ) : openFolders;

	if ( sidebarCollapsed ) {
		return (
			<aside className="smm-sidebar is-collapsed" id="smm-sidebar">
				<button
					className="btn-icon-inline"
					title={ __( 'Show folders', 'nhrrob-smart-media-manager' ) }
					onClick={ () =>
						dispatch( {
							type: 'SET_SIDEBAR',
							patch: { sidebarCollapsed: false },
						} )
					}
				>
					<i className="ti ti-layout-sidebar" />
				</button>
			</aside>
		);
	}

	const specialItems = [
		[
			'missing-alt',
			'ti-alert-triangle',
			__( 'Missing alt text', 'nhrrob-smart-media-manager' ),
			missingAltCount,
		],
		[
			'unused',
			'ti-unlink',
			__( 'Unused', 'nhrrob-smart-media-manager' ),
			0,
		],
		[
			'trash',
			'ti-trash',
			__( 'Trash', 'nhrrob-smart-media-manager' ),
			trashCount,
		],
	];

	return (
		<aside
			className="smm-sidebar"
			id="smm-sidebar"
			style={
				sidebarWidth
					? { width: sidebarWidth, minWidth: sidebarWidth }
					: undefined
			}
		>
			{ /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */ }
			<div className="sidebar-resizer" onMouseDown={ startResize } />
			<div className="sidebar-section">
				<div className="sidebar-section-label">
					<i className="ti ti-layout-grid" />
					{ __( 'Library', 'nhrrob-smart-media-manager' ) }
					<button
						className="btn-icon-inline sidebar-collapse-btn"
						title={ __(
							'Hide folders',
							'nhrrob-smart-media-manager'
						) }
						onClick={ () =>
							dispatch( {
								type: 'SET_SIDEBAR',
								patch: { sidebarCollapsed: true },
							} )
						}
					>
						<i className="ti ti-layout-sidebar" />
					</button>
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${
						currentFolder === null &&
						! recentView &&
						! starredView &&
						! specialView
							? ' active'
							: ''
					}` }
					onClick={ () => navigateTo( null ) }
				>
					<i className="ti ti-photo" />
					<span>
						{ __( 'All Files', 'nhrrob-smart-media-manager' ) }
					</span>
					<span className="nav-count">{ totalCount || '–' }</span>
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${ recentView ? ' active' : '' }` }
					onClick={ navigateRecent }
				>
					<i className="ti ti-clock" />
					<span>
						{ __( 'Recent', 'nhrrob-smart-media-manager' ) }
					</span>
					{ recentView && (
						<button
							className="btn-icon-inline nav-clear-btn"
							title={ __(
								'Clear recent',
								'nhrrob-smart-media-manager'
							) }
							onClick={ clearRecent }
						>
							<i className="ti ti-x" />
						</button>
					) }
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${ starredView ? ' active' : '' }` }
					onClick={ navigateStarred }
				>
					<i className="ti ti-star" />
					<span>
						{ __( 'Starred', 'nhrrob-smart-media-manager' ) }
					</span>
					{ starredView && (
						<button
							className="btn-icon-inline nav-clear-btn"
							title={ __(
								'Clear starred',
								'nhrrob-smart-media-manager'
							) }
							onClick={ clearStarred }
						>
							<i className="ti ti-x" />
						</button>
					) }
					{ ! starredView && starredCount > 0 && (
						<span className="nav-count">{ starredCount }</span>
					) }
				</div>

				{ specialItems.map( ( [ view, icon, label, count ] ) => (
					// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
					<div
						key={ view }
						className={ `nav-item${
							specialView === view ? ' active' : ''
						}` }
						onClick={ () => navigateSpecial( view ) }
					>
						<i className={ `ti ${ icon }` } />
						<span>{ label }</span>
						{ count > 0 && (
							<span className="nav-count">{ count }</span>
						) }
					</div>
				) ) }
			</div>

			<div className="sidebar-section">
				<div
					className="sidebar-section-label"
					style={ {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					} }
				>
					<span
						style={ {
							display: 'flex',
							alignItems: 'center',
							gap: '5px',
						} }
					>
						<i className="ti ti-folder" />
						{ __( 'Folders', 'nhrrob-smart-media-manager' ) }
					</span>
					<button
						className="btn-icon-inline"
						title={ __(
							'New folder',
							'nhrrob-smart-media-manager'
						) }
						onClick={ () => setCreatingFolder( true ) }
					>
						<i
							className="ti ti-folder-plus"
							style={ {
								fontSize: '14px',
								color: 'var(--gray-400)',
								cursor: 'pointer',
							} }
						/>
					</button>
				</div>

				{ folders.length > 0 && (
					<input
						type="search"
						className="folder-search-input"
						value={ query }
						placeholder={ __(
							'Search folders…',
							'nhrrob-smart-media-manager'
						) }
						onChange={ ( e ) => setQuery( e.target.value ) }
					/>
				) }

				<div id="smm-folder-tree">
					{ creatingFolder && (
						<NewFolderInput
							onCommit={ commitCreateFolder }
							onCancel={ () => setCreatingFolder( false ) }
						/>
					) }
					{ folders.length === 0 ? (
						<div
							style={ {
								padding: '4px 8px',
								fontSize: '11px',
								color: 'var(--gray-400)',
								fontStyle: 'italic',
							} }
						>
							{ __(
								'No folders yet',
								'nhrrob-smart-media-manager'
							) }
						</div>
					) : (
						<FolderList
							folders={ shownFolders }
							depth={ 0 }
							parentId={ 0 }
							openFolders={ shownOpen }
							currentFolder={ currentFolder }
							renamingId={ renamingId }
							creatingSubfolderFor={ creatingSubfolderFor }
							onNavigate={ navigateTo }
							onToggleOpen={ toggleOpen }
							onRename={ renameFolder }
							onCancelRename={ () => setRenamingId( null ) }
							onStartRename={ setRenamingId }
							onCommitSubfolder={ commitCreateSubfolder }
							onCancelSubfolder={ () =>
								setCreatingSubfolderFor( null )
							}
							loadFolders={ loadFolders }
							loadMedia={ loadMedia }
							showToast={ showToast }
							dispatch={ dispatch }
						/>
					) }
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${
						currentFolder === 0 ? ' active' : ''
					}` }
					onClick={ () => navigateTo( 0 ) }
					style={ { marginTop: 'var(--sp-4)' } }
				>
					<i className="ti ti-folder-off" />
					<span>
						{ __( 'Uncategorized', 'nhrrob-smart-media-manager' ) }
					</span>
					<span className="nav-count">
						{ uncategorizedCount || '–' }
					</span>
				</div>
			</div>

			<div className="sidebar-tools">
				<button
					className="btn-icon-inline"
					title={ __(
						'Export folder structure',
						'nhrrob-smart-media-manager'
					) }
					onClick={ exportFolders }
				>
					<i className="ti ti-download" />
				</button>
				<button
					className="btn-icon-inline"
					title={ __(
						'Import folder structure',
						'nhrrob-smart-media-manager'
					) }
					onClick={ () => importRef.current?.click() }
				>
					<i className="ti ti-upload" />
				</button>
				<button
					className="btn-icon-inline"
					title={ __(
						'Import folders from another plugin',
						'nhrrob-smart-media-manager'
					) }
					onClick={ () =>
						dispatch( {
							type: 'OPEN_MODAL',
							modal: { kind: 'import' },
						} )
					}
				>
					<i className="ti ti-plug" />
				</button>
				<input
					ref={ importRef }
					type="file"
					accept="application/json,.json"
					style={ { display: 'none' } }
					onChange={ importFolders }
				/>
			</div>
		</aside>
	);
}

function NewFolderInput( { onCommit, onCancel } ) {
	const inputRef = useRef( null );

	useEffect( () => {
		inputRef.current?.focus();
	}, [] );

	return (
		<div className="folder-item">
			<span style={ { width: '14px', flexShrink: 0 } } />
			<i className="ti ti-folder" />
			<input
				ref={ inputRef }
				className="folder-rename-input"
				placeholder={ __(
					'Folder name',
					'nhrrob-smart-media-manager'
				) }
				onKeyDown={ ( e ) => {
					if ( e.key === 'Enter' ) {
						const val = e.target.value.trim();
						if ( val ) {
							onCommit( val );
						} else {
							onCancel();
						}
					}
					if ( e.key === 'Escape' ) {
						onCancel();
					}
				} }
				onClick={ ( e ) => e.stopPropagation() }
			/>
		</div>
	);
}

function FolderList( {
	folders,
	depth,
	parentId,
	openFolders,
	currentFolder,
	renamingId,
	creatingSubfolderFor,
	onNavigate,
	onToggleOpen,
	onRename,
	onCancelRename,
	onStartRename,
	onCommitSubfolder,
	onCancelSubfolder,
	loadFolders,
	loadMedia,
	showToast,
	dispatch,
} ) {
	return folders.map( ( f ) => (
		<FolderItem
			key={ f.id }
			folder={ f }
			depth={ depth }
			parentId={ parentId }
			siblings={ folders }
			openFolders={ openFolders }
			currentFolder={ currentFolder }
			renamingId={ renamingId }
			creatingSubfolderFor={ creatingSubfolderFor }
			onNavigate={ onNavigate }
			onToggleOpen={ onToggleOpen }
			onRename={ onRename }
			onCancelRename={ onCancelRename }
			onStartRename={ onStartRename }
			onCommitSubfolder={ onCommitSubfolder }
			onCancelSubfolder={ onCancelSubfolder }
			loadFolders={ loadFolders }
			loadMedia={ loadMedia }
			showToast={ showToast }
			dispatch={ dispatch }
		/>
	) );
}

// Top and bottom quarters of a row reorder; the middle nests.
function dropZone( e ) {
	const rect = e.currentTarget.getBoundingClientRect();
	const y = ( e.clientY - rect.top ) / rect.height;
	if ( y < 0.25 ) {
		return 'before';
	}
	return y > 0.75 ? 'after' : 'inside';
}

function FolderItem( {
	folder: f,
	depth,
	parentId,
	siblings,
	openFolders,
	currentFolder,
	renamingId,
	creatingSubfolderFor,
	onNavigate,
	onToggleOpen,
	onRename,
	onCancelRename,
	onStartRename,
	onCommitSubfolder,
	onCancelSubfolder,
	loadFolders,
	loadMedia,
	showToast,
	dispatch,
} ) {
	const isAddingChild = creatingSubfolderFor === f.id;
	const isOpen = openFolders.has( f.id ) || isAddingChild;
	const hasKids = ( f.children && f.children.length > 0 ) || isAddingChild;
	const isActive = currentFolder === f.id;
	const renaming = renamingId === f.id;
	const inputRef = useCallback( ( node ) => {
		if ( node ) {
			node.focus();
			node.select();
		}
	}, [] );

	function onDragStart( e ) {
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData(
			'text/plain',
			JSON.stringify( { folderDrag: true, folderId: f.id } )
		);
	}

	async function onDrop( e ) {
		e.preventDefault();
		// Read the pointer position now; it is not reliable after the awaits below.
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const zone = dropZone( e );
		e.currentTarget.classList.remove(
			'drag-over',
			'drop-before',
			'drop-after'
		);
		try {
			const raw = e.dataTransfer.getData( 'text/plain' );
			const data = JSON.parse( raw );
			if ( data.folderDrag ) {
				if ( data.folderId === f.id ) {
					return;
				}
				if ( zone === 'inside' ) {
					await post( `/folders/${ data.folderId }/move`, {
						parent: f.id,
					} );
				} else {
					const ids = siblings
						.map( ( s ) => s.id )
						.filter( ( id ) => id !== data.folderId );
					ids.splice(
						ids.indexOf( f.id ) + ( zone === 'after' ? 1 : 0 ),
						0,
						data.folderId
					);
					await post( '/folders/reorder', {
						parent: parentId,
						ids,
					} );
				}
				await loadFolders();
			} else if ( data.fileIds ) {
				// Hold Shift to keep the files in their current folders as well.
				await post( '/media/bulk-move', {
					ids: data.fileIds,
					folder_id: f.id,
					mode: e.shiftKey ? 'add' : 'move',
				} );
				showToast(
					sprintf(
						// translators: %d: number of moved files
						_n(
							'Moved %d file to folder.',
							'Moved %d files to folder.',
							data.fileIds.length,
							'nhrrob-smart-media-manager'
						),
						data.fileIds.length
					),
					'success'
				);
				await loadFolders();
				loadMedia();
			}
		} catch ( err ) {
			showToast( err.message, 'danger' );
		}
	}

	function onContextMenu( e ) {
		e.preventDefault();
		dispatch( {
			type: 'SHOW_CONTEXT_MENU',
			kind: 'folder',
			id: f.id,
			x: e.clientX,
			y: e.clientY,
		} );
	}

	function onItemClick( e ) {
		if ( e.target.classList.contains( 'folder-chevron' ) ) {
			e.stopPropagation();
			onToggleOpen( f.id );
			return;
		}
		onNavigate( f.id );
	}

	return (
		<>
			{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
			<div
				className={ `folder-item${ isActive ? ' active' : '' }` }
				draggable
				onClick={ onItemClick }
				onDoubleClick={ () => onStartRename( f.id ) }
				onContextMenu={ onContextMenu }
				onDragStart={ onDragStart }
				onDragOver={ ( e ) => {
					e.preventDefault();
					const zone = dropZone( e );
					const cls = e.currentTarget.classList;
					cls.toggle( 'drag-over', zone === 'inside' );
					cls.toggle( 'drop-before', zone === 'before' );
					cls.toggle( 'drop-after', zone === 'after' );
				} }
				onDragLeave={ ( e ) =>
					e.currentTarget.classList.remove(
						'drag-over',
						'drop-before',
						'drop-after'
					)
				}
				onDrop={ onDrop }
			>
				{ hasKids ? (
					<i
						className={ `ti ti-chevron-${
							isOpen ? 'down' : 'right'
						} folder-chevron` }
						style={ {
							fontSize: '12px',
							color: isActive
								? 'rgba(255,255,255,0.5)'
								: 'var(--gray-300)',
							flexShrink: 0,
							cursor: 'pointer',
						} }
					/>
				) : (
					<span style={ { width: '14px', flexShrink: 0 } } />
				) }
				{ depth === 0 || f.color ? (
					<span
						className={ `folder-dot folder-dot-${ f.id % 7 }` }
						style={ f.color ? { background: f.color } : undefined }
					/>
				) : (
					<i className="ti ti-folder" />
				) }
				{ renaming ? (
					<input
						ref={ inputRef }
						className="folder-rename-input"
						defaultValue={ f.name }
						onKeyDown={ ( e ) => {
							if ( e.key === 'Enter' ) {
								onRename( f.id, e.target.value.trim(), f.name );
							}
							if ( e.key === 'Escape' ) {
								onCancelRename();
							}
						} }
						onBlur={ ( e ) =>
							onRename( f.id, e.target.value.trim(), f.name )
						}
						onClick={ ( e ) => e.stopPropagation() }
					/>
				) : (
					<span className="folder-name">{ f.name }</span>
				) }
				<span className="folder-count">{ f.count || 0 }</span>
			</div>

			{ hasKids && isOpen && (
				<div className="folder-children">
					{ isAddingChild && (
						<NewFolderInput
							onCommit={ onCommitSubfolder }
							onCancel={ onCancelSubfolder }
						/>
					) }
					{ f.children && f.children.length > 0 && (
						<FolderList
							folders={ f.children }
							depth={ depth + 1 }
							parentId={ f.id }
							openFolders={ openFolders }
							currentFolder={ currentFolder }
							renamingId={ renamingId }
							creatingSubfolderFor={ creatingSubfolderFor }
							onNavigate={ onNavigate }
							onToggleOpen={ onToggleOpen }
							onRename={ onRename }
							onCancelRename={ onCancelRename }
							onStartRename={ onStartRename }
							onCommitSubfolder={ onCommitSubfolder }
							onCancelSubfolder={ onCancelSubfolder }
							loadFolders={ loadFolders }
							loadMedia={ loadMedia }
							showToast={ showToast }
							dispatch={ dispatch }
						/>
					) }
				</div>
			) }
		</>
	);
}
