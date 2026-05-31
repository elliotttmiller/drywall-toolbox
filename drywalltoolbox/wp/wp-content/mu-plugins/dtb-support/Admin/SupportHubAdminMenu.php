<?php
/**
 * Admin — SupportHubAdminMenu
 *
 * Registers menus, enqueues shared assets, and renders the Settings page.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_support_register_menus(): void {
$badge = dtb_support_open_ticket_count_badge();
$label = $badge ? sprintf( 'Support %s', $badge ) : __( 'Support', 'drywall-toolbox' );

add_menu_page(
__( 'Support Hub', 'drywall-toolbox' ),
$label,
'dtb_read_support_tickets',
'dtb-support',
'dtb_support_render_dashboard_page',
'dashicons-format-chat',
30
);

add_submenu_page(
'dtb-support',
__( 'Dashboard', 'drywall-toolbox' ),
__( 'Dashboard', 'drywall-toolbox' ),
'dtb_read_support_tickets',
'dtb-support',
'dtb_support_render_dashboard_page'
);

add_submenu_page(
'dtb-support',
__( 'Settings', 'drywall-toolbox' ),
__( 'Settings', 'drywall-toolbox' ),
'dtb_manage_support_settings',
'dtb-support-settings',
'dtb_support_render_settings_page'
);
}
add_action( 'admin_menu', 'dtb_support_register_menus' );

function dtb_support_open_ticket_count_badge(): string {
$counts = dtb_support_count_by_status();
$n      = (int) ( $counts['open'] ?? 0 ) + (int) ( $counts['pending_staff'] ?? 0 );

return $n > 0 ? sprintf( '<span class="awaiting-mod">%d</span>', $n ) : '';
}

function dtb_support_enqueue_admin_assets( string $hook ): void {
if ( false === strpos( $hook, 'dtb-support' ) ) {
return;
}

$assets_dir = __DIR__ . '/assets/';
$assets_url = plugin_dir_url( __FILE__ ) . 'assets/';
$css_file   = $assets_dir . 'dtb-support.css';
$js_file    = $assets_dir . 'dtb-support.js';
$css_ver    = file_exists( $css_file ) ? (string) filemtime( $css_file ) : DTB_SUPPORT_DB_VERSION;
$js_ver     = file_exists( $js_file ) ? (string) filemtime( $js_file ) : DTB_SUPPORT_DB_VERSION;

wp_enqueue_style( 'dtb-support-admin', $assets_url . 'dtb-support.css', [], $css_ver );
wp_enqueue_script( 'dtb-support-admin', $assets_url . 'dtb-support.js', [ 'jquery' ], $js_ver, true );

$current_user = wp_get_current_user();
wp_localize_script(
'dtb-support-admin',
'dtbSupportConfig',
[
'restUrl'       => esc_url_raw( rest_url( 'dtb/v1/support/' ) ),
'nonce'         => wp_create_nonce( 'wp_rest' ),
'currentUserId' => get_current_user_id(),
'currentUser'   => $current_user->display_name,
'defaultQueue'  => get_option( 'dtb_support_default_queue', 'needs_reply' ),
'pollInterval'  => max( 30, (int) get_option( 'dtb_support_poll_interval', 60 ) ),
'capabilities'  => [
'manage'         => current_user_can( 'dtb_manage_support' ),
'reply'          => current_user_can( 'dtb_reply_support_tickets' ),
'addNote'        => current_user_can( 'dtb_add_support_notes' ),
'assign'         => current_user_can( 'dtb_assign_support_tickets' ),
'changeStatus'   => current_user_can( 'dtb_change_support_status' ),
'changePriority' => current_user_can( 'dtb_change_support_priority' ),
'manageMacros'   => current_user_can( 'dtb_manage_support_macros' ),
'viewReports'    => current_user_can( 'dtb_view_support_reports' ),
'manageSettings' => current_user_can( 'dtb_manage_support_settings' ) || current_user_can( 'manage_options' ),
],
]
);
}
add_action( 'admin_enqueue_scripts', 'dtb_support_enqueue_admin_assets' );

function dtb_support_render_settings_page(): void {
if ( ! current_user_can( 'dtb_manage_support_settings' ) && ! current_user_can( 'manage_options' ) ) {
wp_die( __( 'Insufficient permissions.', 'drywall-toolbox' ) );
}

$saved = false;
if ( isset( $_POST['_dtb_settings_nonce'] ) && wp_verify_nonce( sanitize_text_field( $_POST['_dtb_settings_nonce'] ), 'dtb_support_save_settings' ) ) {
update_option( 'dtb_support_from_name', sanitize_text_field( $_POST['dtb_support_from_name'] ?? '' ) );
update_option( 'dtb_support_from_email', sanitize_email( $_POST['dtb_support_from_email'] ?? '' ) );
update_option( 'dtb_support_admin_email', sanitize_email( $_POST['dtb_support_admin_email'] ?? '' ) );
update_option( 'dtb_support_poll_interval', absint( $_POST['dtb_support_poll_interval'] ?? 60 ) );
$saved = true;
}

$from_name     = (string) get_option( 'dtb_support_from_name', get_bloginfo( 'name' ) );
$from_email    = (string) get_option( 'dtb_support_from_email', get_option( 'admin_email', '' ) );
$admin_email   = (string) get_option( 'dtb_support_admin_email', get_option( 'admin_email', '' ) );
$poll_interval = (int) get_option( 'dtb_support_poll_interval', 60 );
?>
<div class="dtb-wrap">
<div class="dtb-topbar">
<div>
<h1 class="dtb-topbar__title">⚙️ <?php esc_html_e( 'Support Settings', 'drywall-toolbox' ); ?></h1>
<p class="dtb-topbar__sub"><?php esc_html_e( 'Configure email notifications and dashboard behaviour.', 'drywall-toolbox' ); ?></p>
</div>
</div>

<?php if ( $saved ) : ?>
<div class="dtb-alert dtb-alert--success">✓ <?php esc_html_e( 'Settings saved.', 'drywall-toolbox' ); ?></div>
<?php endif; ?>

<div class="dtb-card" style="margin:0 28px;">
<form method="post">
<?php wp_nonce_field( 'dtb_support_save_settings', '_dtb_settings_nonce' ); ?>
<div class="dtb-settings-section">
<h2 class="dtb-settings-section__title"><?php esc_html_e( 'Email', 'drywall-toolbox' ); ?></h2>
<div class="dtb-settings-grid">
<div class="dtb-field">
<label class="dtb-label" for="from_name"><?php esc_html_e( 'From Name', 'drywall-toolbox' ); ?></label>
<input type="text" id="from_name" name="dtb_support_from_name" value="<?php echo esc_attr( $from_name ); ?>" class="dtb-input">
</div>
<div class="dtb-field">
<label class="dtb-label" for="from_email"><?php esc_html_e( 'From Email', 'drywall-toolbox' ); ?></label>
<input type="email" id="from_email" name="dtb_support_from_email" value="<?php echo esc_attr( $from_email ); ?>" class="dtb-input">
</div>
<div class="dtb-field">
<label class="dtb-label" for="admin_email"><?php esc_html_e( 'Admin Notification Email', 'drywall-toolbox' ); ?></label>
<input type="email" id="admin_email" name="dtb_support_admin_email" value="<?php echo esc_attr( $admin_email ); ?>" class="dtb-input">
<span class="dtb-hint"><?php esc_html_e( 'New ticket alerts are delivered here.', 'drywall-toolbox' ); ?></span>
</div>
</div>
</div>

<div class="dtb-settings-section">
<h2 class="dtb-settings-section__title"><?php esc_html_e( 'Dashboard', 'drywall-toolbox' ); ?></h2>
<div class="dtb-settings-grid">
<div class="dtb-field">
<label class="dtb-label" for="poll_interval"><?php esc_html_e( 'Auto-Refresh (seconds)', 'drywall-toolbox' ); ?></label>
<input type="number" id="poll_interval" name="dtb_support_poll_interval" value="<?php echo esc_attr( $poll_interval ); ?>" min="30" max="600" class="dtb-input dtb-input--sm">
<span class="dtb-hint"><?php esc_html_e( 'Minimum 30s. Set to 0 to disable.', 'drywall-toolbox' ); ?></span>
</div>
</div>
</div>

<div class="dtb-settings-footer">
<button type="submit" class="dtb-btn dtb-btn--primary"><?php esc_html_e( 'Save Settings', 'drywall-toolbox' ); ?></button>
</div>
</form>
</div>
</div>
<?php
}
