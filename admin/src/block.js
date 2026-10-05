import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	RangeControl,
	Placeholder,
} from '@wordpress/components';
import ServerSideRender from '@wordpress/server-side-render';
import { __ } from '@wordpress/i18n';

const folders = window.nhrsmmBlock?.folders || [];

const folderOptions = [
	{
		value: 0,
		label: __( 'Select a folder…', 'nhrrob-smart-media-manager' ),
	},
	...folders.map( ( f ) => ( {
		value: f.id,
		label: '— '.repeat( f.depth ) + f.name,
	} ) ),
];

function Edit( { attributes, setAttributes } ) {
	const { folder, columns, size, link, limit } = attributes;
	const picker = (
		<SelectControl
			label={ __( 'Folder', 'nhrrob-smart-media-manager' ) }
			value={ folder }
			options={ folderOptions }
			onChange={ ( value ) =>
				setAttributes( { folder: parseInt( value, 10 ) } )
			}
			__nextHasNoMarginBottom
		/>
	);

	return (
		<div { ...useBlockProps() }>
			<InspectorControls>
				<PanelBody
					title={ __( 'Gallery', 'nhrrob-smart-media-manager' ) }
				>
					{ picker }
					<RangeControl
						label={ __( 'Columns', 'nhrrob-smart-media-manager' ) }
						value={ columns }
						min={ 1 }
						max={ 9 }
						onChange={ ( value ) =>
							setAttributes( { columns: value } )
						}
						__nextHasNoMarginBottom
					/>
					<RangeControl
						label={ __(
							'Maximum images',
							'nhrrob-smart-media-manager'
						) }
						value={ limit }
						min={ 1 }
						max={ 200 }
						onChange={ ( value ) =>
							setAttributes( { limit: value } )
						}
						__nextHasNoMarginBottom
					/>
					<SelectControl
						label={ __(
							'Image size',
							'nhrrob-smart-media-manager'
						) }
						value={ size }
						options={ [
							'thumbnail',
							'medium',
							'large',
							'full',
						].map( ( value ) => ( { value, label: value } ) ) }
						onChange={ ( value ) =>
							setAttributes( { size: value } )
						}
						__nextHasNoMarginBottom
					/>
					<SelectControl
						label={ __( 'Link to', 'nhrrob-smart-media-manager' ) }
						value={ link }
						options={ [
							{
								value: 'file',
								label: __(
									'Media file',
									'nhrrob-smart-media-manager'
								),
							},
							{
								value: 'post',
								label: __(
									'Attachment page',
									'nhrrob-smart-media-manager'
								),
							},
							{
								value: 'none',
								label: __(
									'None',
									'nhrrob-smart-media-manager'
								),
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { link: value } )
						}
						__nextHasNoMarginBottom
					/>
				</PanelBody>
			</InspectorControls>
			{ folder ? (
				<ServerSideRender
					block="nhrsmm/folder-gallery"
					attributes={ attributes }
				/>
			) : (
				<Placeholder
					icon="format-gallery"
					label={ __(
						'Folder Gallery',
						'nhrrob-smart-media-manager'
					) }
				>
					{ picker }
				</Placeholder>
			) }
		</div>
	);
}

registerBlockType( 'nhrsmm/folder-gallery', {
	apiVersion: 3,
	title: __( 'Folder Gallery', 'nhrrob-smart-media-manager' ),
	description: __(
		'Shows the images of one media folder as a gallery.',
		'nhrrob-smart-media-manager'
	),
	category: 'media',
	icon: 'format-gallery',
	supports: { html: false },
	edit: Edit,
	save: () => null,
} );
