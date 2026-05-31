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
	} = useApp();
	const { selection, folders } = state;
	const [ selectedFolder, setSelectedFolder ] = useState( '' );

	async function moveSelected() {
		if ( ! selectedFolder ) {
			return;
		}
		const folderId = parseInt( selectedFolder );
		const ids = [ ...selection ];
		try {
			const res = await post( '/media/bulk-move', {
				ids,
				folder_id: folderId,
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

			<div className="bulk-actions">
				<select
					className="smm-select smm-select-sm"
					value={ selectedFolder }
					onChange={ ( e ) => setSelectedFolder( e.target.value ) }
				>
					<option value="">
						{ __(
							'Move to folder…',
							'nhrrob-smart-media-manager'
						) }
					</option>
					{ renderFolderOptions( folders ) }
				</select>

				<button
					className="btn btn-sm btn-white"
					disabled={ ! selectedFolder }
					onClick={ moveSelected }
				>
					<i className="ti ti-arrows-move" />{ ' ' }
					{ __( 'Move', 'nhrrob-smart-media-manager' ) }
				</button>

				<button
					className="btn btn-sm btn-danger"
					onClick={ deleteSelected }
				>
					<i className="ti ti-trash" />{ ' ' }
					{ __( 'Delete', 'nhrrob-smart-media-manager' ) }
				</button>
			</div>

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
