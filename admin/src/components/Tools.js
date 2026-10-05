import { useState, useEffect, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useApp } from '../context';
import { get, post } from '../api';
import { buildZip, saveBlob } from '../utils';

export default function ToolModal() {
	const { state } = useApp();
	const { modal } = state;

	switch ( modal?.kind ) {
		case 'import':
			return <ImportModal />;
		case 'bulk-edit':
			return <BulkEditModal ids={ modal.ids } />;
		case 'bulk-ai':
			return <BulkAiModal ids={ modal.ids } />;
		case 'zip':
			return <ZipModal { ...modal } />;
		case 'scan':
			return <ScanModal />;
		default:
			return null;
	}
}

function Shell( { title, icon, children, footer, onClose } ) {
	const { dispatch } = useApp();
	const close = onClose || ( () => dispatch( { type: 'CLOSE_MODAL' } ) );

	return (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
		<div
			className="smm-modal-overlay"
			style={ { display: 'flex' } }
			onClick={ close }
		>
			{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
			<div
				className="smm-modal smm-modal-sm"
				onClick={ ( e ) => e.stopPropagation() }
			>
				<div className="modal-header">
					<span className="modal-title">
						<i className={ `ti ${ icon }` } /> { title }
					</span>
					<button className="btn-icon" onClick={ close }>
						<i className="ti ti-x" />
					</button>
				</div>
				<div className="modal-body">{ children }</div>
				{ footer && <div className="modal-footer">{ footer }</div> }
			</div>
		</div>
	);
}

function Progress( { done, total } ) {
	const pct = total ? Math.round( ( done / total ) * 100 ) : 0;
	return (
		<div className="tool-progress">
			<div className="tool-progress-bar">
				<span style={ { width: `${ pct }%` } } />
			</div>
			<span className="tool-progress-label">
				{ done } / { total }
			</span>
		</div>
	);
}

function ImportModal() {
	const { loadFolders, loadMedia, showToast } = useApp();
	const [ sources, setSources ] = useState( null );
	const [ running, setRunning ] = useState( null );
	const [ files, setFiles ] = useState( 0 );

	useEffect( () => {
		get( '/import/sources' )
			.then( setSources )
			.catch( () => setSources( [] ) );
	}, [] );

	async function run( key ) {
		setRunning( key );
		setFiles( 0 );
		let offset = 0;
		let total = 0;
		try {
			while ( offset !== null ) {
				const res = await post( '/import', { source: key, offset } );
				total += res.files;
				setFiles( total );
				offset = res.next;
			}
			await loadFolders();
			loadMedia();
			showToast(
				sprintf(
					// translators: %d: number of files assigned to folders
					_n(
						'Import finished: %d file assigned.',
						'Import finished: %d files assigned.',
						total,
						'nhrrob-smart-media-manager'
					),
					total
				),
				'success'
			);
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
		setRunning( null );
	}

	return (
		<Shell
			title={ __(
				'Import from another plugin',
				'nhrrob-smart-media-manager'
			) }
			icon="ti-plug"
		>
			<p className="tool-help">
				{ __(
					'Copies the folder structure and file assignments of another media folder plugin. The other plugin’s data is not changed, and existing folders with the same name are reused.',
					'nhrrob-smart-media-manager'
				) }
			</p>
			{ sources === null && <span className="smm-spinner-sm" /> }
			{ sources !== null && sources.length === 0 && (
				<p className="details-section-empty">
					{ __(
						'No folders from other plugins were found on this site.',
						'nhrrob-smart-media-manager'
					) }
				</p>
			) }
			{ ( sources || [] ).map( ( src ) => (
				<div key={ src.key } className="tool-row">
					<span>
						<strong>{ src.label }</strong>{ ' ' }
						<span className="tool-muted">
							{ sprintf(
								// translators: %d: number of folders
								_n(
									'%d folder',
									'%d folders',
									src.folders,
									'nhrrob-smart-media-manager'
								),
								src.folders
							) }
						</span>
					</span>
					<button
						className="btn btn-sm btn-primary"
						disabled={ running !== null }
						onClick={ () => run( src.key ) }
					>
						{ running === src.key
							? sprintf(
									// translators: %d: number of files processed so far
									__(
										'%d files…',
										'nhrrob-smart-media-manager'
									),
									files
							  )
							: __( 'Import', 'nhrrob-smart-media-manager' ) }
					</button>
				</div>
			) ) }
		</Shell>
	);
}

function BulkEditModal( { ids } ) {
	const { dispatch, loadMedia, loadFolders, showToast } = useApp();
	const [ data, setData ] = useState( {
		title: '',
		alt: '',
		caption: '',
		description: '',
	} );
	const [ saving, setSaving ] = useState( false );

	const fields = [
		[ 'title', __( 'Title', 'nhrrob-smart-media-manager' ) ],
		[ 'alt', __( 'Alt Text', 'nhrrob-smart-media-manager' ) ],
		[ 'caption', __( 'Caption', 'nhrrob-smart-media-manager' ) ],
		[ 'description', __( 'Description', 'nhrrob-smart-media-manager' ) ],
	];

	async function save() {
		setSaving( true );
		try {
			const res = await post( '/media/bulk-update', { ids, data } );
			showToast(
				sprintf(
					// translators: %d: number of updated files
					_n(
						'Updated %d file.',
						'Updated %d files.',
						res.updated,
						'nhrrob-smart-media-manager'
					),
					res.updated
				),
				'success'
			);
			dispatch( { type: 'CLOSE_MODAL' } );
			await loadFolders();
			loadMedia();
		} catch ( e ) {
			showToast( e.message, 'danger' );
			setSaving( false );
		}
	}

	return (
		<Shell
			title={ sprintf(
				// translators: %d: number of selected files
				_n(
					'Edit %d file',
					'Edit %d files',
					ids.length,
					'nhrrob-smart-media-manager'
				),
				ids.length
			) }
			icon="ti-edit"
			footer={
				<>
					<button
						className="btn btn-default"
						onClick={ () => dispatch( { type: 'CLOSE_MODAL' } ) }
					>
						{ __( 'Cancel', 'nhrrob-smart-media-manager' ) }
					</button>
					<button
						className="btn btn-primary"
						disabled={
							saving ||
							! Object.values( data ).some( ( v ) => v.trim() )
						}
						onClick={ save }
					>
						{ __( 'Apply', 'nhrrob-smart-media-manager' ) }
					</button>
				</>
			}
		>
			<p className="tool-help">
				{ __(
					'Fields you leave empty are not changed. Alt text is applied to images only.',
					'nhrrob-smart-media-manager'
				) }
			</p>
			{ fields.map( ( [ key, label ] ) => (
				// eslint-disable-next-line jsx-a11y/label-has-associated-control
				<label key={ key } className="tool-field">
					<span>{ label }</span>
					<input
						type="text"
						className="details-input"
						value={ data[ key ] }
						onChange={ ( e ) =>
							setData( { ...data, [ key ]: e.target.value } )
						}
					/>
				</label>
			) ) }
		</Shell>
	);
}

// Generates alt text for the given images, or for every image missing alt text when ids is omitted.
function BulkAiModal( { ids } ) {
	const { dispatch, loadMedia, loadFolders, state } = useApp();
	const [ done, setDone ] = useState( 0 );
	const [ failed, setFailed ] = useState( 0 );
	const [ total, setTotal ] = useState( ids ? ids.length : null );
	const [ finished, setFinished ] = useState( false );
	const [ error, setError ] = useState( null );
	const stopRef = useRef( false );
	const startedRef = useRef( false );

	useEffect( () => {
		if ( startedRef.current ) {
			return;
		}
		startedRef.current = true;

		async function generate( id ) {
			try {
				await post( '/ai/generate', {
					attachment_id: id,
					field: 'alt',
					save: true,
				} );
				setDone( ( n ) => n + 1 );
				return true;
			} catch ( e ) {
				setFailed( ( n ) => n + 1 );
				// A missing provider or rate limit will fail for every file; stop early.
				if ( e.code === 'no_ai_provider' || e.status === 429 ) {
					setError( e.message );
					stopRef.current = true;
				}
				return false;
			}
		}

		async function run() {
			if ( ids ) {
				for ( const id of ids ) {
					if ( stopRef.current ) {
						break;
					}
					await generate( id );
				}
			} else {
				const skip = new Set();
				let count = null;
				while ( ! stopRef.current ) {
					const res = await get(
						'/media?alt=missing&per_page=100&orderby=date&order=DESC'
					);
					if ( count === null ) {
						count = res.total;
						setTotal( res.total );
					}
					// Saved images drop out of this list; failed ones stay, so skip them.
					const batch = res.items.filter(
						( f ) => ! skip.has( f.id )
					);
					if ( ! batch.length ) {
						break;
					}
					for ( const f of batch ) {
						if ( stopRef.current ) {
							break;
						}
						if ( ! ( await generate( f.id ) ) ) {
							skip.add( f.id );
						}
					}
				}
			}
			setFinished( true );
			await loadFolders();
			loadMedia();
		}
		run().catch( ( e ) => {
			setError( e.message );
			setFinished( true );
		} );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	function close() {
		stopRef.current = true;
		dispatch( { type: 'CLOSE_MODAL' } );
		if ( ids && state.selection.size ) {
			dispatch( { type: 'CLEAR_SELECTION' } );
		}
	}

	return (
		<Shell
			title={ __( 'Generate alt text', 'nhrrob-smart-media-manager' ) }
			icon="ti-sparkles"
			onClose={ close }
			footer={
				<button className="btn btn-default" onClick={ close }>
					{ finished
						? __( 'Close', 'nhrrob-smart-media-manager' )
						: __( 'Stop', 'nhrrob-smart-media-manager' ) }
				</button>
			}
		>
			<p className="tool-help">
				{ __(
					'Each image is sent to your configured AI provider and the result is saved as its alt text. Keep this window open until it finishes.',
					'nhrrob-smart-media-manager'
				) }
			</p>
			{ total === null ? (
				<span className="smm-spinner-sm" />
			) : (
				<Progress done={ done + failed } total={ total } />
			) }
			{ failed > 0 && (
				<p className="tool-muted">
					{ sprintf(
						// translators: %d: number of images that could not be processed
						_n(
							'%d image failed.',
							'%d images failed.',
							failed,
							'nhrrob-smart-media-manager'
						),
						failed
					) }
				</p>
			) }
			{ error && (
				<div className="smm-notice smm-notice-danger">
					<i className="ti ti-alert-circle" /> { error }
				</div>
			) }
		</Shell>
	);
}

// Downloads the given files (or a folder with its subfolders) as one ZIP built in the browser.
function ZipModal( { files, folderId, name } ) {
	const { dispatch, showToast } = useApp();
	const [ progress, setProgress ] = useState( { done: 0, total: 0 } );
	const startedRef = useRef( false );

	useEffect( () => {
		if ( startedRef.current ) {
			return;
		}
		startedRef.current = true;

		( async () => {
			try {
				const list =
					files || ( await get( `/folders/${ folderId }/files` ) );
				if ( ! list.length ) {
					throw new Error(
						__(
							'There are no files to download.',
							'nhrrob-smart-media-manager'
						)
					);
				}
				setProgress( { done: 0, total: list.length } );
				const blob = await buildZip( list, ( done, total ) =>
					setProgress( { done, total } )
				);
				saveBlob( blob, ( name || 'media' ) + '.zip' );
			} catch ( e ) {
				showToast( e.message, 'danger' );
			}
			dispatch( { type: 'CLOSE_MODAL' } );
		} )();
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Shell
			title={ __( 'Preparing ZIP…', 'nhrrob-smart-media-manager' ) }
			icon="ti-file-zip"
		>
			<Progress done={ progress.done } total={ progress.total } />
		</Shell>
	);
}

function ScanModal() {
	const { dispatch, loadMedia, showToast } = useApp();
	const [ progress, setProgress ] = useState( { done: 0, total: 0 } );
	const stopRef = useRef( false );
	const startedRef = useRef( false );

	useEffect( () => {
		if ( startedRef.current ) {
			return;
		}
		startedRef.current = true;

		( async () => {
			let after = 0;
			let done = 0;
			let total = 0;
			let unused = 0;
			try {
				while ( ! stopRef.current ) {
					const res = await post( '/media/scan-unused', { after } );
					total = res.total ?? total;
					done += res.processed;
					unused += res.unused;
					after = res.last_id;
					setProgress( { done, total } );
					if ( res.done ) {
						break;
					}
				}
				showToast(
					sprintf(
						// translators: %d: number of files with no known use
						_n(
							'Scan finished: %d file looks unused.',
							'Scan finished: %d files look unused.',
							unused,
							'nhrrob-smart-media-manager'
						),
						unused
					),
					'success'
				);
			} catch ( e ) {
				showToast( e.message, 'danger' );
			}
			dispatch( { type: 'CLOSE_MODAL' } );
			loadMedia();
		} )();
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Shell
			title={ __( 'Scanning library…', 'nhrrob-smart-media-manager' ) }
			icon="ti-unlink"
			onClose={ () => {
				stopRef.current = true;
			} }
		>
			<Progress done={ progress.done } total={ progress.total } />
		</Shell>
	);
}
