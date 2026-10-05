/* global wp, _, nhrsmmModal */
// Adds a folder tree (modal) and folder dropdown (grid view, narrow modals) and uploads into the selected folder.
( function () {
	const media = window.wp && wp.media;
	const cfg = window.nhrsmmModal;
	if (
		! media ||
		! media.view ||
		! media.view.AttachmentFilters ||
		! cfg ||
		! cfg.folders
	) {
		return;
	}

	let currentFolder = '';

	const FolderFilter = media.view.AttachmentFilters.extend( {
		className: 'attachment-filters nhrsmm-folder-filter',

		createFilters() {
			const filters = {
				all: {
					text: cfg.all,
					props: { nhrsmm_folder: '' },
					priority: 10,
				},
				none: {
					text: cfg.none,
					props: { nhrsmm_folder: 'none' },
					priority: 20,
				},
			};
			_.each( cfg.folders, function ( folder, index ) {
				filters[ 'f' + folder.id ] = {
					text:
						new Array( folder.depth + 1 ).join( '— ' ) +
						folder.name,
					props: { nhrsmm_folder: String( folder.id ) },
					priority: 30 + index,
				};
			} );
			this.filters = filters;
		},

		change() {
			media.view.AttachmentFilters.prototype.change.apply(
				this,
				arguments
			);
			currentFolder = this.model.get( 'nhrsmm_folder' ) || '';
		},
	} );

	// Folder tree shown at the left of the media modal.
	const FolderTree = wp.Backbone.View.extend( {
		tagName: 'ul',
		className: 'nhrsmm-tree',
		events: { 'click button': 'pick' },

		initialize() {
			this.listenTo( this.model, 'change:nhrsmm_folder', this.mark );
		},

		render() {
			const add = ( value, text, depth ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.textContent = text;
				button.dataset.folder = value;
				button.style.paddingInlineStart = 12 + depth * 14 + 'px';
				const item = document.createElement( 'li' );
				item.appendChild( button );
				this.el.appendChild( item );
			};
			this.el.setAttribute( 'aria-label', cfg.label );
			this.el.textContent = '';
			add( '', cfg.all, 0 );
			add( 'none', cfg.none, 0 );
			_.each( cfg.folders, function ( folder ) {
				add( String( folder.id ), folder.name, folder.depth );
			} );
			this.mark();
			return this;
		},

		pick( event ) {
			currentFolder = event.currentTarget.dataset.folder;
			this.model.set( 'nhrsmm_folder', currentFolder );
		},

		mark() {
			const active = this.model.get( 'nhrsmm_folder' ) || '';
			this.$( 'button' ).each( function () {
				this.classList.toggle(
					'is-active',
					this.dataset.folder === active
				);
			} );
		},
	} );

	const Browser = media.view.AttachmentsBrowser;
	media.view.AttachmentsBrowser = Browser.extend( {
		createToolbar() {
			Browser.prototype.createToolbar.apply( this, arguments );
			this.toolbar.set(
				'nhrsmmFolderLabel',
				new media.view.Label( {
					value: cfg.label,
					attributes: { for: 'nhrsmm-folder-filter-' + this.cid },
					priority: -76,
				} ).render()
			);
			const filter = new FolderFilter( {
				controller: this.controller,
				model: this.collection.props,
				priority: -75,
			} );
			filter.el.id = 'nhrsmm-folder-filter-' + this.cid;
			this.toolbar.set( 'nhrsmmFolder', filter.render() );

			// The grid view on Media → Library has a flowing layout, so it keeps the dropdown only.
			const grid =
				this.controller.isModeActive &&
				this.controller.isModeActive( 'grid' );
			if ( ! grid ) {
				this.$el.addClass( 'nhrsmm-has-tree' );
				this.views.add(
					new FolderTree( { model: this.collection.props } )
				);
			}
		},
	} );

	// Send the selected folder with every upload started from the modal or grid.
	if ( wp.Uploader ) {
		const init = wp.Uploader.prototype.init;
		wp.Uploader.prototype.init = function () {
			if ( init ) {
				init.apply( this, arguments );
			}
			this.uploader.bind( 'BeforeUpload', function ( up ) {
				const folder = parseInt( currentFolder, 10 );
				if ( folder ) {
					up.settings.multipart_params.nhrsmm_folder = folder;
				} else {
					delete up.settings.multipart_params.nhrsmm_folder;
				}
			} );
		};
	}
} )();
