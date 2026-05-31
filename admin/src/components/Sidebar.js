import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
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
	const {
		folders,
		currentFolder,
		uncategorizedCount,
		recentView,
		starredView,
		starredIds,
	} = state;
	const starredCount = starredIds.size;
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

	function clearRecent( e ) {
		e.stopPropagation();
		localStorage.removeItem( 'nhrsmm_recent_ids' );
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

	function sumCount( arr ) {
		return arr.reduce(
			( acc, f ) => acc + ( f.count || 0 ) + sumCount( f.children || [] ),
			0
		);
	}
	const totalCount = sumCount( folders ) + uncategorizedCount;

	return (
		<aside className="smm-sidebar" id="smm-sidebar">
			<div className="sidebar-section">
				<div className="sidebar-section-label">
					<i className="ti ti-layout-grid" />
					{ __( 'Library', 'nhrrob-smart-media-manager' ) }
				</div>

				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className={ `nav-item${
						currentFolder === null && ! recentView && ! starredView
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
							folders={ folders }
							depth={ 0 }
							openFolders={ openFolders }
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

function FolderItem( {
	folder: f,
	depth,
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
				{ depth === 0 ? (
					<span className={ `folder-dot folder-dot-${ f.id % 7 }` } />
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
