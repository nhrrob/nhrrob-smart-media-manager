import { useState, useRef, useEffect } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { iconForMime } from '../utils';

const cfg = window.nhrsmmConfig || {};

export default function UploadModal() {
	const {
		dispatch,
		loadMedia,
		loadFolders,
		state: { uploadInitialFiles, folders },
	} = useApp();
	const [ queue, setQueue ] = useState( [] );
	const [ results, setResults ] = useState( { ok: 0, fail: 0 } );
	const [ done, setDone ] = useState( false );
	const fileInputRef = useRef( null );

	useEffect( () => {
		if ( uploadInitialFiles ) {
			addFiles( uploadInitialFiles );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	function close() {
		dispatch( { type: 'CLOSE_UPLOAD' } );
	}

	function onDone() {
		close();
		loadFolders();
		loadMedia();
	}

	function addFiles( files ) {
		const fileArr = Array.from( files );
		fileArr.forEach( ( file ) => {
			const id =
				'u-' +
				Date.now() +
				'-' +
				Math.random().toString( 36 ).slice( 2 );
			const icon = iconForMime( file.type );
			setQueue( ( prev ) => [
				...prev,
				{ id, name: file.name, icon, progress: 0, status: 'waiting' },
			] );
			uploadFile( file, id );
		} );
	}

	function updateItem( id, patch ) {
		setQueue( ( prev ) =>
			prev.map( ( item ) =>
				item.id === id ? { ...item, ...patch } : item
			)
		);
	}

	function uploadFile( file, itemId ) {
		const folderSel = document.getElementById( 'smm-upload-folder-select' );
		const folderId = folderSel ? parseInt( folderSel.value ) || 0 : 0;

		const formData = new FormData();
		formData.append( 'async-upload', file );
		formData.append( 'action', 'upload-attachment' );
		formData.append( '_wpnonce', cfg.mediaUploadNonce || '' );

		const xhr = new XMLHttpRequest();
		xhr.open( 'POST', ( cfg.adminUrl || '' ) + 'async-upload.php' );
		xhr.setRequestHeader( 'X-WP-Nonce', cfg.nonce || '' );

		xhr.upload.addEventListener( 'progress', ( e ) => {
			if ( e.lengthComputable ) {
				updateItem( itemId, {
					progress: Math.round( ( e.loaded / e.total ) * 100 ),
				} );
			}
		} );

		xhr.addEventListener( 'load', async () => {
			try {
				const data = JSON.parse( xhr.responseText );
				if ( xhr.status >= 400 || data?.success === false ) {
					throw new Error(
						data?.data?.message ||
							__( 'Upload failed', 'nhrrob-smart-media-manager' )
					);
				}
				const attachId = data?.data?.id || data?.id;
				if ( attachId && folderId ) {
					await fetch( `${ cfg.restUrl }/media/${ attachId }/move`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': cfg.nonce,
						},
						credentials: 'same-origin',
						body: JSON.stringify( { folder_id: folderId } ),
					} ).catch( () => {} );
				}
				updateItem( itemId, { progress: 100, status: 'ok' } );
				setResults( ( prev ) => ( { ...prev, ok: prev.ok + 1 } ) );
			} catch ( err ) {
				updateItem( itemId, { status: 'fail', error: err.message } );
				setResults( ( prev ) => ( { ...prev, fail: prev.fail + 1 } ) );
			}
			setDone( ( prev ) => prev );
		} );

		xhr.addEventListener( 'error', () => {
			updateItem( itemId, {
				status: 'fail',
				error: __( 'Network error', 'nhrrob-smart-media-manager' ),
			} );
			setResults( ( prev ) => ( { ...prev, fail: prev.fail + 1 } ) );
		} );

		xhr.send( formData );
	}

	useEffect( () => {
		if ( queue.length === 0 ) {
			return;
		}
		const allDone = queue.every(
			( item ) => item.status === 'ok' || item.status === 'fail'
		);
		setDone( allDone );
	}, [ queue ] );

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
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
		<div
			className="smm-modal-overlay"
			style={ { display: 'flex' } }
			onClick={ close }
		>
			{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
			<div className="smm-modal" onClick={ ( e ) => e.stopPropagation() }>
				<div className="modal-header">
					<span className="modal-title">
						<i className="ti ti-cloud-upload" />{ ' ' }
						{ __( 'Upload Files', 'nhrrob-smart-media-manager' ) }
					</span>
					<button className="btn-icon" onClick={ close }>
						<i className="ti ti-x" />
					</button>
				</div>

				<div className="modal-body">
					{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
					<div
						className="upload-dropzone"
						onClick={ () => fileInputRef.current?.click() }
						onDragOver={ ( e ) => {
							e.preventDefault();
							e.currentTarget.classList.add( 'drag-over' );
						} }
						onDragLeave={ ( e ) =>
							e.currentTarget.classList.remove( 'drag-over' )
						}
						onDrop={ ( e ) => {
							e.preventDefault();
							e.currentTarget.classList.remove( 'drag-over' );
							if ( e.dataTransfer.files.length ) {
								addFiles( e.dataTransfer.files );
							}
						} }
					>
						<div className="dropzone-inner">
							<i className="ti ti-cloud-upload dropzone-icon" />
							<p className="dropzone-title">
								{ __(
									'Drop files here',
									'nhrrob-smart-media-manager'
								) }
							</p>
							<p className="dropzone-sub">
								{ __(
									'or click to browse',
									'nhrrob-smart-media-manager'
								) }
							</p>
							<input
								ref={ fileInputRef }
								type="file"
								multiple
								style={ { display: 'none' } }
								onChange={ ( e ) => {
									if ( e.target.files.length ) {
										addFiles( e.target.files );
									}
									e.target.value = '';
								} }
							/>
							<button
								className="btn btn-default"
								onClick={ ( e ) => {
									e.stopPropagation();
									fileInputRef.current?.click();
								} }
							>
								<i className="ti ti-upload" />{ ' ' }
								{ __(
									'Browse Files',
									'nhrrob-smart-media-manager'
								) }
							</button>
						</div>
					</div>

					<div
						className="upload-options"
						style={ { marginTop: '12px' } }
					>
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="smm-label">
							{ __(
								'Upload to folder',
								'nhrrob-smart-media-manager'
							) }
						</label>
						<select
							className="smm-select"
							id="smm-upload-folder-select"
						>
							<option value="0">
								{ __(
									'Uncategorized',
									'nhrrob-smart-media-manager'
								) }
							</option>
							{ renderFolderOptions( folders ) }
						</select>
					</div>

					{ queue.length > 0 && (
						<div
							className="upload-queue"
							style={ { display: 'block' } }
						>
							{ queue.map( ( item ) => {
								let statusSuffix = '';
								if ( item.status === 'ok' ) {
									statusSuffix = ' success';
								} else if ( item.status === 'fail' ) {
									statusSuffix = ' error';
								}
								return (
									<div
										key={ item.id }
										className="upload-item"
									>
										<i
											className={ `ti ${ item.icon } upload-item-icon` }
										/>
										<div className="upload-item-info">
											<div className="upload-item-name">
												{ item.name }
											</div>
											{ item.status !== 'fail' && (
												<div className="upload-progress-bar">
													<div
														className="upload-progress-fill"
														style={ {
															width: `${ item.progress }%`,
														} }
													/>
												</div>
											) }
											{ item.status === 'fail' &&
												item.error && (
													<div className="upload-item-error">
														{ item.error }
													</div>
												) }
										</div>
										<span
											className={ `upload-item-status${ statusSuffix }` }
										>
											{ item.status === 'ok' && (
												<i className="ti ti-circle-check" />
											) }
											{ item.status === 'fail' && (
												<i className="ti ti-circle-x" />
											) }
											{ item.status === 'waiting' && (
												<span className="upload-waiting-text">
													{ __(
														'Waiting…',
														'nhrrob-smart-media-manager'
													) }
												</span>
											) }
										</span>
									</div>
								);
							} ) }
						</div>
					) }
				</div>

				{ done && (
					<div className="modal-footer" style={ { display: 'flex' } }>
						<span className="upload-summary">
							{ results.fail > 0 ? (
								<span
									className="smm-notice smm-notice-warning"
									style={ {
										padding: '4px 8px',
										borderRadius: '4px',
									} }
								>
									{ sprintf(
										// translators: %1$d: uploaded count, %2$d: failed count
										__(
											'%1$d uploaded, %2$d failed',
											'nhrrob-smart-media-manager'
										),
										results.ok,
										results.fail
									) }
								</span>
							) : (
								<span
									className="smm-notice smm-notice-success"
									style={ {
										padding: '4px 8px',
										borderRadius: '4px',
									} }
								>
									{ sprintf(
										// translators: %d: number of uploaded files
										_n(
											'%d file uploaded successfully',
											'%d files uploaded successfully',
											results.ok,
											'nhrrob-smart-media-manager'
										),
										results.ok
									) }
								</span>
							) }
						</span>
						<button className="btn btn-default" onClick={ onDone }>
							{ __( 'Done', 'nhrrob-smart-media-manager' ) }
						</button>
					</div>
				) }
			</div>
		</div>
	);
}
