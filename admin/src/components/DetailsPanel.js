import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { useApp } from '../context';
import { get, put, post, del } from '../api';
import {
	formatBytes,
	formatDate,
	typeToIcon,
	mimeToLabel,
	copyToClipboard,
} from '../utils';

const cfg = window.nhrsmmConfig || {};

export default function DetailsPanel( { fileId } ) {
	const { dispatch, state, loadMedia, loadFolders, showToast, showConfirm } =
		useApp();
	const { folders } = state;
	const scrollRef = useRef( null );

	const [ file, setFile ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ usage, setUsage ] = useState( null );

	const [ title, setTitle ] = useState( '' );
	const [ alt, setAlt ] = useState( '' );
	const [ caption, setCaption ] = useState( '' );
	const [ desc, setDesc ] = useState( '' ); // kept for save round-trip; not shown
	const [ folder, setFolder ] = useState( 0 );

	const [ aiState, setAiState ] = useState( null );
	const [ captionAiState, setCaptionAiState ] = useState( null );
	const saveTimerRef = useRef( null );
	const folderSelectRef = useRef( null );

	useEffect( () => {
		setLoading( true );
		setError( null );
		setFile( null );
		setAiState( null );
		setCaptionAiState( null );
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

	const scheduleSave = useCallback( () => {
		clearTimeout( saveTimerRef.current );
		saveTimerRef.current = setTimeout( async () => {
			const body = { title, caption, description: desc };
			if ( file?.type === 'image' ) {
				body.alt = alt;
			}
			try {
				await put( `/media/${ fileId }`, body );
				const patch = { title };
				if ( file?.type === 'image' ) {
					patch.has_alt = alt.trim() !== '';
				}
				dispatch( { type: 'PATCH_FILE', id: fileId, patch } );
			} catch ( e ) {
				showToast( 'Save failed: ' + e.message, 'danger' );
			}
		}, 800 );
	}, [ fileId, title, alt, caption, desc, file?.type, showToast, dispatch ] );

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

	function deleteFile() {
		showConfirm( 'Delete this file? This cannot be undone.', async () => {
			try {
				await del( '/media/bulk-delete', { ids: [ fileId ] } );
				dispatch( { type: 'CLEAR_SELECTION' } );
				await loadFolders();
				loadMedia();
				showToast( 'File deleted.', 'success' );
			} catch ( e ) {
				showToast( e.message, 'danger' );
			}
		} );
	}

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
			const res = await post( '/ai/alt-text', {
				attachment_id: fileId,
			} );
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

	async function generateCaption() {
		if ( ! cfg.aiConfigured ) {
			showToast(
				'No AI provider configured. Go to Settings → Connectors.',
				'warning'
			);
			return;
		}
		setCaptionAiState( 'loading' );
		try {
			const res = await post( '/ai/caption', {
				attachment_id: fileId,
			} );
			setCaptionAiState( {
				captionText: res.caption,
				chars: res.chars || res.caption.length,
				model: res.model,
				latency: res.latency,
			} );
		} catch ( e ) {
			const errorType = e.status === 429 ? 'warning' : 'danger';
			setCaptionAiState( { error: e.message, errorType } );
		}
	}

	function acceptCaption() {
		if ( captionAiState?.captionText ) {
			setCaption( captionAiState.captionText );
			setTimeout( scheduleSave, 0 );
			showToast( 'Caption accepted and saved.', 'success' );
		}
		setCaptionAiState( null );
	}

	function editCaption() {
		if ( captionAiState?.captionText ) {
			setCaption( captionAiState.captionText );
		}
		setCaptionAiState( null );
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

	function close() {
		dispatch( { type: 'CLEAR_SELECTION' } );
	}

	if ( loading ) {
		return (
			<aside className="smm-details" style={ { display: 'flex' } }>
				<div className="details-preview">
					<button className="details-close-btn" onClick={ close }>
						<i className="ti ti-x" />
					</button>
					<span className="smm-spinner" />
				</div>
			</aside>
		);
	}

	if ( error ) {
		return (
			<aside className="smm-details" style={ { display: 'flex' } }>
				<div className="details-preview">
					<button className="details-close-btn" onClick={ close }>
						<i className="ti ti-x" />
					</button>
				</div>
				<div className="details-scroll" ref={ scrollRef }>
					<div className="details-section">
						<div className="smm-notice smm-notice-danger">
							<i className="ti ti-alert-circle" /> { error }
						</div>
					</div>
				</div>
			</aside>
		);
	}

	const hasAiSuggestion = aiState && aiState !== 'loading' && ! aiState.error;
	let urlPath = file.url || '';
	try {
		urlPath = new URL( file.url ).pathname;
	} catch {
		// keep as-is
	}

	return (
		<aside className="smm-details" style={ { display: 'flex' } }>
			<div className="details-preview">
				<button
					className="details-close-btn"
					onClick={ close }
					title="Close"
				>
					<i className="ti ti-x" />
				</button>
				{ file.type === 'image' && file.thumb ? (
					<img
						src={ file.full_url || file.thumb }
						alt={ file.title }
					/>
				) : (
					<div className="preview-icon">
						<i className={ `ti ${ typeToIcon( file.type ) }` } />
					</div>
				) }
				{ file.width > 0 && (
					<span className="preview-dims">
						{ file.width }×{ file.height }
					</span>
				) }
			</div>

			<div className="details-scroll" ref={ scrollRef }>
				<div className="details-fileinfo">
					<div className="fileinfo-name">{ file.filename }</div>
					<div className="fileinfo-chips">
						<span className="info-chip">
							{ mimeToLabel( file.mime ) }
						</span>
						{ file.width > 0 && (
							<span className="info-chip">
								{ file.width }×{ file.height }
							</span>
						) }
						<span className="info-chip">
							{ formatBytes( file.size ) }
						</span>
					</div>
				</div>

				{ file.type === 'image' && (
					<div className="details-section">
						<div className="details-section-label">Alt Text</div>

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
										style={ { width: '70%' } }
									/>
									<div
										className="ai-shimmer"
										style={ { width: '50%' } }
									/>
								</div>
							</div>
						) }

						{ hasAiSuggestion && (
							<div className="ai-suggestion-card">
								<div className="ai-card-header">
									<i className="ti ti-sparkles" /> AI
									Suggestion
									{ aiState.latency && (
										<span className="ai-latency">
											{ (
												aiState.latency / 1000
											).toFixed( 1 ) }
											s
										</span>
									) }
								</div>
								<div className="ai-card-body">
									<p className="ai-result-text">
										{ aiState.altText }
									</p>
									<p className="ai-result-meta">
										<span>{ aiState.chars } chars</span>
										{ aiState.model && (
											<span>{ aiState.model }</span>
										) }
									</p>
								</div>
								<div className="ai-card-actions">
									<button
										className="btn btn-sm btn-primary"
										onClick={ acceptAlt }
									>
										<i className="ti ti-check" /> Accept
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ editAlt }
									>
										<i className="ti ti-edit" /> Edit
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ () => setAiState( null ) }
									>
										<i className="ti ti-x" /> Reject
									</button>
								</div>
							</div>
						) }

						{ aiState?.error && (
							<div
								className={ `smm-notice smm-notice-${ aiState.errorType }` }
								style={ { margin: 0 } }
							>
								<i className="ti ti-alert-circle" />{ ' ' }
								{ aiState.error }
							</div>
						) }

						<textarea
							className="details-input"
							rows="3"
							value={ alt }
							onChange={ ( e ) => {
								setAlt( e.target.value );
								scheduleSave();
							} }
						/>
					</div>
				) }

				<div className="details-section">
					<div className="details-section-label">Title</div>
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

				<div className="details-section">
					<div className="details-section-label">Caption</div>

					{ captionAiState === 'loading' && (
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
									style={ { width: '60%' } }
								/>
							</div>
						</div>
					) }

					{ captionAiState &&
						captionAiState !== 'loading' &&
						! captionAiState.error && (
							<div className="ai-suggestion-card">
								<div className="ai-card-header">
									<i className="ti ti-sparkles" /> AI
									Suggestion
									{ captionAiState.latency && (
										<span className="ai-latency">
											{ (
												captionAiState.latency / 1000
											).toFixed( 1 ) }
											s
										</span>
									) }
								</div>
								<div className="ai-card-body">
									<p className="ai-result-text">
										{ captionAiState.captionText }
									</p>
									<p className="ai-result-meta">
										<span>
											{ captionAiState.chars } chars
										</span>
										{ captionAiState.model && (
											<span>
												{ captionAiState.model }
											</span>
										) }
									</p>
								</div>
								<div className="ai-card-actions">
									<button
										className="btn btn-sm btn-primary"
										onClick={ acceptCaption }
									>
										<i className="ti ti-check" /> Accept
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ editCaption }
									>
										<i className="ti ti-edit" /> Edit
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ () =>
											setCaptionAiState( null )
										}
									>
										<i className="ti ti-x" /> Reject
									</button>
								</div>
							</div>
						) }

					{ captionAiState?.error && (
						<div
							className={ `smm-notice smm-notice-${ captionAiState.errorType }` }
							style={ { margin: 0 } }
						>
							<i className="ti ti-alert-circle" />{ ' ' }
							{ captionAiState.error }
						</div>
					) }

					<textarea
						className="details-input"
						rows="2"
						value={ caption }
						placeholder="Optional caption…"
						onChange={ ( e ) => {
							setCaption( e.target.value );
							scheduleSave();
						} }
					/>
				</div>

				<div className="details-section">
					<div className="details-section-label">Folder</div>
					<select
						ref={ folderSelectRef }
						id="smm-details-folder-select"
						className="details-input"
						value={ folder }
						onChange={ ( e ) => onFolderChange( e.target.value ) }
					>
						<option value="0">Uncategorized</option>
						{ renderFolderOptions( folders ) }
					</select>
				</div>

				<div className="details-section">
					<div className="details-section-label">
						Used In
						{ usage !== null && usage.length > 0 && (
							<span className="section-badge">
								{ usage.length }
							</span>
						) }
					</div>
					{ usage === null && (
						<div className="details-section-loading">
							<span className="smm-spinner-sm" /> Loading…
						</div>
					) }
					{ usage !== null && usage.length === 0 && (
						<p className="details-section-empty">
							Not used anywhere.
						</p>
					) }
					{ usage !== null && usage.length > 0 && (
						<div className="usage-list">
							{ usage.slice( 0, 5 ).map( ( u, i ) => (
								<a
									key={ i }
									href={ u.url }
									target="_blank"
									rel="noopener noreferrer"
									className="usage-link"
								>
									{ u.title }
									<i className="ti ti-external-link" />
								</a>
							) ) }
						</div>
					) }
				</div>

				<div className="details-section">
					<div className="details-section-label">Uploaded</div>
					<p className="details-section-value">
						{ formatDate( file.date ) } · { file.author }
					</p>
				</div>

				<div className="details-section">
					<div className="details-section-label">File URL</div>
					<p className="details-file-url">{ urlPath }</p>
				</div>

				<div className="details-actions">
					{ file.type === 'image' && (
						<button
							className="btn btn-full btn-ai"
							disabled={ aiState === 'loading' }
							onClick={ generateAlt }
						>
							<i className="ti ti-sparkles" />
							{ aiState === 'loading'
								? 'Generating…'
								: aiState
								? 'Re-generate Alt Text'
								: 'Generate Alt Text' }
						</button>
					) }
					<button
						className="btn btn-full btn-ai"
						disabled={ captionAiState === 'loading' }
						onClick={ generateCaption }
					>
						<i className="ti ti-sparkles" />
						{ captionAiState === 'loading'
							? 'Generating…'
							: captionAiState && ! captionAiState.error
							? 'Re-generate Caption'
							: 'Generate Caption' }
					</button>
					<button
						className="btn btn-full btn-outline-action"
						onClick={ async () => {
							await copyToClipboard( file.url );
							showToast( 'URL copied!', 'success' );
						} }
					>
						<i className="ti ti-copy" /> Copy URL
					</button>
					{ file.type === 'image' ? (
						<button
							className="btn btn-full btn-outline-action"
							onClick={ () =>
								window.open(
									`${ cfg.adminUrl }post.php?post=${ file.id }&action=edit`,
									'_blank'
								)
							}
						>
							<i className="ti ti-external-link" /> Edit Media
						</button>
					) : (
						<>
							<a
								className="btn btn-full btn-outline-action"
								href={ file.url }
								download
							>
								<i className="ti ti-download" /> Download
							</a>
							<button
								className="btn btn-full btn-outline-action"
								onClick={ () =>
									window.open(
										`${ cfg.adminUrl }post.php?post=${ file.id }&action=edit`,
										'_blank'
									)
								}
							>
								<i className="ti ti-external-link" /> Edit Media
							</button>
						</>
					) }
					<button
						className="btn btn-full btn-danger-outline"
						onClick={ deleteFile }
					>
						<i className="ti ti-trash" /> Delete File
					</button>
				</div>
			</div>
		</aside>
	);
}
