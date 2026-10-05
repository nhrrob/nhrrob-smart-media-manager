import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { post } from '../api';

export default function BulkBar() {
	const {
		state,
		dispatch,
		loadMedia,
		loadFolders,
		showToast,
		deleteSelected,
		cfg,
	} = useApp();
	const { selection, folders, files, specialView } = state;
	const inTrash = specialView === 'trash';
	const [ selectedFolder, setSelectedFolder ] = useState( '' );

	function openModal( modal ) {
		dispatch( { type: 'OPEN_MODAL', modal } );
	}

	async function restoreSelected() {
		try {
			await post( '/media/bulk-restore', { ids: [ ...selection ] } );
			dispatch( { type: 'CLEAR_SELECTION' } );
			await loadFolders();
			loadMedia();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	async function moveSelected( mode = 'move' ) {
		if ( ! selectedFolder ) {
			return;
		}
		const folderId = parseInt( selectedFolder );
		const ids = [ ...selection ];
		try {
			const res = await post( '/media/bulk-move', {
				ids,
				folder_id: folderId,
				mode,
			} );
			showToast(
				sprintf(
					// translators: %d: number of moved files
					_n(
						'Moved %d file.',
						'Moved %d files.',
						res.moved,
						'nhrrob-smart-media-manager'
					),
					res.moved
				),
				'success'
			);
			dispatch( { type: 'CLEAR_SELECTION' } );
			setSelectedFolder( '' );
			await loadFolders();
			loadMedia();
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	function renderFolderOptions( folderList, indent = '' ) {
		return folderList.flatMap( ( f ) => [
			<option key={ f.id } value={ f.id }>
				{ indent + f.name }
			</option>,
			...( f.children?.length
				? renderFolderOptions( f.children, indent + '  ' )
				: [] ),
		] );
	}

	return (
		<div className="smm-bulk-bar" style={ { display: 'flex' } }>
			<span className="bulk-count">
				{ sprintf(
					// translators: %d: number of selected files
					_n(
						'%d file selected',
						'%d files selected',
						selection.size,
						'nhrrob-smart-media-manager'
					),
					selection.size
				) }
			</span>

			{ inTrash ? (
				<div className="bulk-actions">
					<button
						className="btn btn-sm btn-white"
						onClick={ restoreSelected }
					>
						<i className="ti ti-restore" />{ ' ' }
						{ __( 'Restore', 'nhrrob-smart-media-manager' ) }
					</button>
					<button
						className="btn btn-sm btn-danger"
						onClick={ deleteSelected }
					>
						<i className="ti ti-trash" />{ ' ' }
						{ __(
							'Delete Permanently',
							'nhrrob-smart-media-manager'
						) }
					</button>
				</div>
			) : (
				<div className="bulk-actions">
					<select
						className="smm-select smm-select-sm"
						value={ selectedFolder }
						onChange={ ( e ) =>
							setSelectedFolder( e.target.value )
						}
					>
						<option value="">
							{ __( 'Folder…', 'nhrrob-smart-media-manager' ) }
						</option>
						{ renderFolderOptions( folders ) }
					</select>

					<button
						className="btn btn-sm btn-white"
						disabled={ ! selectedFolder }
						onClick={ () => moveSelected( 'move' ) }
					>
						<i className="ti ti-arrows-move" />{ ' ' }
						{ __( 'Move', 'nhrrob-smart-media-manager' ) }
					</button>

					<button
						className="btn btn-sm btn-white"
						disabled={ ! selectedFolder }
						title={ __(
							'Add to this folder and keep the current ones',
							'nhrrob-smart-media-manager'
						) }
						onClick={ () => moveSelected( 'add' ) }
					>
						<i className="ti ti-folder-plus" />{ ' ' }
						{ __( 'Add', 'nhrrob-smart-media-manager' ) }
					</button>

					<button
						className="btn btn-sm btn-white"
						onClick={ () =>
							openModal( {
								kind: 'bulk-edit',
								ids: [ ...selection ],
							} )
						}
					>
						<i className="ti ti-edit" />{ ' ' }
						{ __( 'Edit', 'nhrrob-smart-media-manager' ) }
					</button>

					{ cfg.aiConfigured && (
						<button
							className="btn btn-sm btn-white"
							onClick={ () =>
								openModal( {
									kind: 'bulk-ai',
									ids: files
										.filter(
											( f ) =>
												selection.has( f.id ) &&
												f.type === 'image'
										)
										.map( ( f ) => f.id ),
								} )
							}
						>
							<i className="ti ti-sparkles" />{ ' ' }
							{ __( 'Alt text', 'nhrrob-smart-media-manager' ) }
						</button>
					) }

					<button
						className="btn btn-sm btn-white"
						onClick={ () =>
							openModal( {
								kind: 'zip',
								files: files
									.filter( ( f ) => selection.has( f.id ) )
									.map( ( f ) => ( {
										url: f.url,
										path: f.filename,
									} ) ),
							} )
						}
					>
						<i className="ti ti-file-zip" />{ ' ' }
						{ __( 'ZIP', 'nhrrob-smart-media-manager' ) }
					</button>

					<button
						className="btn btn-sm btn-danger"
						onClick={ deleteSelected }
					>
						<i className="ti ti-trash" />{ ' ' }
						{ __( 'Trash', 'nhrrob-smart-media-manager' ) }
					</button>
				</div>
			) }

			<button
				className="btn-icon"
				style={ { color: 'rgba(255,255,255,0.7)' } }
				onClick={ () => dispatch( { type: 'CLEAR_SELECTION' } ) }
			>
				<i className="ti ti-x" />
			</button>
		</div>
	);
}
