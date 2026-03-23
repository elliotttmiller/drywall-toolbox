import { useState } from 'react';

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
    <section className="section-enter px-4 sm:px-6 md:px-10 lg:px-40 pb-16 sm:pb-20 min-h-screen" style={{ paddingTop: 'calc(var(--header-height, 70px) + clamp(1.5rem, 3vw, 2.5rem))' }}>
      <div className="max-w-250 mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 md:gap-16 lg:gap-20">
        <div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">
            GET IN TOUCH
          </h2>
          <p className="mb-6 sm:mb-8 md:mb-10 opacity-70 text-sm sm:text-base text-black">
            Technical support, bulk orders, or custom tool fabrication inquiries.
          </p>

          <div className="mb-6 sm:mb-8">
            <h5 className="uppercase text-[0.65rem] sm:text-[0.7rem] tracking-wider text-black mb-2">
              Email
            </h5>
            <p className="text-sm sm:text-base break-all text-black" style={{ fontFamily: 'var(--font-mono)' }}>
              support@drywalltoolbox.com
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="machined-label text-blue-600">Full Name</label>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="machined-input text-black"
              required
            />
          </div>

          <div className="form-group">
            <label className="machined-label text-blue-600">Inquiry Type</label>
            <input 
              type="text"
              name="inquiryType"
              value={formData.inquiryType}
              onChange={handleChange}
              placeholder="Technical Support"
              className="machined-input text-black"
              required
            />
          </div>

          <div className="form-group">
            <label className="machined-label text-blue-600">Message</label>
            <textarea 
              rows="5"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="How can we help?"
              className="machined-textarea text-black"
              required
            />
          </div>

          <button 
            type="submit" 
            className="alloy-button w-full justify-center"
          >
            Submit Inquiry
          </button>
        </form>
      </div>
    </section>
  );
}
