<?php
/**
 * Shared email presentation helpers.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// GLOBAL FROM-ADDRESS OVERRIDE
// =============================================================================

/**
 * Return the platform-wide outbound From address.
 *
 * All wp_mail() calls in the platform use info@drywalltoolbox.com unless a
 * module-specific filter (e.g. dtb_support_email_from) overrides it at a
 * higher priority.
 *
 * @return string
 */
function dtb_platform_from_email(): string {
	return (string) apply_filters( 'dtb_platform_from_email', 'info@drywalltoolbox.com' );
}

/**
 * Return the platform-wide outbound From name.
 *
 * @return string
 */
function dtb_platform_from_name(): string {
	return (string) apply_filters( 'dtb_platform_from_name', 'Drywall Toolbox' );
}

// Priority 1 — runs before any module-specific wp_mail_from filters (priority 10).
add_filter( 'wp_mail_from',      static fn( string $original ): string => dtb_platform_from_email(), 1 );
add_filter( 'wp_mail_from_name', static fn( string $original ): string => dtb_platform_from_name(), 1 );

if ( ! function_exists( 'dtb_email_logo_url' ) ) {
	/**
	 * Return the public logo URL used in customer emails.
	 *
	 * Email clients have uneven SVG support, so use the hosted PNG asset.
	 *
	 * @return string
	 */
	function dtb_email_logo_url(): string {
		return (string) apply_filters(
			'dtb_email_logo_url',
			'https://drywalltoolbox.com/logos/email-logo-white.png'
		);
	}
}

if ( ! function_exists( 'dtb_email_support_url' ) ) {
	/**
	 * Return the customer support URL for branded email footers.
	 *
	 * @return string
	 */
	function dtb_email_support_url(): string {
		return (string) apply_filters( 'dtb_email_support_url', home_url( '/contact/' ) );
	}
}

if ( ! function_exists( 'dtb_email_palette' ) ) {
	/**
	 * Resolve shared color palette for modern branded email templates.
	 *
	 * Uses the brand's global blue primary color theme matching frontend design tokens.
	 *
	 * @param string $theme light|dark.
	 * @return array<string,string>
	 */
	function dtb_email_palette( string $theme = 'light' ): array {
		$theme = 'dark' === strtolower( $theme ) ? 'dark' : 'light';

		if ( 'dark' === $theme ) {
			return [
				'shell_bg'       => '#0a1020',
				'preheader'      => '#0a1020',
				'hero_bg'        => '#0f172a',
				'hero_overlay'   => 'rgba(15, 23, 42, 0.95)',
				'card_bg'        => '#0f172a',
				'card_border'    => '#1e293b',
				'accent'         => '#3b82f6', // Brand primary blue
				'accent_hover'   => '#2563eb',
				'accent_soft_bg' => '#1e3a8a',
				'accent_soft_tx' => '#93c5fd',
				'title'          => '#f8fafc',
				'greeting'       => '#e2e8f0',
				'intro'          => '#cbd5e1',
				'text'           => '#94a3b8',
				'details_border' => '#1e293b',
				'details_bg'     => '#0c1220',
				'details_label'  => '#94a3b8',
				'details_value'  => '#e2e8f0',
				'button_bg'      => '#3b82f6',
				'button_text'    => '#ffffff',
				'button_hover'   => '#2563eb',
				'footer_bg'      => '#0c1220',
				'footer_text'    => '#94a3b8',
				'footer_link'    => '#60a5fa',
				'footer_sep'     => '#475569',
				'copyright'      => '#64748b',
			];
		}

		return [
			'shell_bg'       => '#f4f6fb',
			'preheader'      => '#f4f6fb',
			'hero_bg'        => '#0a1020',
			'hero_overlay'   => 'rgba(10, 16, 32, 0.95)',
			'card_bg'        => '#ffffff',
			'card_border'    => '#dbe3f1',
			'accent'         => '#2563eb', // Brand primary blue
			'accent_hover'   => '#1d4ed8',
			'accent_soft_bg' => '#dbeafe',
			'accent_soft_tx' => '#1d4ed8',
			'title'          => '#0f172a',
			'greeting'       => '#1e293b',
			'intro'          => '#334155',
			'text'           => '#64748b',
			'details_border' => '#dbe3f1',
			'details_bg'     => '#f8fafc',
			'details_label'  => '#64748b',
			'details_value'  => '#0f172a',
			'button_bg'      => '#2563eb',
			'button_text'    => '#ffffff',
			'button_hover'   => '#1d4ed8',
			'footer_bg'      => '#f8fafc',
			'footer_text'    => '#64748b',
			'footer_link'    => '#2563eb',
			'footer_sep'     => '#cbd5e1',
			'copyright'      => '#94a3b8',
		];
	}
}

if ( ! function_exists( 'dtb_email_button' ) ) {
	/**
	 * Render a modern, responsive email CTA button.
	 *
	 * @param string $url   Target URL.
	 * @param string $label Button label.
	 * @param array<string,mixed> $style Optional style overrides.
	 * @return string
	 */
	function dtb_email_button( string $url, string $label, array $style = [] ): string {
		$url   = esc_url( $url );
		$label = esc_html( $label );
		$bg    = sanitize_hex_color( (string) ( $style['bg'] ?? '#2563eb' ) ) ?: '#2563eb';
		$text  = sanitize_hex_color( (string) ( $style['text'] ?? '#ffffff' ) ) ?: '#ffffff';
		$hover = sanitize_hex_color( (string) ( $style['hover'] ?? '#1d4ed8' ) ) ?: '#1d4ed8';

		if ( '' === $url || '' === $label ) {
			return '';
		}

		return '
		<!--[if mso]>
		<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="' . $url . '" style="height:54px;v-text-anchor:middle;width:200px;" arcsize="15%" stroke="f" fillcolor="' . esc_attr( $bg ) . '">
		<w:anchorlock/>
		<center style="color:' . esc_attr( $text ) . ';font-family:sans-serif;font-size:16px;font-weight:700;">
		' . $label . '
		</center>
		</v:roundrect>
		<![endif]-->
		<!--[if !mso]><!-->
		<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:32px 0 0;">
			<tr>
				<td align="center">
					<a href="' . $url . '" class="dtb-btn" style="display:inline-block;background:' . esc_attr( $bg ) . ';color:' . esc_attr( $text ) . ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Helvetica Neue\',Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.5;text-decoration:none;text-align:center;padding:15px 40px;border-radius:8px;min-width:160px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
						' . $label . '
					</a>
				</td>
			</tr>
		</table>
		<!--<![endif]-->
		';
	}
}

if ( ! function_exists( 'dtb_email_details_table' ) ) {
	/**
	 * Render modern label/value rows for email details.
	 *
	 * @param array<int,array{label:string,value:string}> $rows Detail rows.
	 * @param array<string,mixed>                          $style Optional style values.
	 * @return string
	 */
	function dtb_email_details_table( array $rows, array $style = [] ): string {
		$body = '';
		$bg          = sanitize_hex_color( (string) ( $style['bg'] ?? '#f8fafc' ) ) ?: '#f8fafc';
		$border      = sanitize_hex_color( (string) ( $style['border'] ?? '#e2e8f0' ) ) ?: '#e2e8f0';
		$label_color = sanitize_hex_color( (string) ( $style['label'] ?? '#64748b' ) ) ?: '#64748b';
		$value_color = sanitize_hex_color( (string) ( $style['value'] ?? '#0f172a' ) ) ?: '#0f172a';

		foreach ( $rows as $row ) {
			$label = trim( (string) ( $row['label'] ?? '' ) );
			$value = trim( (string) ( $row['value'] ?? '' ) );

			if ( '' === $label || '' === $value ) {
				continue;
			}

			$body .= '<tr>
				<td style="padding:16px 20px;background:' . esc_attr( $bg ) . ';color:' . esc_attr( $label_color ) . ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Helvetica Neue\',Arial,sans-serif;font-size:13px;line-height:1.5;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ' . esc_attr( $border ) . ';">' . esc_html( $label ) . '</td>
				<td style="padding:16px 20px;background:' . esc_attr( $bg ) . ';color:' . esc_attr( $value_color ) . ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Helvetica Neue\',Arial,sans-serif;font-size:15px;font-weight:600;line-height:1.5;border-bottom:1px solid ' . esc_attr( $border ) . ';text-align:right;">' . wp_kses_post( nl2br( esc_html( $value ) ) ) . '</td>
			</tr>';
		}

		if ( '' === $body ) {
			return '';
		}

		// Remove border from last row
		$body = preg_replace( '/border-bottom:[^;]+;([^"]*")([^>]*>)([^<]*<\/td>[^<]*<\/tr>)$/', '$1$2$3', $body );

		return '<table class="dtb-details-table" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;border-collapse:collapse;border:1px solid ' . esc_attr( $border ) . ';border-radius:12px;overflow:hidden;">' . $body . '</table>';
	}
}

if ( ! function_exists( 'dtb_render_branded_email' ) ) {
	/**
	 * Render the shared Drywall Toolbox customer email layout.
	 *
	 * @param array{
	 *   title?:string,
	 *   preheader?:string,
	 *   eyebrow?:string,
	 *   greeting?:string,
	 *   intro?:string,
	 *   body_html?:string,
	 *   details?:array<int,array{label:string,value:string}>,
	 *   cta_url?:string,
	 *   cta_label?:string,
	 *   signoff?:string,
	 *   footer_note?:string,
	 *   theme?:string
	 * } $args Template args.
	 * @return string
	 */
	function dtb_render_branded_email( array $args ): string {
		$site        = (string) get_bloginfo( 'name' );
		$title       = sanitize_text_field( (string) ( $args['title'] ?? $site ) );
		$preheader   = sanitize_text_field( (string) ( $args['preheader'] ?? '' ) );
		$eyebrow     = sanitize_text_field( (string) ( $args['eyebrow'] ?? 'Drywall Toolbox' ) );
		$greeting    = sanitize_text_field( (string) ( $args['greeting'] ?? 'Hi there,' ) );
		$intro       = wp_kses_post( (string) ( $args['intro'] ?? '' ) );
		$body_html   = wp_kses_post( (string) ( $args['body_html'] ?? '' ) );
		$details     = is_array( $args['details'] ?? null ) ? $args['details'] : [];
		$cta_url     = (string) ( $args['cta_url'] ?? '' );
		$cta_label   = (string) ( $args['cta_label'] ?? '' );
		$signoff     = sanitize_text_field( (string) ( $args['signoff'] ?? 'The Drywall Toolbox Team' ) );
		$footer_note = sanitize_text_field( (string) ( $args['footer_note'] ?? 'You can reply directly to this email if you need help.' ) );
		$logo_url    = esc_url( dtb_email_logo_url() );
		$home_url    = esc_url( home_url( '/' ) );
		$support_url = esc_url( dtb_email_support_url() );
		$theme_raw   = strtolower( sanitize_key( (string) ( $args['theme'] ?? apply_filters( 'dtb_email_theme', 'auto', $args ) ) ) );
		$theme       = in_array( $theme_raw, [ 'light', 'dark', 'auto' ], true ) ? $theme_raw : 'auto';
		$palette     = dtb_email_palette( 'dark' === $theme ? 'dark' : 'light' );

		$details_html = dtb_email_details_table(
			$details,
			[
				'border' => $palette['details_border'],
				'bg'     => $palette['details_bg'],
				'label'  => $palette['details_label'],
				'value'  => $palette['details_value'],
			]
		);
		$button_html  = dtb_email_button(
			$cta_url,
			$cta_label,
			[
				'bg'   => $palette['button_bg'],
				'text' => $palette['button_text'],
			]
		);

		$auto_dark_css = '';
		if ( 'auto' === $theme ) {
			$dark = dtb_email_palette( 'dark' );
			$auto_dark_css = '
				@media (prefers-color-scheme: dark) {
					.dtb-preheader { color:' . esc_attr( $dark['shell_bg'] ) . ' !important; }
					.dtb-shell { background:' . esc_attr( $dark['shell_bg'] ) . ' !important; }
					.dtb-card { background:' . esc_attr( $dark['card_bg'] ) . ' !important; border-color:' . esc_attr( $dark['card_border'] ) . ' !important; }
					.dtb-header { background:' . esc_attr( $dark['card_bg'] ) . ' !important; }
					.dtb-body { background:' . esc_attr( $dark['card_bg'] ) . ' !important; }
					.dtb-eyebrow-td { background:' . esc_attr( $dark['accent_soft_bg'] ) . ' !important; }
					.dtb-eyebrow-lbl { color:' . esc_attr( $dark['accent_soft_tx'] ) . ' !important; }
					.dtb-title { color:' . esc_attr( $dark['title'] ) . ' !important; }
					.dtb-greeting { color:' . esc_attr( $dark['greeting'] ) . ' !important; }
					.dtb-intro { color:' . esc_attr( $dark['intro'] ) . ' !important; }
					.dtb-details-table { border-color:' . esc_attr( $dark['details_border'] ) . ' !important; background:' . esc_attr( $dark['details_bg'] ) . ' !important; }
					.dtb-details-table td { background:' . esc_attr( $dark['details_bg'] ) . ' !important; color:' . esc_attr( $dark['details_value'] ) . ' !important; }
					.dtb-details-table td:first-child { color:' . esc_attr( $dark['details_label'] ) . ' !important; }
					.dtb-reply-body { background:' . esc_attr( $dark['details_bg'] ) . ' !important; border-color:' . esc_attr( $dark['details_border'] ) . ' !important; color:' . esc_attr( $dark['intro'] ) . ' !important; }
					.dtb-btn { background:' . esc_attr( $dark['button_bg'] ) . ' !important; }
					.dtb-signoff { color:' . esc_attr( $dark['intro'] ) . ' !important; }
					.dtb-signoff-name { color:' . esc_attr( $dark['title'] ) . ' !important; }
					.dtb-footer { background:' . esc_attr( $dark['footer_bg'] ) . ' !important; border-top-color:' . esc_attr( $dark['details_border'] ) . ' !important; }
					.dtb-footer-note { color:' . esc_attr( $dark['footer_text'] ) . ' !important; }
					.dtb-footer-link { color:' . esc_attr( $dark['footer_link'] ) . ' !important; }
					.dtb-footer-sep { color:' . esc_attr( $dark['footer_sep'] ) . ' !important; }
					.dtb-copyright { color:' . esc_attr( $dark['copyright'] ) . ' !important; }
					.dtb-rich .dtb-quote-table { border-color:' . esc_attr( $dark['details_border'] ) . ' !important; }
					.dtb-rich .dtb-quote-table th { background:' . esc_attr( $dark['details_bg'] ) . ' !important; color:' . esc_attr( $dark['details_label'] ) . ' !important; }
					.dtb-rich .dtb-quote-table td { border-top-color:' . esc_attr( $dark['details_border'] ) . ' !important; color:' . esc_attr( $dark['details_value'] ) . ' !important; }
					.dtb-rich .dtb-quote-note { background:' . esc_attr( $dark['details_bg'] ) . ' !important; border-color:' . esc_attr( $dark['details_border'] ) . ' !important; color:' . esc_attr( $dark['details_value'] ) . ' !important; }
					.dtb-rich .dtb-quote-total, .dtb-rich .dtb-quote-expiry { color:' . esc_attr( $dark['details_value'] ) . ' !important; }
				}
			';
		}

		$html  = '<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="color-scheme" content="light dark">
	<meta name="supported-color-schemes" content="light dark">
	<!--[if !mso]><!-->
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<!--<![endif]-->
	<title>' . esc_html( $title ) . '</title>
	<style type="text/css">
		body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
		table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
		img { -ms-interpolation-mode:bicubic; border:0; outline:0; text-decoration:none; }
		a { text-decoration:none; }
		.dtb-rich p { margin:0 0 14px; }
		.dtb-rich p:last-child { margin-bottom:0; }
		.dtb-rich table { border-collapse:collapse; width:100%; }
		.dtb-rich .dtb-quote-table { border:1px solid ' . esc_attr( $palette['details_border'] ) . '; border-radius:12px; overflow:hidden; }
		.dtb-rich .dtb-quote-table th { background:' . esc_attr( $palette['details_bg'] ) . '; color:' . esc_attr( $palette['details_label'] ) . '; font-weight:700; letter-spacing:0.03em; }
		.dtb-rich .dtb-quote-table td { color:' . esc_attr( $palette['details_value'] ) . '; border-top:1px solid ' . esc_attr( $palette['details_border'] ) . '; }
		.dtb-rich .dtb-quote-note { background:' . esc_attr( $palette['details_bg'] ) . '; border-color:' . esc_attr( $palette['details_border'] ) . '; color:' . esc_attr( $palette['details_value'] ) . '; }
		.dtb-rich .dtb-quote-total, .dtb-rich .dtb-quote-expiry { color:' . esc_attr( $palette['details_value'] ) . '; }
		@media only screen and (max-width: 620px) {
			.dtb-shell { padding: 0 !important; }
			.dtb-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
			.dtb-header { padding: 26px 22px 20px !important; }
			.dtb-body { padding: 28px 22px 26px !important; }
			.dtb-footer { padding: 20px 22px !important; }
			.dtb-title { font-size: 30px !important; line-height: 36px !important; }
			.dtb-logo { width: 168px !important; max-width: 168px !important; }
		}
		' . $auto_dark_css . '
	</style>
</head>
<body style="margin:0;padding:0;background:' . esc_attr( $palette['shell_bg'] ) . ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
	<!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
	<div class="dtb-preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:' . esc_attr( $palette['preheader'] ) . ';">' . esc_html( $preheader ) . '&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
	<table class="dtb-shell" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:' . esc_attr( $palette['shell_bg'] ) . ';padding:44px 18px;">
		<tr>
			<td align="center" valign="top">
				<table class="dtb-card" role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="width:640px;max-width:640px;background:' . esc_attr( $palette['card_bg'] ) . ';border:1px solid ' . esc_attr( $palette['card_border'] ) . ';border-radius:18px;overflow:hidden;">
					<tr>
						<td class="dtb-header" align="center" style="background:' . esc_attr( $palette['header_bg'] ) . ';padding:34px 40px 28px;text-align:center;">
							<a href="' . $home_url . '" style="text-decoration:none;display:inline-block;">
								<img class="dtb-logo" src="' . $logo_url . '" alt="' . esc_attr( $site ) . '" width="194" style="display:block;margin:0 auto;width:194px;max-width:84%;height:auto;">
							</a>
						</td>
					</tr>
					<tr>
						<td style="background:' . esc_attr( $palette['accent'] ) . ';height:3px;font-size:3px;line-height:3px;">&nbsp;</td>
					</tr>
					<tr>
						<td class="dtb-body" style="padding:38px 44px 34px;background:' . esc_attr( $palette['card_bg'] ) . ';">
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 22px;">
								<tr>
									<td class="dtb-eyebrow-td" style="background:' . esc_attr( $palette['accent_soft_bg'] ) . ';border-radius:999px;padding:6px 14px;">
										<span class="dtb-eyebrow-lbl" style="color:' . esc_attr( $palette['accent_soft_tx'] ) . ';font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">' . esc_html( $eyebrow ) . '</span>
									</td>
								</tr>
							</table>
							<h1 class="dtb-title" style="margin:0;color:' . esc_attr( $palette['title'] ) . ';font-size:36px;line-height:44px;font-weight:700;text-align:center;">' . esc_html( $title ) . '</h1>
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="54" align="center" style="margin:16px auto 30px;">
								<tr><td style="height:3px;background:' . esc_attr( $palette['accent'] ) . ';font-size:3px;line-height:3px;border-radius:999px;">&nbsp;</td></tr>
							</table>
							<p class="dtb-greeting" style="margin:0 0 10px;color:' . esc_attr( $palette['greeting'] ) . ';font-size:21px;line-height:30px;font-weight:700;">' . esc_html( $greeting ) . '</p>
							' . ( '' !== $intro ? '<p class="dtb-intro" style="margin:0;color:' . esc_attr( $palette['intro'] ) . ';font-size:16px;line-height:26px;">' . $intro . '</p>' : '' ) . '
							' . $details_html . '
							' . ( '' !== $body_html ? '
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 0;border-collapse:separate;">
								<tr>
									<td class="dtb-reply-body dtb-rich" style="padding:20px 24px;border:1px solid ' . esc_attr( $palette['details_border'] ) . ';border-radius:12px;background:' . esc_attr( $palette['details_bg'] ) . ';color:' . esc_attr( $palette['intro'] ) . ';font-size:15px;line-height:24px;">' . $body_html . '</td>
								</tr>
							</table>' : '' ) . '
							' . $button_html . '
							<p class="dtb-signoff" style="margin:34px 0 0;color:' . esc_attr( $palette['intro'] ) . ';font-size:14px;line-height:22px;">Thanks,<br><strong class="dtb-signoff-name" style="color:' . esc_attr( $palette['title'] ) . ';font-weight:700;">' . esc_html( $signoff ) . '</strong></p>
						</td>
					</tr>
					<tr>
						<td class="dtb-footer" style="padding:28px 44px;background:' . esc_attr( $palette['footer_bg'] ) . ';border-top:1px solid ' . esc_attr( $palette['details_border'] ) . ';text-align:center;">
							<p class="dtb-footer-note" style="margin:0 0 12px;color:' . esc_attr( $palette['footer_text'] ) . ';font-size:13px;line-height:20px;">' . esc_html( $footer_note ) . '</p>
							<p style="margin:0;font-size:13px;line-height:20px;">
								<a class="dtb-footer-link" href="' . $home_url . '" style="color:' . esc_attr( $palette['footer_link'] ) . ';font-weight:600;text-decoration:none;">drywalltoolbox.com</a>
								<span class="dtb-footer-sep" style="color:' . esc_attr( $palette['footer_sep'] ) . ';">&nbsp;&middot;&nbsp;</span>
								<a class="dtb-footer-link" href="' . $support_url . '" style="color:' . esc_attr( $palette['footer_link'] ) . ';font-weight:600;text-decoration:none;">Contact support</a>
							</p>
						</td>
					</tr>
				</table>
				<p class="dtb-copyright" style="margin:18px 0 0;color:' . esc_attr( $palette['copyright'] ) . ';font-size:11px;line-height:16px;text-align:center;">&copy; ' . gmdate( 'Y' ) . ' Drywall Toolbox. All rights reserved.</p>
			</td>
		</tr>
	</table>
	<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>';

		return $html;
	}
}

if ( ! function_exists( 'dtb_mail_alt_body_hook' ) ) {
	/**
	 * Attach a one-shot PHPMailer AltBody hook and return the closure to remove.
	 *
	 * @param string $plain_message Plain-text email body.
	 * @return callable
	 */
	function dtb_mail_alt_body_hook( string $plain_message ): callable {
		$set_alt_body = static function ( $phpmailer ) use ( $plain_message ): void {
			$phpmailer->AltBody = $plain_message;
		};

		add_action( 'phpmailer_init', $set_alt_body );

		return $set_alt_body;
	}
}

if ( ! function_exists( 'dtb_email_headers' ) ) {
	/**
	 * Build normalized email headers.
	 *
	 * @param array<string,mixed> $args Header args.
	 * @return string[]
	 */
	function dtb_email_headers( array $args = [] ): array {
		$content_type = sanitize_text_field( (string) ( $args['content_type'] ?? 'text/plain' ) );
		$from_name    = sanitize_text_field( (string) ( $args['from_name'] ?? '' ) );
		$from_email   = sanitize_email( (string) ( $args['from_email'] ?? '' ) );
		$reply_to     = (string) ( $args['reply_to'] ?? '' );
		$headers      = [];

		$headers[] = 'Content-Type: ' . ( '' !== $content_type ? $content_type : 'text/plain' ) . '; charset=UTF-8';

		if ( '' !== $from_email ) {
			$headers[] = 'From: ' . ( '' !== $from_name ? $from_name . ' <' . $from_email . '>' : $from_email );
		}

		if ( '' !== $reply_to ) {
			$headers[] = 'Reply-To: ' . str_replace( [ "\r", "\n" ], ' ', $reply_to );
		}

		return $headers;
	}
}

if ( ! function_exists( 'dtb_send_email' ) ) {
	/**
	 * Send outbound email through a single shared pathway.
	 *
	 * @param array<string,mixed> $args Send args.
	 * @return bool
	 */
	function dtb_send_email( array $args ): bool {
		$to      = sanitize_email( (string) ( $args['to'] ?? '' ) );
		$subject = sanitize_text_field( (string) ( $args['subject'] ?? '' ) );
		$message = (string) ( $args['message'] ?? '' );

		if ( '' === $to || ! is_email( $to ) || '' === $subject ) {
			/**
			 * Fires when dtb_send_email rejects invalid send arguments.
			 *
			 * @param array<string,mixed> $args Raw send args.
			 */
			do_action( 'dtb_email_send_invalid', $args );
			return false;
		}

		$is_html      = ! empty( $args['is_html'] );
		$content_type = sanitize_text_field( (string) ( $args['content_type'] ?? ( $is_html ? 'text/html' : 'text/plain' ) ) );
		$headers      = [];
		$raw_headers  = $args['headers'] ?? [];

		if ( is_string( $raw_headers ) && '' !== $raw_headers ) {
			$headers = [ $raw_headers ];
		} elseif ( is_array( $raw_headers ) ) {
			$headers = array_values(
				array_filter(
					array_map( static fn( $h ) => is_string( $h ) ? trim( $h ) : '', $raw_headers ),
					static fn( string $h ) => '' !== $h
				)
			);
		}

		if ( empty( $headers ) ) {
			$headers = dtb_email_headers(
				[
					'content_type' => $content_type,
					'from_name'    => (string) ( $args['from_name'] ?? '' ),
					'from_email'   => (string) ( $args['from_email'] ?? '' ),
					'reply_to'     => (string) ( $args['reply_to'] ?? '' ),
				]
			);
		} elseif ( ! array_filter( $headers, static fn( string $h ) => 0 === stripos( $h, 'Content-Type:' ) ) ) {
			array_unshift( $headers, 'Content-Type: ' . $content_type . '; charset=UTF-8' );
		}

		$alt_body = isset( $args['alt_body'] ) ? (string) $args['alt_body'] : '';
		$alt_hook = ( '' !== $alt_body && function_exists( 'dtb_mail_alt_body_hook' ) )
			? dtb_mail_alt_body_hook( $alt_body )
			: null;

		/**
		 * Fires right before an outbound email is sent.
		 *
		 * @param string              $to      Recipient email.
		 * @param string              $subject Email subject.
		 * @param string              $message Email body.
		 * @param string[]            $headers Headers.
		 * @param array<string,mixed> $args    Original send args.
		 */
		do_action( 'dtb_email_before_send', $to, $subject, $message, $headers, $args );

		$sent = (bool) wp_mail( $to, $subject, $message, $headers );

		if ( is_callable( $alt_hook ) ) {
			remove_action( 'phpmailer_init', $alt_hook );
		}

		/**
		 * Fires after an outbound email attempt.
		 *
		 * @param bool                $sent    Whether wp_mail accepted the email.
		 * @param string              $to      Recipient email.
		 * @param string              $subject Email subject.
		 * @param array<string,mixed> $args    Original send args.
		 */
		do_action( 'dtb_email_after_send', $sent, $to, $subject, $args );

		return $sent;
	}
}
