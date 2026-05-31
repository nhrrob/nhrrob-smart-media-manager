import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
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
				showToast(
					sprintf(
						// translators: %s: error message
						__( 'Save failed: %s', 'nhrrob-smart-media-manager' ),
						e.message
					),
					'danger'
				);
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
			showToast(
				__( 'Moved to folder.', 'nhrrob-smart-media-manager' ),
				'success'
			);
		} catch ( e ) {
			showToast( e.message, 'danger' );
		}
	}

	function deleteFile() {
		showConfirm(
			__(
				'Delete this file? This cannot be undone.',
				'nhrrob-smart-media-manager'
			),
			async () => {
				try {
					await del( '/media/bulk-delete', { ids: [ fileId ] } );
					dispatch( { type: 'CLEAR_SELECTION' } );
					await loadFolders();
					loadMedia();
					showToast(
						__( 'File deleted.', 'nhrrob-smart-media-manager' ),
						'success'
					);
				} catch ( e ) {
					showToast( e.message, 'danger' );
				}
			}
		);
	}

	async function generateAlt() {
		if ( ! cfg.aiConfigured ) {
			showToast(
				__(
					'No AI provider configured. Go to Settings → Connectors.',
					'nhrrob-smart-media-manager'
				),
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
			showToast(
				__(
					'Alt text accepted and saved.',
					'nhrrob-smart-media-manager'
				),
				'success'
			);
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
				__(
					'No AI provider configured. Go to Settings → Connectors.',
					'nhrrob-smart-media-manager'
				),
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
			showToast(
				__(
					'Caption accepted and saved.',
					'nhrrob-smart-media-manager'
				),
				'success'
			);
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

	let altBtnLabel;
	if ( aiState === 'loading' ) {
		altBtnLabel = __( 'Generating…', 'nhrrob-smart-media-manager' );
	} else if ( aiState ) {
		altBtnLabel = __(
			'Re-generate Alt Text',
			'nhrrob-smart-media-manager'
		);
	} else {
		altBtnLabel = __( 'Generate Alt Text', 'nhrrob-smart-media-manager' );
	}

	let captionBtnLabel;
	if ( captionAiState === 'loading' ) {
		captionBtnLabel = __( 'Generating…', 'nhrrob-smart-media-manager' );
	} else if ( captionAiState && ! captionAiState.error ) {
		captionBtnLabel = __(
			'Re-generate Caption',
			'nhrrob-smart-media-manager'
		);
	} else {
		captionBtnLabel = __(
			'Generate Caption',
			'nhrrob-smart-media-manager'
		);
	}

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
					title={ __( 'Close', 'nhrrob-smart-media-manager' ) }
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
						<div className="details-section-label">
							{ __( 'Alt Text', 'nhrrob-smart-media-manager' ) }
						</div>

						{ aiState === 'loading' && (
							<div className="ai-suggestion-card is-loading">
								<div className="ai-card-header">
									<i className="ti ti-sparkles" />{ ' ' }
									{ __(
										'Generating…',
										'nhrrob-smart-media-manager'
									) }
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
									<i className="ti ti-sparkles" />{ ' ' }
									{ __(
										'AI Suggestion',
										'nhrrob-smart-media-manager'
									) }
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
										<span>
											{ sprintf(
												// translators: %d: character count
												__(
													'%d chars',
													'nhrrob-smart-media-manager'
												),
												aiState.chars
											) }
										</span>
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
										<i className="ti ti-check" />{ ' ' }
										{ __(
											'Accept',
											'nhrrob-smart-media-manager'
										) }
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ editAlt }
									>
										<i className="ti ti-edit" />{ ' ' }
										{ __(
											'Edit',
											'nhrrob-smart-media-manager'
										) }
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ () => setAiState( null ) }
									>
										<i className="ti ti-x" />{ ' ' }
										{ __(
											'Reject',
											'nhrrob-smart-media-manager'
										) }
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
					<div className="details-section-label">
						{ __( 'Title', 'nhrrob-smart-media-manager' ) }
					</div>
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
					<div className="details-section-label">
						{ __( 'Caption', 'nhrrob-smart-media-manager' ) }
					</div>

					{ captionAiState === 'loading' && (
						<div className="ai-suggestion-card is-loading">
							<div className="ai-card-header">
								<i className="ti ti-sparkles" />{ ' ' }
								{ __(
									'Generating…',
									'nhrrob-smart-media-manager'
								) }
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
									<i className="ti ti-sparkles" />{ ' ' }
									{ __(
										'AI Suggestion',
										'nhrrob-smart-media-manager'
									) }
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
											{ sprintf(
												// translators: %d: character count
												__(
													'%d chars',
													'nhrrob-smart-media-manager'
												),
												captionAiState.chars
											) }
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
										<i className="ti ti-check" />{ ' ' }
										{ __(
											'Accept',
											'nhrrob-smart-media-manager'
										) }
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ editCaption }
									>
										<i className="ti ti-edit" />{ ' ' }
										{ __(
											'Edit',
											'nhrrob-smart-media-manager'
										) }
									</button>
									<button
										className="btn btn-sm btn-default"
										onClick={ () =>
											setCaptionAiState( null )
										}
									>
										<i className="ti ti-x" />{ ' ' }
										{ __(
											'Reject',
											'nhrrob-smart-media-manager'
										) }
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
						placeholder={ __(
							'Optional caption…',
							'nhrrob-smart-media-manager'
						) }
						onChange={ ( e ) => {
							setCaption( e.target.value );
							scheduleSave();
						} }
					/>
				</div>

				<div className="details-section">
					<div className="details-section-label">
						{ __( 'Folder', 'nhrrob-smart-media-manager' ) }
					</div>
					<select
						ref={ folderSelectRef }
						id="smm-details-folder-select"
						className="details-input"
						value={ folder }
						onChange={ ( e ) => onFolderChange( e.target.value ) }
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

				<div className="details-section">
					<div className="details-section-label">
						{ __( 'Used In', 'nhrrob-smart-media-manager' ) }
						{ usage !== null && usage.length > 0 && (
							<span className="section-badge">
								{ usage.length }
							</span>
						) }
					</div>
					{ usage === null && (
						<div className="details-section-loading">
							<span className="smm-spinner-sm" />{ ' ' }
							{ __( 'Loading…', 'nhrrob-smart-media-manager' ) }
						</div>
					) }
					{ usage !== null && usage.length === 0 && (
						<p className="details-section-empty">
							{ __(
								'Not used anywhere.',
								'nhrrob-smart-media-manager'
							) }
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
					<div className="details-section-label">
						{ __( 'Uploaded', 'nhrrob-smart-media-manager' ) }
					</div>
					<p className="details-section-value">
						{ formatDate( file.date ) } · { file.author }
					</p>
				</div>

				<div className="details-section">
					<div className="details-section-label">
						{ __( 'File URL', 'nhrrob-smart-media-manager' ) }
					</div>
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
							{ altBtnLabel }
						</button>
					) }
					<button
						className="btn btn-full btn-ai"
						disabled={ captionAiState === 'loading' }
						onClick={ generateCaption }
					>
						<i className="ti ti-sparkles" />
						{ captionBtnLabel }
					</button>
					<button
						className="btn btn-full btn-outline-action"
						onClick={ async () => {
							await copyToClipboard( file.url );
							showToast(
								__(
									'URL copied!',
									'nhrrob-smart-media-manager'
								),
								'success'
							);
						} }
					>
						<i className="ti ti-copy" />{ ' ' }
						{ __( 'Copy URL', 'nhrrob-smart-media-manager' ) }
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
							<i className="ti ti-external-link" />{ ' ' }
							{ __( 'Edit Media', 'nhrrob-smart-media-manager' ) }
						</button>
					) : (
						<>
							<a
								className="btn btn-full btn-outline-action"
								href={ file.url }
								download
							>
								<i className="ti ti-download" />{ ' ' }
								{ __(
									'Download',
									'nhrrob-smart-media-manager'
								) }
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
								<i className="ti ti-external-link" />{ ' ' }
								{ __(
									'Edit Media',
									'nhrrob-smart-media-manager'
								) }
							</button>
						</>
					) }
					<button
						className="btn btn-full btn-danger-outline"
						onClick={ deleteFile }
					>
						<i className="ti ti-trash" />{ ' ' }
						{ __( 'Delete File', 'nhrrob-smart-media-manager' ) }
					</button>
				</div>
			</div>
		</aside>
	);
}
