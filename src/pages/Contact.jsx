import { useState } from 'react';
import '../styles/contact-responsive.css';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    inquiryType: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Message Sent. Our engineers will contact you.');
    setFormData({ name: '', inquiryType: '', message: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section className="contact-section section-enter">
      <div className="contact-grid">
        <div className="contact-info">
          <h2 className="contact-title">
            GET IN TOUCH
          </h2>
          <p className="contact-subtitle">
            Technical support, bulk orders, or custom tool fabrication inquiries.
          </p>

          <div className="contact-detail">
            <h5 className="detail-label">
              Email
            </h5>
            <p className="detail-value">
              ops@drywalltoolbox.com
            </p>
          </div>

          <div className="contact-detail">
            <h5 className="detail-label">
              Headquarters
            </h5>
            <p className="detail-value">
              1024 Precision Way, Alloy Park<br />
              Industrial District, TX 75001
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label className="machined-label">Full Name</label>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="machined-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="machined-label">Inquiry Type</label>
            <input 
              type="text"
              name="inquiryType"
              value={formData.inquiryType}
              onChange={handleChange}
              placeholder="Technical Support"
              className="machined-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="machined-label">Message</label>
            <textarea 
              rows="5"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="How can we help?"
              className="machined-textarea"
              required
            />
          </div>

          <button 
            type="submit" 
            className="alloy-button contact-submit"
          >
            Submit Inquiry
          </button>
        </form>
      </div>
    </section>
  );
}
