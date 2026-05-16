export default function StorefrontAnnouncementBar({ message }) {
  if (!message) return null;
  return (
    <div className="storefront-announcement" role="status" aria-live="polite">
      {message}
    </div>
  );
}
