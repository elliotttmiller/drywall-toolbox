<?php
/**
 * Template Name: Contact
 *
 * @package drywall-toolbox
 */

get_header();

// ─── Form processing ──────────────────────────────────────────────────────────
$form_status  = '';
$form_message = '';

if ( 'POST' === $_SERVER['REQUEST_METHOD'] && isset( $_POST['dwtb_contact_nonce_field'] ) ) {

    if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['dwtb_contact_nonce_field'] ) ), 'dwtb_contact_nonce' ) ) {
        $form_status  = 'error';
        $form_message = __( 'Security check failed. Please refresh and try again.', 'drywall-toolbox' );
    } else {
        $name         = isset( $_POST['contact_name'] )    ? sanitize_text_field( wp_unslash( $_POST['contact_name'] ) )    : '';
        $inquiry_type = isset( $_POST['inquiry_type'] )    ? sanitize_text_field( wp_unslash( $_POST['inquiry_type'] ) )    : '';
        $message      = isset( $_POST['contact_message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['contact_message'] ) ) : '';

        if ( empty( $name ) || empty( $message ) ) {
            $form_status  = 'error';
            $form_message = __( 'Please fill in all required fields.', 'drywall-toolbox' );
        } else {
            $admin_email = get_option( 'admin_email' );
            $subject     = sprintf(
                /* translators: 1: inquiry type, 2: site name */
                __( '[%2$s] New Contact: %1$s', 'drywall-toolbox' ),
                $inquiry_type ?: __( 'General', 'drywall-toolbox' ),
                get_bloginfo( 'name' )
            );

            $body  = __( 'Name: ', 'drywall-toolbox' ) . $name . "\n\n";
            $body .= __( 'Inquiry Type: ', 'drywall-toolbox' ) . ( $inquiry_type ?: __( 'General', 'drywall-toolbox' ) ) . "\n\n";
            $body .= __( 'Message:', 'drywall-toolbox' ) . "\n" . $message;

            $sent = wp_mail( $admin_email, $subject, $body );

            if ( $sent ) {
                $form_status  = 'success';
                $form_message = __( "Thank you! Your inquiry has been received. We'll get back to you shortly.", 'drywall-toolbox' );
            } else {
                $form_status  = 'error';
                $form_message = __( 'There was a problem sending your message. Please email us directly at support@drywalltoolbox.com.', 'drywall-toolbox' );
            }
        }
    }
}
?>

<main id="main" class="site-main" role="main">
    <section class="section-enter contact-section">
        <div class="contact-grid">

            <!-- Info -->
            <div class="contact-info">
                <h2 class="contact-heading">
                    <?php esc_html_e( 'GET IN', 'drywall-toolbox' ); ?><br>
                    <?php esc_html_e( 'TOUCH', 'drywall-toolbox' ); ?>
                </h2>

                <p class="contact-intro">
                    <?php esc_html_e( 'Technical support, bulk orders, or custom tool fabrication inquiries.', 'drywall-toolbox' ); ?>
                </p>

                <div class="contact-detail">
                    <h5 class="machined-label"><?php esc_html_e( 'Email', 'drywall-toolbox' ); ?></h5>
                    <p style="font-family:var(--font-mono,monospace);">
                        <a href="mailto:support@drywalltoolbox.com">support@drywalltoolbox.com</a>
                    </p>
                </div>
            </div><!-- .contact-info -->

            <!-- Form -->
            <div class="contact-form-wrap">

                <?php if ( 'success' === $form_status ) : ?>
                    <div class="form-status form-status--success" role="alert">
                        <?php echo esc_html( $form_message ); ?>
                    </div>
                <?php elseif ( 'error' === $form_status ) : ?>
                    <div class="form-status form-status--error" role="alert">
                        <?php echo esc_html( $form_message ); ?>
                    </div>
                <?php endif; ?>

                <?php if ( 'success' !== $form_status ) : ?>
                    <form id="contact-form" class="contact-form" method="post" novalidate>

                        <?php wp_nonce_field( 'dwtb_contact_nonce', 'dwtb_contact_nonce_field' ); ?>

                        <div class="form-group">
                            <label class="machined-label" for="contact_name">
                                <?php esc_html_e( 'Full Name', 'drywall-toolbox' ); ?>
                                <span aria-hidden="true"> *</span>
                            </label>
                            <input
                                class="machined-input"
                                type="text"
                                id="contact_name"
                                name="contact_name"
                                required
                                autocomplete="name"
                                value="<?php echo isset( $_POST['contact_name'] ) ? esc_attr( sanitize_text_field( wp_unslash( $_POST['contact_name'] ) ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?>"
                            >
                        </div>

                        <div class="form-group">
                            <label class="machined-label" for="inquiry_type">
                                <?php esc_html_e( 'Inquiry Type', 'drywall-toolbox' ); ?>
                            </label>
                            <input
                                class="machined-input"
                                type="text"
                                id="inquiry_type"
                                name="inquiry_type"
                                placeholder="<?php esc_attr_e( 'Technical Support', 'drywall-toolbox' ); ?>"
                                value="<?php echo isset( $_POST['inquiry_type'] ) ? esc_attr( sanitize_text_field( wp_unslash( $_POST['inquiry_type'] ) ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?>"
                            >
                        </div>

                        <div class="form-group">
                            <label class="machined-label" for="contact_message">
                                <?php esc_html_e( 'Message', 'drywall-toolbox' ); ?>
                                <span aria-hidden="true"> *</span>
                            </label>
                            <textarea
                                class="machined-textarea"
                                id="contact_message"
                                name="contact_message"
                                rows="5"
                                required
                            ><?php echo isset( $_POST['contact_message'] ) ? esc_textarea( sanitize_textarea_field( wp_unslash( $_POST['contact_message'] ) ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?></textarea>
                        </div>

                        <button type="submit" class="alloy-button" style="width:100%;justify-content:center;">
                            <?php esc_html_e( 'Submit Inquiry', 'drywall-toolbox' ); ?>
                        </button>

                    </form>
                <?php endif; ?>

            </div><!-- .contact-form-wrap -->

        </div><!-- .contact-grid -->
    </section>
</main><!-- #main -->

<?php get_footer(); ?>
