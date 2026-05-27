import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { useApp } from '../context';
import { get, put, post } from '../api';
import { formatBytes, formatDate, typeToIcon, copyToClipboard } from '../utils';

const cfg = window.nhrsmmConfig || {};

export default function DetailsPanel( { fileId } ) {
	const { dispatch, state, loadMedia, loadFolders, showToast } = useApp();
	const { folders } = state;

	const [ file, setFile ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ usage, setUsage ] = useState( null );

	// Editable fields
	const [ title, setTitle ] = useState( '' );
	const [ alt, setAlt ] = useState( '' );
	const [ caption, setCaption ] = useState( '' );
	const [ desc, setDesc ] = useState( '' );
	const [ folder, setFolder ] = useState( 0 );

	// AI state: null | 'loading' | { altText, chars, model, latency } | { error, errorType }
	const [ aiState, setAiState ] = useState( null );
	const saveTimerRef = useRef( null );
	const folderSelectRef = useRef( null );

	/* ── Load file details ─────────────────────────────────── */
	useEffect( () => {
		setLoading( true );
		setError( null );
		setFile( null );
		setAiState( null );
		setUsage( null );

		get( `/media/${ fileId }` )
			.then( ( data ) => {
				setFile( data );
				setTitle( data.title || '' );
				setAlt( data.alt || '' );
				setCaption( data.caption || '' );
				setDesc( data.description || '' );
				setFolder( data.folder_id || 0 );
				setLoading( false );
			} )
			.catch( ( e ) => {
				setError( e.message );
				setLoading( false );
			} );

		get( `/media/${ fileId }/usage` )
			.then( setUsage )
			.catch( () => setUsage( [] ) );
	}, [ fileId ] );

	/* ── Focus folder select on request ─────────────────────── */
	useEffect( () => {
		function handler( e ) {
			if ( e.type === 'nhrsmm:focus-folder-select' ) {
				folderSelectRef.current?.focus();
			}
		}
		document.addEventListener( 'nhrsmm:focus-folder-select', handler );
		return () =>
			document.removeEventListener(
				'nhrsmm:focus-folder-select',
				handler
			);
	}, [] );

	/* ── Auto-save ───────────────────────────────────────────── */
	const scheduleSave = useCallback( () => {
		clearTimeout( saveTimerRef.current );
		saveTimerRef.current = setTimeout( async () => {
			const body = { title, caption, description: desc };
			if ( file?.type === 'image' ) {
				body.alt = alt;
			}
			try {
				await put( `/media/${ fileId }`, body );
			} catch ( e ) {
				showToast( 'Save failed: ' + e.message, 'danger' );
			}
		}, 800 );
	}, [ fileId, title, alt, caption, desc, file?.type, showToast ] );

	/* ── Folder change ───────────────────────────────────────── */
	async function onFolderChange( val ) {
		const folderId = parseInt( val );
		setFolder( folderId );
		try {
			await post( `/media/${ fileId }/move`, { folder_id: folderId } );
			await loadFolders();
			loadMedia();
			showToast( 'Moved to folder.', 'success' );
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	/* ── AI alt text ─────────────────────────────────────────── */
	async function generateAlt() {
		if ( ! cfg.aiConfigured ) {
			showToast(
				'No AI provider configured. Go to Settings → Connectors.',
				'warning'
			);
			return;
		}
		setAiState( 'loading' );
		try {
			const res = await post( '/ai/alt-text', { attachment_id: fileId } );
			setAiState( {
				altText: res.alt_text,
				chars: res.chars || res.alt_text.length,
				model: res.model,
				latency: res.latency,
			} );
		} catch ( e ) {
			const errorType = e.status === 429 ? 'warning' : 'danger';
			setAiState( { error: e.message, errorType } );
		}
	}

	function acceptAlt() {
		if ( aiState?.altText ) {
			setAlt( aiState.altText );
			setTimeout( scheduleSave, 0 );
			showToast( 'Alt text accepted and saved.', 'success' );
		}
		setAiState( null );
	}

	function editAlt() {
		if ( aiState?.altText ) {
			setAlt( aiState.altText );
		}
		setAiState( null );
	}

	/* ── Folder options ──────────────────────────────────────── */
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

	if ( loading ) {
		return (
			<aside className="smm-details" style={ { display: 'flex' } }>
				<div className="details-header">
					<span className="details-title">File Details</span>
					<button
						className="btn-icon"
						onClick={ () =>
							dispatch( { type: 'CLEAR_SELECTION' } )
						}
					>
						<i className="ti ti-x" />
					</button>
				</div>
				<div
					className="details-preview"
					style={ {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						height: '140px',
					} }
				>
					<span className="smm-spinner" />
				</div>
			</aside>
		);
	}

	if ( error ) {
		return (
			<aside className="smm-details" style={ { display: 'flex' } }>
				<div className="details-header">
					<span className="details-title">File Details</span>
					<button
						className="btn-icon"
						onClick={ () =>
							dispatch( { type: 'CLEAR_SELECTION' } )
						}
					>
						<i className="ti ti-x" />
					</button>
				</div>
				<div className="details-body">
					<div className="smm-notice smm-notice-danger">
						<i className="ti ti-alert-circle" /> { error }
					</div>
				</div>
			</aside>
		);
	}

	return (
		<aside className="smm-details" style={ { display: 'flex' } }>
			<div className="details-header">
				<span className="details-title">File Details</span>
				<button
					className="btn-icon"
					onClick={ () => dispatch( { type: 'CLEAR_SELECTION' } ) }
					title="Close"
				>
					<i className="ti ti-x" />
				</button>
			</div>

			{ /* Preview */ }
			<div className="details-preview">
				{ file.type === 'image' && file.thumb ? (
					<img
						src={ file.full_url || file.thumb }
						alt={ file.title }
						style={ {
							maxWidth: '100%',
							maxHeight: '160px',
							objectFit: 'contain',
						} }
					/>
				) : (
					<div className="preview-icon">
						<i className={ `ti ${ typeToIcon( file.type ) }` } />
						<span>{ file.filename }</span>
					</div>
				) }
			</div>

			{ /* Editable fields */ }
			<div className="details-body">
				<div className="details-field">
					<span className="details-label">Title</span>
					<input
						className="details-input"
						type="text"
						value={ title }
						onChange={ ( e ) => {
							setTitle( e.target.value );
							scheduleSave();
						} }
					/>
				</div>

				{ file.type === 'image' && (
					<div className="details-field">
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label className="details-label">
							Alt Text <span className="ai-tag">AI</span>
						</label>
						<textarea
							className="details-input"
							rows="2"
							value={ alt }
							onChange={ ( e ) => {
								setAlt( e.target.value );
								scheduleSave();
							} }
						/>
					</div>
				) }

				<div className="details-field">
					<span className="details-label">Caption</span>
					<textarea
						className="details-input"
						rows="2"
						value={ caption }
						onChange={ ( e ) => {
							setCaption( e.target.value );
							scheduleSave();
						} }
					/>
				</div>

				<div className="details-field">
					<span className="details-label">Description</span>
					<textarea
						className="details-input"
						rows="2"
						value={ desc }
						onChange={ ( e ) => {
							setDesc( e.target.value );
							scheduleSave();
						} }
					/>
				</div>

				{ /* Meta */ }
				<div className="details-meta">
					<div className="details-meta-row">
						<span>File</span>
						<b className="u-mono">{ file.filename }</b>
					</div>
					<div className="details-meta-row">
						<span>Size</span>
						<b>{ formatBytes( file.size ) }</b>
					</div>
					{ file.width && (
						<div className="details-meta-row">
							<span>Dims</span>
							<b>
								{ file.width }×{ file.height }
							</b>
						</div>
					) }
					<div className="details-meta-row">
						<span>Date</span>
						<b>{ formatDate( file.date ) }</b>
					</div>
					<div className="details-meta-row">
						<span>By</span>
						<b>{ file.author }</b>
					</div>
				</div>

				{ /* Folder */ }
				<div className="details-field">
					<span className="details-label">Folder</span>
					<select
						ref={ folderSelectRef }
						className="details-input"
						style={ { height: '32px' } }
						value={ folder }
						onChange={ ( e ) => onFolderChange( e.target.value ) }
					>
						<option value="0">Uncategorized</option>
						{ renderFolderOptions( folders ) }
					</select>
				</div>
			</div>

			{ /* Actions */ }
			<div className="details-actions">
				<div className="action-btn-row">
					<button
						className="btn btn-sm btn-default"
						onClick={ async () => {
							await copyToClipboard( file.url );
							showToast( 'URL copied!', 'success' );
						} }
					>
						<i className="ti ti-copy" /> Copy URL
					</button>
					{ file.type === 'image' ? (
						<button
							className="btn btn-sm btn-default"
							onClick={ () =>
								window.open(
									`${ cfg.adminUrl }post.php?post=${ file.id }&action=edit`,
									'_blank'
								)
							}
						>
							<i className="ti ti-edit" /> Edit Image
						</button>
					) : (
						<a
							className="btn btn-sm btn-default"
							href={ file.url }
							download
						>
							<i className="ti ti-download" /> Download
						</a>
					) }
				</div>

				{ file.type === 'image' && (
					<div className="action-btn-row">
						<button
							className="btn btn-sm btn-ai"
							onClick={ generateAlt }
						>
							<i className="ti ti-sparkles" /> Generate Alt Text
						</button>
					</div>
				) }

				{ /* AI suggestion card */ }
				{ aiState === 'loading' && (
					<div className="ai-suggestion-card is-loading">
						<div className="ai-card-header">
							<i className="ti ti-sparkles" /> Generating…
						</div>
						<div className="ai-card-body">
							<div
								className="ai-shimmer"
								style={ { width: '90%' } }
							/>
							<div
								className="ai-shimmer"
								style={ { width: '75%' } }
							/>
							<div
								className="ai-shimmer"
								style={ { width: '50%' } }
							/>
							<p
								style={ {
									fontSize: '11px',
									color: 'var(--gray-400)',
									marginTop: '8px',
								} }
							>
								Analyzing image with WordPress AI…
							</p>
						</div>
					</div>
				) }
				{ aiState && aiState !== 'loading' && ! aiState.error && (
					<div className="ai-suggestion-card">
						<div className="ai-card-header">
							<i className="ti ti-sparkles" /> Suggestion ready
						</div>
						<div className="ai-card-body">
							<p className="ai-result-text">
								{ aiState.altText }
							</p>
							<div className="ai-result-meta">
								<span>{ aiState.chars } chars</span>
								<span>{ aiState.model || 'wp-ai-client' }</span>
								{ aiState.latency && (
									<span>{ aiState.latency }ms</span>
								) }
							</div>
						</div>
						<div className="ai-card-actions">
							<button
								className="btn btn-sm btn-primary"
								onClick={ acceptAlt }
							>
								Accept
							</button>
							<button
								className="btn btn-sm btn-default"
								onClick={ editAlt }
							>
								Edit
							</button>
							<button
								className="btn btn-sm btn-default"
								onClick={ () => setAiState( null ) }
							>
								Reject
							</button>
						</div>
					</div>
				) }
				{ aiState?.error && (
					<div className="ai-suggestion-card">
						<div className="ai-card-body">
							<div
								className={ `smm-notice smm-notice-${ aiState.errorType }` }
								style={ { margin: 0 } }
							>
								<i className="ti ti-alert-circle" />
								<div>
									{ aiState.error }
									{ aiState.errorType === 'warning' && (
										<>
											<br />
											<button
												className="btn btn-sm btn-default"
												style={ { marginTop: '6px' } }
												onClick={ generateAlt }
											>
												Retry
											</button>
										</>
									) }
								</div>
							</div>
						</div>
					</div>
				) }
			</div>

			{ /* Usage */ }
			<div className="details-usage">
				<div className="details-usage-title">Used in</div>
				{ usage === null && (
					<div
						style={ { fontSize: '11px', color: 'var(--gray-400)' } }
					>
						<span className="smm-spinner-sm" /> Loading…
					</div>
				) }
				{ usage !== null && usage.length === 0 && (
					<div className="usage-none">Not used in any posts.</div>
				) }
				{ usage !== null &&
					usage.length > 0 &&
					usage.slice( 0, 5 ).map( ( u, i ) => (
						<div key={ i } className="usage-item">
							<i className="ti ti-external-link" />
							<a
								href={ u.url }
								target="_blank"
								rel="noopener noreferrer"
							>
								{ u.title }
							</a>
						</div>
					) ) }
			</div>
		</aside>
	);
}
