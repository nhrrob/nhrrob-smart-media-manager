import { useEffect, useRef, createPortal } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { del } from '../api';
import { copyToClipboard } from '../utils';

export function ConfirmModal() {
	const { state, dispatch } = useApp();
	const { confirmModal } = state;

	function cancel() {
		dispatch( { type: 'HIDE_CONFIRM' } );
	}

	function confirm() {
		dispatch( { type: 'HIDE_CONFIRM' } );
		if ( confirmModal?.onOk ) {
			confirmModal.onOk();
		}
	}

	return createPortal(
		<div className="nhrsmm">
			{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
			<div
				className="smm-modal-overlay"
				style={ { display: 'flex' } }
				onClick={ cancel }
			>
				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
				<div
					className="smm-modal smm-modal-sm"
					onClick={ ( e ) => e.stopPropagation() }
				>
					<div className="modal-header">
						<span
							className="modal-title"
							style={ { color: 'var(--color-danger)' } }
						>
							<i className="ti ti-alert-circle" />{ ' ' }
							{ __(
								'Confirm Delete',
								'nhrrob-smart-media-manager'
							) }
						</span>
					</div>
					<div className="modal-body">
						<p>{ confirmModal?.message }</p>
					</div>
					<div className="modal-footer">
						<button className="btn btn-default" onClick={ cancel }>
							{ __( 'Cancel', 'nhrrob-smart-media-manager' ) }
						</button>
						<button
							className="btn btn-danger-solid"
							onClick={ confirm }
						>
							{ __( 'Delete', 'nhrrob-smart-media-manager' ) }
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}

export function ContextMenus() {
	const { state } = useApp();
	const { contextMenu } = state;
	if ( ! contextMenu ) {
		return null;
	}

	const style = {
		position: 'fixed',
		left: contextMenu.x,
		top: contextMenu.y,
	};

	if ( contextMenu.kind === 'folder' ) {
		return createPortal(
			<div className="nhrsmm">
				<FolderCtxMenu id={ contextMenu.id } style={ style } />
			</div>,
			document.body
		);
	}

	return createPortal(
		<div className="nhrsmm">
			<FileCtxMenu id={ contextMenu.id } style={ style } />
		</div>,
		document.body
	);
}

function FolderCtxMenu( { id, style } ) {
	const { dispatch, showToast, showConfirm, loadFolders, loadMedia, state } =
		useApp();

	function close() {
		dispatch( { type: 'HIDE_CONTEXT_MENUS' } );
	}

	async function handleAction( action ) {
		close();
		if ( action === 'rename' ) {
			document.dispatchEvent(
				new CustomEvent( 'nhrsmm:rename-folder', { detail: id } )
			);
		} else if ( action === 'subfolder' ) {
			document.dispatchEvent(
				new CustomEvent( 'nhrsmm:start-subfolder', { detail: id } )
			);
		} else if ( action === 'delete' ) {
			showConfirm(
				__(
					'Delete this folder? Files inside will become Uncategorized.',
					'nhrrob-smart-media-manager'
				),
				async () => {
					try {
						await del( `/folders/${ id }` );
						if ( state.currentFolder === id ) {
							dispatch( { type: 'SET_FOLDER', folder: null } );
							loadMedia();
						}
						await loadFolders();
					} catch ( e ) {
						showToast( e.message, 'danger' );
					}
				}
			);
		}
	}

	return (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
		<div
			className="smm-context-menu"
			style={ style }
			onClick={ ( e ) => e.stopPropagation() }
		>
			<button
				className="ctx-item"
				onClick={ () => handleAction( 'rename' ) }
			>
				<i className="ti ti-edit" />{ ' ' }
				{ __( 'Rename', 'nhrrob-smart-media-manager' ) }
			</button>
			<button
				className="ctx-item"
				onClick={ () => handleAction( 'subfolder' ) }
			>
				<i className="ti ti-folder-plus" />{ ' ' }
				{ __( 'New Subfolder', 'nhrrob-smart-media-manager' ) }
			</button>
			<div className="ctx-sep" />
			<button
				className="ctx-item ctx-danger"
				onClick={ () => handleAction( 'delete' ) }
			>
				<i className="ti ti-trash" />{ ' ' }
				{ __( 'Delete', 'nhrrob-smart-media-manager' ) }
			</button>
		</div>
	);
}

function FileCtxMenu( { id, style } ) {
	const { dispatch, showToast, showConfirm, loadFolders, loadMedia, state } =
		useApp();

	function close() {
		dispatch( { type: 'HIDE_CONTEXT_MENUS' } );
	}

	async function handleAction( action ) {
		close();
		if ( action === 'copy-url' ) {
			const file = state.files.find( ( f ) => f.id === id );
			if ( file ) {
				await copyToClipboard( file.url );
				showToast(
					__( 'URL copied!', 'nhrrob-smart-media-manager' ),
					'success'
				);
			}
		} else if ( action === 'delete' ) {
			showConfirm(
				__(
					'Delete this file? This cannot be undone.',
					'nhrrob-smart-media-manager'
				),
				async () => {
					try {
						await del( '/media/bulk-delete', { ids: [ id ] } );
						showToast(
							__( 'File deleted.', 'nhrrob-smart-media-manager' ),
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
		} else if ( action === 'move' ) {
			// Don't re-select: SELECT_FILE(single) toggles off when already selected (reducer clears sel.size===1).
			setTimeout( () => {
				const sel = document.getElementById(
					'smm-details-folder-select'
				);
				if ( sel ) {
					sel.focus();
					sel.scrollIntoView( {
						behavior: 'smooth',
						block: 'center',
					} );
				}
			}, 80 );
		}
	}

	return (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
		<div
			className="smm-context-menu"
			style={ style }
			onClick={ ( e ) => e.stopPropagation() }
		>
			<button
				className="ctx-item"
				onClick={ () => handleAction( 'copy-url' ) }
			>
				<i className="ti ti-copy" />{ ' ' }
				{ __( 'Copy URL', 'nhrrob-smart-media-manager' ) }
			</button>
			<button
				className="ctx-item"
				onClick={ () => handleAction( 'move' ) }
			>
				<i className="ti ti-arrows-move" />{ ' ' }
				{ __( 'Move to Folder', 'nhrrob-smart-media-manager' ) }
			</button>
			<div className="ctx-sep" />
			<button
				className="ctx-item ctx-danger"
				onClick={ () => handleAction( 'delete' ) }
			>
				<i className="ti ti-trash" />{ ' ' }
				{ __( 'Delete', 'nhrrob-smart-media-manager' ) }
			</button>
		</div>
	);
}

export function Toast() {
	const { state, dispatch } = useApp();
	const { toast } = state;
	const timerRef = useRef( null );

	useEffect( () => {
		clearTimeout( timerRef.current );
		timerRef.current = setTimeout(
			() => dispatch( { type: 'HIDE_TOAST' } ),
			2800
		);
		return () => clearTimeout( timerRef.current );
	}, [ toast?.id, dispatch ] );

	if ( ! toast ) {
		return null;
	}

	const iconMap = {
		info: 'ti-info-circle',
		success: 'ti-circle-check',
		warning: 'ti-alert-triangle',
		danger: 'ti-alert-circle',
	};

	const wrapStyle = {
		position: 'fixed',
		bottom: '20px',
		left: '50%',
		zIndex: 999999,
		minWidth: '220px',
		maxWidth: '400px',
		animation: 'toastIn 0.22s ease forwards',
	};

	const noticeStyle = {
		boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
		borderRadius: '8px',
		margin: 0,
	};

	return createPortal(
		<div className="nhrsmm" style={ wrapStyle }>
			<div
				className={ `smm-notice smm-notice-${ toast.kind }` }
				style={ noticeStyle }
			>
				<i
					className={ `ti ${
						iconMap[ toast.kind ] || 'ti-info-circle'
					}` }
				/>{ ' ' }
				{ toast.message }
			</div>
		</div>,
		document.body
	);
}

export function StatusBar() {
	const { state, cfg } = useApp();
	const total = state.pagination.total;
	const sel = state.selection.size;

	return (
		<div className="smm-statusbar" id="smm-statusbar">
			<span className="status-count">
				{ state.loading
					? __( 'Loading…', 'nhrrob-smart-media-manager' )
					: sprintf(
							// translators: %d: total number of files
							_n(
								'%d file',
								'%d files',
								total,
								'nhrrob-smart-media-manager'
							),
							total
					  ) }
			</span>
			{ sel > 0 && (
				<>
					<span className="status-sep">·</span>
					<span>
						{ sprintf(
							// translators: %d: number of selected files
							__( '%d selected', 'nhrrob-smart-media-manager' ),
							sel
						) }
					</span>
				</>
			) }
			<div className="status-right">
				{ cfg.aiConfigured && (
					<span className="ai-dot">
						{ sprintf(
							// translators: %s: AI provider name
							__( '%s Connected', 'nhrrob-smart-media-manager' ),
							cfg.aiProvider ||
								__( 'AI', 'nhrrob-smart-media-manager' )
						) }
					</span>
				) }
				<span className="status-sep">·</span>
				<span className="status-version">v{ cfg.version }</span>
			</div>
		</div>
	);
}
