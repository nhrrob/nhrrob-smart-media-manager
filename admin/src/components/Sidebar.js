import { useState, useEffect, useCallback } from '@wordpress/element';
import { useApp } from '../context';
import { post, put } from '../api';
import { setUrlParams } from '../utils';

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

export default function Sidebar() {
	const { state, dispatch, loadMedia, loadFolders, showToast } = useApp();
	const { folders, currentFolder } = state;
	const [ openFolders, setOpenFolders ] = useState( getOpenSet );
	const [ renamingId, setRenamingId ] = useState( null );

	// Reload open set when folders change (to persist across reloads)
	useEffect( () => {
		setOpenFolders( getOpenSet() );
	}, [] );

	function navigateTo( folder ) {
		dispatch( { type: 'SET_FOLDER', folder } );
		setUrlParams( { folder: folder === null ? null : folder, page: null } );
		loadMedia( { folder } );
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

	async function createFolder( name = 'New Folder', parent = 0 ) {
		try {
			await post( '/folders', { name, parent } );
			await loadFolders();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
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

	// Listen for rename trigger from context menu
	useEffect( () => {
		function onAction( e ) {
			if ( e.type === 'nhrsmm:rename-folder' ) {
				setRenamingId( e.detail );
			}
		}
		document.addEventListener( 'nhrsmm:rename-folder', onAction );
		return () =>
			document.removeEventListener( 'nhrsmm:rename-folder', onAction );
	}, [] );

	// Count all files across all folders
	function sumCount( arr ) {
		return arr.reduce(
			( acc, f ) => acc + ( f.count || 0 ) + sumCount( f.children || [] ),
			0
		);
	}
	const totalCount = sumCount( folders );

	return (
		<aside className="smm-sidebar" id="smm-sidebar">
			{ /* ── Library nav ── */ }
			<div className="sidebar-section">
				<div className="sidebar-section-label">Library</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${
						currentFolder === null ? ' active' : ''
					}` }
					onClick={ () => navigateTo( null ) }
				>
					<i className="ti ti-photo" />
					<span>All Files</span>
					<span className="nav-count">{ totalCount || '–' }</span>
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${
						currentFolder === 0 ? ' active' : ''
					}` }
					onClick={ () => navigateTo( 0 ) }
				>
					<i className="ti ti-folder-off" />
					<span>Uncategorized</span>
				</div>
			</div>

			{ /* ── Folders ── */ }
			<div className="sidebar-section">
				<div
					className="sidebar-section-label"
					style={ {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					} }
				>
					Folders
					<button
						className="btn-icon-inline"
						title="New folder"
						onClick={ () => createFolder() }
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

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className="folder-new-btn"
					onClick={ () => createFolder() }
				>
					<i className="ti ti-folder-plus" />
					New Folder
				</div>

				<div id="smm-folder-tree">
					{ folders.length === 0 ? (
						<div
							style={ {
								padding: '4px 8px',
								fontSize: '11px',
								color: 'var(--gray-400)',
								fontStyle: 'italic',
							} }
						>
							No folders yet
						</div>
					) : (
						<FolderList
							folders={ folders }
							depth={ 0 }
							openFolders={ openFolders }
							currentFolder={ currentFolder }
							renamingId={ renamingId }
							onNavigate={ navigateTo }
							onToggleOpen={ toggleOpen }
							onRename={ renameFolder }
							onCancelRename={ () => setRenamingId( null ) }
							onStartRename={ setRenamingId }
							loadFolders={ loadFolders }
							loadMedia={ loadMedia }
							showToast={ showToast }
							dispatch={ dispatch }
						/>
					) }
				</div>
			</div>

			{ /* ── Tools ── */ }
			<div className="sidebar-section">
				<div className="sidebar-section-label">Tools</div>

				<div className="tool-item">
					<i className="ti ti-photo-off" />
					<span>Unused Media</span>
					<span className="badge-pro">Pro</span>
				</div>
				<div className="tool-item">
					<i className="ti ti-copy" />
					<span>Duplicates</span>
					<span className="badge-pro">Pro</span>
				</div>
				<div className="tool-item">
					<i className="ti ti-file-zip" />
					<span>Compress</span>
					<span className="badge-pro">Pro</span>
				</div>
			</div>

			{ /* ── Storage ── */ }
			<div className="storage-card">
				<div className="storage-label">
					<span>Storage</span>
					<b>–</b>
				</div>
				<div className="storage-bar">
					<div
						className="storage-bar-fill"
						style={ { width: '0%' } }
					/>
				</div>
			</div>
		</aside>
	);
}

/* ── Recursive folder list ─────────────────────────────────── */
function FolderList( {
	folders,
	depth,
	openFolders,
	currentFolder,
	renamingId,
	onNavigate,
	onToggleOpen,
	onRename,
	onCancelRename,
	onStartRename,
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
			openFolders={ openFolders }
			currentFolder={ currentFolder }
			renamingId={ renamingId }
			onNavigate={ onNavigate }
			onToggleOpen={ onToggleOpen }
			onRename={ onRename }
			onCancelRename={ onCancelRename }
			onStartRename={ onStartRename }
			loadFolders={ loadFolders }
			loadMedia={ loadMedia }
			showToast={ showToast }
			dispatch={ dispatch }
		/>
	) );
}

/* ── Single folder item ────────────────────────────────────── */
function FolderItem( {
	folder: f,
	depth,
	openFolders,
	currentFolder,
	renamingId,
	onNavigate,
	onToggleOpen,
	onRename,
	onCancelRename,
	onStartRename,
	loadFolders,
	loadMedia,
	showToast,
	dispatch,
} ) {
	const isOpen = openFolders.has( f.id );
	const hasKids = f.children && f.children.length > 0;
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
		e.currentTarget.classList.remove( 'drag-over' );
		try {
			const raw = e.dataTransfer.getData( 'text/plain' );
			const data = JSON.parse( raw );
			if ( data.folderDrag ) {
				if ( data.folderId === f.id ) {
					return;
				}
				await post( `/folders/${ data.folderId }/move`, {
					parent: f.id,
				} );
				await loadFolders();
			} else if ( data.fileIds ) {
				await post( '/media/bulk-move', {
					ids: data.fileIds,
					folder_id: f.id,
				} );
				showToast(
					`Moved ${ data.fileIds.length } file${
						data.fileIds.length === 1 ? '' : 's'
					} to folder.`,
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
					e.currentTarget.classList.add( 'drag-over' );
				} }
				onDragLeave={ ( e ) =>
					e.currentTarget.classList.remove( 'drag-over' )
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
							color: 'var(--gray-300)',
							flexShrink: 0,
							cursor: 'pointer',
						} }
					/>
				) : (
					<span style={ { width: '14px', flexShrink: 0 } } />
				) }
				<i className="ti ti-folder" />
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
					<FolderList
						folders={ f.children }
						depth={ depth + 1 }
						openFolders={ openFolders }
						currentFolder={ currentFolder }
						renamingId={ renamingId }
						onNavigate={ onNavigate }
						onToggleOpen={ onToggleOpen }
						onRename={ onRename }
						onCancelRename={ onCancelRename }
						onStartRename={ onStartRename }
						loadFolders={ loadFolders }
						loadMedia={ loadMedia }
						showToast={ showToast }
						dispatch={ dispatch }
					/>
				</div>
			) }
		</>
	);
}
